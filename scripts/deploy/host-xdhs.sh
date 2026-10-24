#!/usr/bin/env bash
# XDHS flavor update for the always-on host machine: builds the second proxy
# (compiled against the xenohedron fork) and restarts xmage-proxy-xdhs.
# The beta proxy (xmage-proxy.service, its jar and its symlink) is never restarted
# or relinked. Its build output in Mage.Proxy/target/ is wiped by every beta build
# (`build.mjs proxy` runs `mvn clean`), so the XDHS jar is served from RUN_DIR.
#
# Run it ON the host (the one running xmage-proxy.service).
#
# Usage: scripts/deploy/host-xdhs.sh [XDHS_TAG]
#
# Env overrides:
#   REPO=/path/to/repo            XDHS_DIR=~/Escritorio/xmage-xdhs
#   XDHS_VERSION=1.6.1            SERVICE=xmage-proxy-xdhs
#   PROXY_LINK=~/xmage-proxy-xdhs.jar
#   WS_PORT=8797  HTTP_PORT=8798  BIND=127.0.0.1  READY_TIMEOUT=60
#   ALLOWED_ORIGINS=https://<web-origin>  (required: exact origin of the web page)
#   JAVA_HOME=/path/to/jdk  MVN_BIN_DIR=/path/to/maven/bin  NVM_DIR=~/.nvm
set -euo pipefail

REPO="${REPO:-$HOME/Escritorio/xmage-nexus}"
XDHS_DIR="${XDHS_DIR:-$HOME/Escritorio/xmage-xdhs}"
XDHS_TAG="${1:-1.6.1-XDHS-r2}"
XDHS_VERSION="${XDHS_VERSION:-${XDHS_TAG%%-*}}"
SERVICE="${SERVICE:-xmage-proxy-xdhs}"
PROXY_LINK="${PROXY_LINK:-$HOME/xmage-proxy-xdhs.jar}"
RUN_DIR="${RUN_DIR:-$HOME/Escritorio/xmage-xdhs-run}"
WS_PORT="${WS_PORT:-8797}"
HTTP_PORT="${HTTP_PORT:-8798}"
READY_TIMEOUT="${READY_TIMEOUT:-60}"
BIND="${BIND:-127.0.0.1}"
ALLOWED_ORIGINS="${ALLOWED_ORIGINS:?set ALLOWED_ORIGINS to the exact web origin the proxy serves, e.g. https://example.trycloudflare.com}"
RUN_USER="$(id -un)"

if [[ -z "${JAVA_HOME:-}" ]]; then
  for d in "$HOME"/apps/jdk-17* "$HOME"/apps/jdk17; do
    [[ -x "$d/bin/java" ]] && { JAVA_HOME="$d"; break; }
  done
fi
if [[ -z "${MVN_BIN_DIR:-}" ]]; then
  for d in "$HOME"/apps/apache-maven-*/bin "$HOME"/apps/maven/bin; do
    [[ -x "$d/mvn" ]] && { MVN_BIN_DIR="$d"; break; }
  done
fi
export JAVA_HOME="${JAVA_HOME:?JAVA_HOME not found (set JAVA_HOME or install JDK 17 under ~/apps)}"
export PATH="$JAVA_HOME/bin:${MVN_BIN_DIR:-}:$PATH"
command -v curl >/dev/null || { echo "ERROR: curl not found" >&2; exit 1; }

cd "$REPO"

echo "[xdhs] == fork $XDHS_TAG =="
if [[ ! -d "$XDHS_DIR/.git" ]]; then
  git clone https://github.com/xenohedron/mage "$XDHS_DIR"
fi
git -C "$XDHS_DIR" fetch --tags --force
git -C "$XDHS_DIR" checkout -f "$XDHS_TAG"
git -C "$XDHS_DIR" clean -fd
for p in "$REPO"/patches/xdhs/*.patch; do
  echo "[xdhs] applying $(basename "$p")"
  git -C "$XDHS_DIR" apply "$p"
done

echo "[xdhs] == engine artifacts $XDHS_VERSION -> ~/.m2 =="
mvn -q -f "$XDHS_DIR/pom.xml" -pl Mage.Common,Mage,Mage.Sets,Mage.Server.Plugins/Mage.Deck.Constructed -am install -DskipTests

echo "[xdhs] == proxy build (in a copy: keep the beta jar in Mage.Proxy/target) =="
BUILD="$(mktemp -d)"
trap 'rm -rf "$BUILD"' EXIT
mkdir -p "$BUILD/Mage.Proxy"
cp "$REPO/Mage.Proxy/pom.xml" "$BUILD/Mage.Proxy/"
cp -R "$REPO/Mage.Proxy/src" "$BUILD/Mage.Proxy/src"
mvn -q -f "$BUILD/Mage.Proxy/pom.xml" -Dmage.version="$XDHS_VERSION" clean package -DskipTests
mkdir -p "$REPO/Mage.Proxy/target" "$RUN_DIR"
cp "$BUILD/Mage.Proxy/target/mage-proxy-$XDHS_VERSION.jar" "$REPO/Mage.Proxy/target/"
JAR="$RUN_DIR/mage-proxy-$XDHS_VERSION.jar"
cp "$BUILD/Mage.Proxy/target/mage-proxy-$XDHS_VERSION.jar" "$JAR"
ln -sfn "$JAR" "$PROXY_LINK"
echo "[xdhs]   $PROXY_LINK -> $JAR"

UNIT_FILE="/etc/systemd/system/$SERVICE.service"
TMP_UNIT="$(mktemp)"
cat > "$TMP_UNIT" <<EOF
[Unit]
Description=XMage Nexus proxy (XDHS flavor, mage.xdhs.net)
Wants=network-online.target
After=network-online.target

[Service]
Type=simple
User=$RUN_USER
WorkingDirectory=$RUN_DIR
ExecStart=$JAVA_HOME/bin/java --add-opens=java.base/java.io=ALL-UNNAMED --add-opens=java.base/java.util=ALL-UNNAMED --add-opens=java.base/java.lang=ALL-UNNAMED --add-opens=java.base/java.lang.reflect=ALL-UNNAMED --add-opens=java.base/java.text=ALL-UNNAMED -cp $PROXY_LINK org.mage.proxy.Main --host mage.xdhs.net --port 17171 --wsPort $WS_PORT --httpPort $HTTP_PORT --bind $BIND --webDir $REPO/web/dist --allowedOrigins $ALLOWED_ORIGINS
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
EOF
if ! cmp -s "$TMP_UNIT" "$UNIT_FILE"; then
  echo "[xdhs] == install $SERVICE unit =="
  sudo install -m 644 "$TMP_UNIT" "$UNIT_FILE"
  sudo systemctl daemon-reload
  sudo systemctl enable "$SERVICE"
fi
rm -f "$TMP_UNIT"

echo "[xdhs] == restart $SERVICE =="
sudo systemctl restart "$SERVICE"
echo "[xdhs] waiting up to ${READY_TIMEOUT}s for $SERVICE (http://127.0.0.1:$HTTP_PORT/ready) =="
ready=0
for ((i = 0; i < READY_TIMEOUT; i += 2)); do
  if systemctl is-active --quiet "$SERVICE" && curl -sf --max-time 2 "http://127.0.0.1:$HTTP_PORT/ready" -o /dev/null; then
    ready=1
    break
  fi
  sleep 2
done
if [[ "$ready" -ne 1 ]]; then
  echo "ERROR: $SERVICE is not ready after ${READY_TIMEOUT}s; last journal lines:" >&2
  sudo journalctl -u "$SERVICE" -n 40 --no-pager >&2 || true
  exit 1
fi
systemctl --no-pager --lines=8 status "$SERVICE" || true
echo "[xdhs] done ($XDHS_TAG)"
