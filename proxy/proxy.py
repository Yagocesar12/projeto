"""
GHOST Proxy — mitmproxy addon
Intercepts Free Fire asset requests and serves modified game patches.
Validates IPs against the GHOST Panel API in real-time.

Usage:
  mitmdump -p 7771 --set proxy_port=7771 -s proxy.py
"""

from __future__ import annotations

import os
import time
import json
import urllib.request
import urllib.error
from pathlib import Path
from urllib.parse import unquote

from mitmproxy import http

ROOT = Path(__file__).resolve().parent

# ─── CONFIG ──────────────────────────────────────────────────────────────────

PANEL_API_URL = os.environ.get("PANEL_API_URL", "https://your-panel.vercel.app")
API_TIMEOUT = int(os.environ.get("API_TIMEOUT", "5"))

PROXY_PORTS = {
    7771: {"name": "Aim Drag", "folder": "game_patches/Aim Drag 7771"},
    7772: {"name": "Aim Neck", "folder": "game_patches/Aim Neck 7772"},
    7773: {"name": "Aim Body", "folder": "game_patches/Aim Body 7773"},
    7774: {"name": "Aim Drag Top", "folder": "game_patches/Aim Drag Top 7774"},
}

# ─── IP VALIDATION CACHE ────────────────────────────────────────────────────

_ip_cache: dict[str, dict] = {}
CACHE_TTL = 60  # seconds

def get_current_port() -> int:
    from mitmproxy import ctx
    try:
        return ctx.options.listen_port
    except Exception:
        return int(os.environ.get("PROXY_PORT", "7771"))

def get_patch_dir() -> Path:
    port = get_current_port()
    config = PROXY_PORTS.get(port, PROXY_PORTS[7771])
    return ROOT / config["folder"]

def validate_ip(ip: str) -> bool:
    now = time.time()
    cached = _ip_cache.get(ip)
    if cached and (now - cached["ts"]) < CACHE_TTL:
        return cached["allowed"]

    try:
        req_data = json.dumps({"key": _get_key_for_ip(ip), "ip": ip}).encode()
        req = urllib.request.Request(
            f"{PANEL_API_URL}/api/proxy/validate",
            data=req_data,
            headers={"Content-Type": "application/json"},
            method="POST",
        )
        with urllib.request.urlopen(req, timeout=API_TIMEOUT) as resp:
            data = json.loads(resp.read())
            allowed = data.get("allowed", False)
            _ip_cache[ip] = {"allowed": allowed, "ts": now, "data": data}
            return allowed
    except Exception as e:
        print(f"[GHOST] API validation error for {ip}: {e}")
        if cached:
            return cached["allowed"]
        return False

def _get_key_for_ip(ip: str) -> str:
    cached = _ip_cache.get(ip, {})
    return cached.get("data", {}).get("key", "")

# ─── FALLBACK: LOCAL KEY FILE ───────────────────────────────────────────────
# If you still want local key validation as fallback, keep keys.json
# Format: {"ip": {"key": "xxx", "expires_at": 1234567890}}

_local_keys_path = ROOT / "keys.json"
_local_keys: dict = {}
_local_keys_mtime = 0.0

def load_local_keys() -> dict:
    global _local_keys, _local_keys_mtime
    if not _local_keys_path.exists():
        return {}
    mtime = _local_keys_path.stat().st_mtime
    if mtime != _local_keys_mtime:
        with open(_local_keys_path) as f:
            _local_keys = json.load(f)
        _local_keys_mtime = mtime
    return _local_keys

def is_ip_allowed(ip: str) -> bool:
    # Try API first
    if PANEL_API_URL and PANEL_API_URL != "https://your-panel.vercel.app":
        return validate_ip(ip)

    # Fallback to local keys.json
    keys = load_local_keys()
    if ip not in keys:
        return False
    entry = keys[ip]
    if entry.get("expires_at", 0) <= time.time():
        return False
    return True

# ─── BLOCKED DOMAINS ────────────────────────────────────────────────────────

BLOCKED_PATTERNS = [
    "report.garena",
    "report.tencent",
    "firebase",
    "firebaselogging",
    "firebasecrash",
    "firebaseremoteconfig",
    "ffvoice_uploadlog",
    "ffvoice",
    "datadome",
]

def is_blocked_host(flow: http.HTTPFlow) -> bool:
    try:
        host = flow.request.pretty_host.lower()
        url = flow.request.pretty_url.lower()
        path = flow.request.path.lower()
    except Exception:
        return False
    for p in BLOCKED_PATTERNS:
        pl = p.lower()
        if pl in host or pl in url or pl in path:
            return True
    return False

# ─── FILE SERVING ───────────────────────────────────────────────────────────

def read_file(filename: str) -> bytes:
    path = get_patch_dir() / filename
    if not path.exists():
        raise FileNotFoundError(f"Missing: {path}")
    return path.read_bytes()

def serve(flow: http.HTTPFlow, filename: str, content_type: str) -> None:
    try:
        data = read_file(filename)
    except FileNotFoundError:
        flow.response = http.Response.make(404, b"Not Found", {"Content-Type": "text/plain"})
        return

    size = len(data)
    headers = {
        "Server": "GSE",
        "Content-Type": content_type,
        "Content-Length": str(size),
        "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0, no-transform",
        "Pragma": "no-cache",
        "Expires": "0",
        "Accept-Ranges": "bytes",
        "Access-Control-Allow-Origin": "*",
        "Connection": "close",
    }

    method = flow.request.method.upper()
    range_header = flow.request.headers.get("Range", "")

    if range_header.lower().startswith("bytes=") and "," not in range_header:
        try:
            left, right = range_header[6:].split("-", 1)
            start = int(left) if left else 0
            end = min(int(right) if right else size - 1, size - 1)
            if 0 <= start <= end:
                chunk = data[start : end + 1]
                headers["Content-Range"] = f"bytes {start}-{end}/{size}"
                headers["Content-Length"] = str(len(chunk))
                flow.response = http.Response.make(206, b"" if method == "HEAD" else chunk, headers)
                return
        except Exception:
            pass

    flow.response = http.Response.make(200, b"" if method == "HEAD" else data, headers)

# ─── MAIN REQUEST HANDLER ──────────────────────────────────────────────────

def request(flow: http.HTTPFlow) -> None:
    client_ip = flow.client_conn.address[0]

    # Block unauthorized IPs
    if not is_ip_allowed(client_ip):
        print(f"[GHOST] BLOCKED: {client_ip}")
        flow.response = http.Response.make(
            403,
            b"Unauthorized: invalid or expired license key.",
            {"Content-Type": "text/plain"},
        )
        return

    # Block telemetry/anti-cheat domains
    if is_blocked_host(flow):
        print(f"[GHOST] BLOCKED DOMAIN: {flow.request.pretty_host} from {client_ip}")
        flow.response = http.Response.make(204, b"", {"Content-Type": "text/plain"})
        return

    # Intercept game asset requests
    path = unquote(flow.request.path.split("?", 1)[0]).lower()
    url = unquote(flow.request.pretty_url).lower()
    port = get_current_port()

    if port == 7773:
        if "fileinfo" in url and "abhotupdates" in url:
            print(f"[GHOST] INTERCEPT fileinfo (7773): {client_ip}")
            serve(flow, "fileinfo", "text/plain; charset=utf-8")
        elif "cache_res" in path or "gameassetbundles/cache_res" in url:
            print(f"[GHOST] INTERCEPT cache_res (7773): {client_ip}")
            serve(flow, "cache_res", "application/octet-stream")
        elif "config/splitedresconfs/partialresconf" in path:
            serve(flow, "partialresconf", "application/octet-stream")
        elif "versioninfo" in path:
            serve(flow, "versioninfo", "text/plain; charset=utf-8")
        elif "assetindexer" in path or "gameassetbundles/avatar/assetindexer" in url:
            print(f"[GHOST] INTERCEPT assetindexer (7773): {client_ip}")
            serve(flow, "assetindexer.gz", "application/gzip")
    else:
        if "fileinfo" in path:
            print(f"[GHOST] INTERCEPT fileinfo ({port}): {client_ip}")
            serve(flow, "fileinfo", "text/plain; charset=utf-8")
        elif "versioninfo" in path:
            serve(flow, "versioninfo", "text/plain; charset=utf-8")
        elif "assetindexer" in path or "gameassetbundles/avatar/assetindexer" in url:
            print(f"[GHOST] INTERCEPT assetindexer ({port}): {client_ip}")
            serve(flow, "assetindexer.gz", "application/gzip")
