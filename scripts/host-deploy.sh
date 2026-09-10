#!/usr/bin/env bash
# XMage Nexus — host update ("Model A"): pull, rebuild, restart the service.
# Run this ON the host machine (the one running xmage-proxy.service).
#
# Usage:  scripts/host-deploy.sh
#
# Optional env overrides:
#   REPO=/path/to/repo      SERVICE=xmage-proxy      PROXY_LINK=~/xmage-proxy.jar
#   JAVA_HOME=/path/to/jdk  MVN_BIN_DIR=/path/to/maven/bin  NVM_DIR=~/.nvm
#
# The web login defaults are read from web/.env.production.local (Vite) if present.
set -euo pipefail

REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SERVICE="${SERVICE:-xmage-proxy}"
PROXY_LINK="${PROXY_LINK:-$HOME/xmage-proxy.jar}"

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

if ! command -v npm >/dev/null 2>&1 && [[ -s "${NVM_DIR:-$HOME/.nvm}/nvm.sh" ]]; then
  export NVM_DIR="${NVM_DIR:-$HOME/.nvm}"
  . "$NVM_DIR/nvm.sh"
fi
command -v node >/dev/null || { echo "ERROR: node not found" >&2; exit 1; }
command -v npm  >/dev/null || { echo "ERROR: npm not found"  >&2; exit 1; }

cd "$REPO"

echo "[host-deploy] == git pull =="
git pull --ff-only

echo "[host-deploy] == build (engine + plugins + proxy) =="
node scripts/build.mjs

echo "[host-deploy] == web build =="
[[ -f web/.env.production.local ]] || echo "[host-deploy] WARNING: web/.env.production.local missing (login won't be pre-filled)" >&2
npm --prefix web install --no-audit --no-fund
npm --prefix web run build

echo "[host-deploy] == refresh jar symlink =="
jar="$(ls -1 "$REPO"/Mage.Proxy/target/mage-proxy-*.jar 2>/dev/null | head -1 || true)"
[[ -n "$jar" ]] || { echo "ERROR: proxy jar not found under Mage.Proxy/target/" >&2; exit 1; }
ln -sfn "$jar" "$PROXY_LINK"
echo "[host-deploy]   $PROXY_LINK -> $jar"

echo "[host-deploy] == restart service =="
sudo systemctl restart "$SERVICE"
sleep 3
systemctl --no-pager --lines=8 status "$SERVICE" || true
echo "[host-deploy] done"
