"""
GHOST Proxy — Port Configuration

Each port serves a different aim type with its own patched game files.
Deploy as separate systemd services, one per port:
  mitmdump -p 7771 -s proxy.py
  mitmdump -p 7772 -s proxy.py
  etc.
"""

import os

PROXY_PORTS = {
    7771: {
        "name": "Aim Drag",
        "folder": "game_patches/Aim Drag 7771",
        "description": "Aim Drag patches",
        "patches": {
            "fileinfo": "fileinfo",
            "versioninfo": "versioninfo",
            "assetindexer": "assetindexer",
        },
    },
    7772: {
        "name": "Aim Neck",
        "folder": "game_patches/Aim Neck 7772",
        "description": "Aim Neck patches",
        "patches": {
            "fileinfo": "fileinfo",
            "versioninfo": "versioninfo",
            "assetindexer": "assetindexer",
        },
    },
    7773: {
        "name": "Aim Body",
        "folder": "game_patches/Aim Body 7773",
        "description": "Aim Body patches",
        "patches": {
            "fileinfo": "fileinfo",
            "versioninfo": "versioninfo",
            "assetindexer": "assetindexer",
            "partialresconf": "partialresconf",
            "cache_res": "cache_res",
        },
    },
    7774: {
        "name": "Aim Drag Top",
        "folder": "game_patches/Aim Drag Top 7774",
        "description": "Aim Drag Top patches",
        "patches": {
            "fileinfo": "fileinfo",
            "versioninfo": "versioninfo",
            "assetindexer": "assetindexer",
        },
    },
}

CURRENT_PORT = int(os.environ.get("PROXY_PORT", "7771"))

def get_port_config(port=None):
    if port is None:
        port = CURRENT_PORT
    return PROXY_PORTS.get(port, PROXY_PORTS[7771])

def get_all_ports():
    return sorted(PROXY_PORTS.keys())
