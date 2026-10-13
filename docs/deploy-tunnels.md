# Deploying XMage Nexus (multi-user web service)

This guide sets up one always-on machine (your "host machine") that runs a single
`Mage.Proxy` process and exposes it to the internet through three **Cloudflare quick
tunnels** (`cloudflared tunnel --url`, no account, no domain, free). Players open a
web page in their browser and play against `beta.xmage.today` — no installation, no
Java, no port forwarding.

> Historical note: this used to be playit.gg (see git history of this file). playit
> was retired on 2026-10-13 (subscription lapsed); its free-tier TCP limitation was
> the original reason for the paid tier — Cloudflare quick tunnels have no such limit.

## Architecture

```
Player's browser
   │  https://<web-tunnel>.trycloudflare.com     (loads the web client)
   │  wss://<ws-tunnel>.trycloudflare.com        (game connection)
   ▼
Cloudflare edge (quick tunnels, run as user systemd units with linger)
   ▼
Mage.Proxy  (your host machine, one process per flavor, many sessions)
   ├── HTTP :8788   serves the web client (web/dist)
   └── WS   :8787   WebSocket gateway (1 connection = 1 XMage session)
   ├── (xdhs flavor: WS :8797, second proxy unit)
   ▼
beta.xmage.today:17171   (the real XMage rules engine)
```

There is **only one process to run** (`Mage.Proxy`) plus the three `cloudflared`
user units. You do **not** run an XMage server on the host machine.

## The one big caveat: quick-tunnel hostnames rotate

Every start of a `cloudflared tunnel --url` process mints a NEW
`<random>.trycloudflare.com` hostname. Everything that bakes a hostname in must
follow along:

1. `web/.env.production.local` on the host (client build defaults),
2. the rebuilt `web/dist` (the WS URL is baked into the JS bundle),
3. `site/content.json` + `site/status.json` `playUrl` (GitHub Pages invitation link),
4. `--allowedOrigins` of the proxy system units.

`scripts/tunnel-sync.mjs` automates 1–3 and prints the exact sudo commands for 4:

```bash
node scripts/tunnel-sync.mjs --check   # report drift only
node scripts/tunnel-sync.mjs           # rewrite + rebuild + fix site
```

Run it after every reboot or tunnel restart, then commit/push `site/*.json`.
Tunnels run as **user units with linger** (`loginctl enable-linger <user>`), so they
survive SSH logouts and reboots with `Restart=always`. Without linger they die with
your SSH session — this bit us once: the hostnames rotated on every command.

If rotating hostnames ever become unacceptable, the upgrade path is a **named
Cloudflare tunnel**, which needs a domain (~3–10 €/year) and gives a permanent
hostname for free. Until then, the invitation link on GitHub Pages is the stable
URL players know; the tunnel hostnames are an implementation detail.

## Prerequisites

- A machine that stays on (no sleep), with a modern **JRE 17** (`java -version`)
  and the `cloudflared` binary (in `~/bin` on the production host).
- A user with **linger** enabled and the three units from Part 3.
- Two files built from this repo (see Part 1): `mage-proxy-1.4.62.jar` and the
  `web/dist` folder.

## Part 1 — Build the artifacts (on your dev machine)

The host machine only needs a JRE — do the build here and copy the result.

```bash
# 1. Proxy (fat jar, runs standalone). Skip if Mage.Proxy/target/*.jar already exists.
node scripts/build.mjs proxy

# 2. Web client, with the login pre-filled so players only type user/password.
#    Replace the tunnel values with the live ones (scripts/tunnel-sync.mjs
#    rewrites this file and rebuilds automatically).
VITE_DEFAULT_PROXY_HOST=wss://<ws-tunnel>.trycloudflare.com \
VITE_DEFAULT_PROXY_PORT=443 \
VITE_DEFAULT_SERVER_HOST=beta.xmage.today \
VITE_DEFAULT_SERVER_PORT=17171 \
npm --prefix web run build
```

(See the git history of this file for the old playit.gg and Windows PowerShell
variants.)

## Part 2 — Copy to the host

```bash
rsync -a web/dist/ HOST:~/Escritorio/xmage-nexus/web/dist/
scp Mage.Proxy/target/mage-proxy-1.4.62.jar HOST:~/
```

Keep `~/xmage-proxy.jar` (and `~/xmage-proxy-xdhs.jar` for the XDHS flavor) as
**symlinks** to `~/Escritorio/xmage-nexus/Mage.Proxy/target/mage-proxy-*.jar` —
after a rebuild with a bumped version the symlink silently breaks
(`ClassNotFoundException: org.mage.proxy.Main` in a systemd auto-restart loop);
re-point it with `ln -sfn`.

## Part 3 — Tunnels as user units

On the host, for each port (`ws 8787`, `web 8788`, `xdhs 8797`):

```ini
# ~/.config/systemd/user/cloudflared-web.service  (etc.)
[Unit]
Description=Cloudflare quick tunnel (web -> 127.0.0.1:8788)
After=network-online.target

[Service]
ExecStart=%h/bin/cloudflared tunnel --url http://127.0.0.1:8788 --logfile %h/cloudflared-logs/web.log
Restart=always
RestartSec=5

[Install]
WantedBy=default.target
```

```bash
systemctl --user daemon-reload
systemctl --user enable --now cloudflared-ws cloudflared-web cloudflared-xdhs
sudo loginctl enable-linger $USER     # REQUIRED: without it the units die on SSH logout
```

Read the live hostnames from the journals:

```bash
journalctl --user -u cloudflared-web --no-pager | grep -oE 'https://[a-z0-9-]+\.trycloudflare\.com' | tail -1
```

## Part 4 — Proxy system units

`/etc/systemd/system/xmage-proxy.service` (and `-xdhs`) run the jar with
`--allowedOrigins https://<web-tunnel>.trycloudflare.com`. This must match the
hostname players' browsers use, or the WebSocket is rejected by CORS. After a
hostname rotation:

```bash
sudo sed -i 's|<old-web-hostname>|<new-web-hostname>|' \
  /etc/systemd/system/xmage-proxy.service /etc/systemd/system/xmage-proxy-xdhs.service
sudo systemctl daemon-reload && sudo systemctl restart xmage-proxy xmage-proxy-xdhs
```

(`scripts/tunnel-sync.mjs` prints these exact commands with the current values.)

## Part 5 — Status dashboard

`ops/status/README.md` covers `xmage-status` (LAN-only, port 8790, never tunnelled):

```bash
ops/status/deploy.sh    # asks for the sudo password once
```

## Verification

```bash
curl -s -o /dev/null -w '%{http_code}\n' https://<web-tunnel>.trycloudflare.com/   # 200
node -e "new WebSocket('wss://<ws-tunnel>.trycloudflare.com').onopen=()=>{console.log('ok');process.exit(0)}"
```