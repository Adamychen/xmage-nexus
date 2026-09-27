#!/bin/sh
set -eu

HOST="${1:-adam@192.168.1.225}"
DIR="$(cd "$(dirname "$0")" && pwd)"

ssh "$HOST" 'mkdir -p ~/xmage-status/data ~/xmage-status/public'
scp -q "$DIR/server.mjs" "$DIR/xmage-status.service" "$HOST:xmage-status/"
scp -q "$DIR"/public/* "$HOST:xmage-status/public/"
ssh -t "$HOST" 'sudo install -m 644 ~/xmage-status/xmage-status.service /etc/systemd/system/xmage-status.service \
  && sudo systemctl daemon-reload \
  && sudo systemctl enable xmage-status \
  && sudo systemctl restart xmage-status \
  && systemctl --no-pager --lines=5 status xmage-status'
