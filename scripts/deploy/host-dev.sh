#!/usr/bin/env bash
# Installs the branch-preview web server as a user unit: it serves the build that
# `.github/workflows/deploy-dev.yml` publishes to ~/xmage-dev-dist on
# http://127.0.0.1:8799, which the Cloudflare tunnel exposes as
# https://dev.xmage-nexus.com.
#
# Run it ON the host (the one running xmage-proxy.service). It never touches the
# proxy, the production dist or any system unit.
#
# Usage: scripts/deploy/host-dev.sh
#
# Env overrides:
#   REPO=/path/to/repo   ROOT=~/xmage-dev-dist   PORT=8799   BIND=127.0.0.1
#   NODE=/usr/bin/node   SERVICE=xmage-dev-web
set -euo pipefail

REPO="${REPO:-$HOME/Escritorio/xmage-nexus}"
ROOT="${ROOT:-$HOME/xmage-dev-dist}"
PORT="${PORT:-8799}"
BIND="${BIND:-127.0.0.1}"
NODE="${NODE:-/usr/bin/node}"
SERVICE="${SERVICE:-xmage-dev-web}"
UNIT_DIR="$HOME/.config/systemd/user"
UNIT="$UNIT_DIR/$SERVICE.service"

[[ -x "$NODE" ]] || { echo "ERROR: $NODE is not executable (set NODE)" >&2; exit 1; }
[[ -f "$REPO/scripts/dev-web-server.mjs" ]] || {
  echo "ERROR: $REPO/scripts/dev-web-server.mjs not found (set REPO; it ships with master)" >&2
  exit 1
}

mkdir -p "$UNIT_DIR" "$ROOT"

cat > "$UNIT" <<EOF
[Unit]
Description=XMage Nexus dev site (branch previews on $PORT)
After=network-online.target

[Service]
WorkingDirectory=$REPO
Environment=DEV_ROOT=$ROOT
Environment=DEV_PORT=$PORT
Environment=DEV_BIND=$BIND
ExecStart=$NODE $REPO/scripts/dev-web-server.mjs
Restart=always
RestartSec=5

[Install]
WantedBy=default.target
EOF

systemctl --user daemon-reload
systemctl --user enable --now "$SERVICE.service"
systemctl --user --no-pager status "$SERVICE.service" | head -6

cat <<EOF

The server is up on http://$BIND:$PORT/ (503 until the first preview is published).

Remaining one-time steps, if not done yet:
  1. DNS:   cloudflared tunnel route dns xmage dev.xmage-nexus.com
  2. Tunnel ingress, in ~/.cloudflared/config.yml before the http_status:404 line:
       - hostname: dev.xmage-nexus.com
         service: http://$BIND:$PORT
     then:  systemctl --user restart cloudflared-xmage.service
  3. The proxy only accepts the origins it was started with. Append
     ,https://dev.xmage-nexus.com to --allowedOrigins in
     /etc/systemd/system/xmage-proxy.service and xmage-proxy-xdhs.service, then:
       sudo systemctl daemon-reload && sudo systemctl restart xmage-proxy xmage-proxy-xdhs
     (this restarts the proxies: live sessions drop and clients reconnect).
EOF
