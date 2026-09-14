#!/bin/bash
# GHOST Proxy — VPS Setup Script
# Run on a fresh Ubuntu 22.04+ VPS

set -e

echo "=== GHOST Proxy VPS Setup ==="

# Install dependencies
apt update && apt install -y python3 python3-pip

# Install mitmproxy
pip3 install mitmproxy

# Create directory structure
mkdir -p /opt/ghost-proxy/game_patches
cd /opt/ghost-proxy

echo "=== Creating systemd services ==="

# Create a service for each port
for PORT in 7771 7772 7773 7774; do
cat > /etc/systemd/system/ghost-proxy-${PORT}.service <<EOF
[Unit]
Description=GHOST Proxy Port ${PORT}
After=network.target

[Service]
Type=simple
User=root
WorkingDirectory=/opt/ghost-proxy
Environment=PROXY_PORT=${PORT}
Environment=PANEL_API_URL=https://your-panel.vercel.app
ExecStart=/usr/local/bin/mitmdump -p ${PORT} --set confdir=/opt/ghost-proxy/.mitmproxy -s proxy.py
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
EOF
done

# Enable and start services
systemctl daemon-reload
for PORT in 7771 7772 7773 7774; do
    systemctl enable ghost-proxy-${PORT}
    echo "Service ghost-proxy-${PORT} enabled"
done

echo ""
echo "=== Setup Complete ==="
echo ""
echo "Next steps:"
echo "1. Copy proxy.py and proxy_config.py to /opt/ghost-proxy/"
echo "2. Copy your game_patches/ folder to /opt/ghost-proxy/game_patches/"
echo "3. Set PANEL_API_URL in each service file to your real panel URL"
echo "4. Start services: systemctl start ghost-proxy-7771 ghost-proxy-7772 ..."
echo "5. Generate mitmproxy CA cert: mitmdump --set confdir=/opt/ghost-proxy/.mitmproxy -p 9999 &"
echo "   Then kill it and find the CA cert at /opt/ghost-proxy/.mitmproxy/mitmproxy-ca-cert.pem"
echo ""
echo "Firewall: open ports 7771-7774"
echo "  ufw allow 7771:7774/tcp"
