#!/usr/bin/env bash
# XMage Nexus — start the multi-tenant proxy that serves the web client and
# bridges players to the target XMage server. See docs/deploy-playit.md.
#
# Required:
#   ALLOWED_ORIGINS  exact public origin of the web page, e.g. http://abc.playit.gg:12345
# Optional (defaults shown):
#   JAR=./mage-proxy-1.4.61.jar  WEB_DIR=./web-dist
#   XMAGE_HOST=beta.xmage.today  XMAGE_PORT=17171
#   WS_PORT=8787                 HTTP_PORT=8788
#   BIND=127.0.0.1               (playit agent runs on this same machine)
set -euo pipefail

JAR="${JAR:-./mage-proxy-1.4.61.jar}"
WEB_DIR="${WEB_DIR:-./web-dist}"
XMAGE_HOST="${XMAGE_HOST:-beta.xmage.today}"
XMAGE_PORT="${XMAGE_PORT:-17171}"
WS_PORT="${WS_PORT:-8787}"
HTTP_PORT="${HTTP_PORT:-8788}"
BIND="${BIND:-127.0.0.1}"
ALLOWED_ORIGINS="${ALLOWED_ORIGINS:-}"

if [[ ! -f "$JAR" ]]; then
  echo "ERROR: proxy jar not found: $JAR" >&2
  exit 1
fi
if [[ ! -d "$WEB_DIR" ]]; then
  echo "ERROR: web dir not found: $WEB_DIR (copy the contents of web/dist here)" >&2
  exit 1
fi
if [[ -z "$ALLOWED_ORIGINS" ]]; then
  echo "WARNING: ALLOWED_ORIGINS is empty — the proxy only accepts localhost origins." >&2
  echo "         Set it to your public web origin, e.g. ALLOWED_ORIGINS=http://abc.playit.gg:12345" >&2
fi

exec java \
  --add-opens=java.base/java.io=ALL-UNNAMED \
  --add-opens=java.base/java.util=ALL-UNNAMED \
  --add-opens=java.base/java.lang=ALL-UNNAMED \
  --add-opens=java.base/java.lang.reflect=ALL-UNNAMED \
  --add-opens=java.base/java.text=ALL-UNNAMED \
  -cp "$JAR" org.mage.proxy.Main \
  --host "$XMAGE_HOST" --port "$XMAGE_PORT" \
  --wsPort "$WS_PORT" --httpPort "$HTTP_PORT" \
  --bind "$BIND" --webDir "$WEB_DIR" \
  --allowedOrigins "$ALLOWED_ORIGINS"
