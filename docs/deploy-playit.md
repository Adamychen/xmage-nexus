# Deploying XMage Nexus (multi-user web service)

This guide sets up one always-on machine (your "host machine") that runs a single
`Mage.Proxy` process and exposes it to the internet through [playit.gg](https://playit.gg).
Players open a web page in their browser and play against `beta.xmage.today` — no
installation, no Java, no port forwarding.

## Architecture

```
Player's browser
   │  http://<web-tunnel>      (loads the web client)
   │  ws://<ws-tunnel>         (game connection)
   ▼
playit.gg tunnel (public address, handled by the playit agent)
   ▼
Mage.Proxy  (your host machine, one process, many sessions)
   ├── HTTP :8788   serves the web client (web/dist)
   └── WS   :8787   WebSocket gateway (1 connection = 1 XMage session)
   ▼
beta.xmage.today:17171   (the real XMage rules engine)
```

There is **only one process to run** (`Mage.Proxy`) plus the playit agent.
You do **not** run an XMage server on the host machine.

## Prerequisites

- A machine that stays on (no sleep), with a modern **JRE 17** (`java -version`).
- A [playit.gg](https://playit.gg) account with the **playit agent** installed on
  that machine. Custom **TCP** tunnels (what this guide needs) require the paid
  playit tier — the free tier only allows UDP + the Minecraft preset.
- Two files built from this repo (see Part 1): `mage-proxy-1.4.61.jar` and the
  `web/dist` folder.

## Part 1 — Build the artifacts (on your dev machine)

The host machine only needs a JRE — do the build here and copy the result.

```bash
# 1. Proxy (fat jar, runs standalone). Skip if Mage.Proxy/target/*.jar already exists.
node scripts/build.mjs proxy

# 2. Web client, with the login pre-filled so players only type user/password.
#    Replace the tunnel values with the ones you get in Part 2 (you can build
#    again later once the tunnels exist).
VITE_DEFAULT_PROXY_HOST=<ws-tunnel-host> \
VITE_DEFAULT_PROXY_PORT=<ws-tunnel-port> \
VITE_DEFAULT_SERVER_HOST=beta.xmage.today \
VITE_DEFAULT_SERVER_PORT=17171 \
npm --prefix web run build
```

Windows PowerShell equivalent for step 2:

```powershell
$env:VITE_DEFAULT_PROXY_HOST="<ws-tunnel-host>"
$env:VITE_DEFAULT_PROXY_PORT="<ws-tunnel-port>"
$env:VITE_DEFAULT_SERVER_HOST="beta.xmage.today"
$env:VITE_DEFAULT_SERVER_PORT="17171"
npm --prefix web run build
```

> Tip: if you don't know the tunnel address yet, build now without the `VITE_*`
> variables and let players type the proxy host/port in the login screen.

## Part 2 — Create the playit tunnels

1. Install the playit agent on the host machine and log in.
2. In the playit dashboard, click **Add Tunnel** and create a **TCP** tunnel:
   - Local address: `127.0.0.1`
   - Local port: `8788`
   - Save the **public address** it assigns (e.g. `abc.playit.gg:12345`). This is
     your **web tunnel**.
3. Create a second **TCP** tunnel:
   - Local address: `127.0.0.1`
   - Local port: `8787`
   - Save the public address. This is your **ws tunnel**.

You end up with two public `host:port` pairs. The **origin** of your web page is
`http://<web-tunnel>` — you will need it in Part 4.

> Alternative: use a single tunnel by running a local reverse proxy (Caddy) that
> serves `web/dist` and forwards the WebSocket on the same port. Two tunnels is
> simpler and needs no extra software.

## Part 3 — Copy the bundle to the host machine

Assemble the bundle (jar + web client + scripts + this guide) into `deploy/bundle/`:

```bash
node scripts/deploy-bundle.mjs
```

Then copy the `deploy/bundle/` folder to the host machine as `xmage-host/`. It contains:

```
xmage-host/
  mage-proxy-1.4.61.jar        # from Mage.Proxy/target/
  web-dist/                    # copy the CONTENTS of web/dist here
  start-proxy.sh               # included in the bundle (Linux/macOS)
  start-proxy.bat              # included in the bundle (Windows)
```

## Part 4 — Run the proxy

Set `ALLOWED_ORIGINS` to your **web tunnel origin** (scheme + host + port). Without
it the proxy only accepts localhost origins and the WebSocket will be rejected.

Linux / macOS:

```bash
ALLOWED_ORIGINS="http://<web-tunnel>" \
XMAGE_HOST=beta.xmage.today XMAGE_PORT=17171 \
WS_PORT=8787 HTTP_PORT=8788 WEB_DIR=./web-dist \
./start-proxy.sh
```

Windows:

```bat
set ALLOWED_ORIGINS=http://<web-tunnel>
set XMAGE_HOST=beta.xmage.today
set XMAGE_PORT=17171
set WS_PORT=8787
set HTTP_PORT=8788
set WEB_DIR=web-dist
start-proxy.bat
```

You should see:

```
[proxy] XMage proxy started
[proxy]   websocket gateway : ws://127.0.0.1:8787/
[proxy]   test page         : http://127.0.0.1:8788/index.html
[proxy]   multi-tenant     : each WebSocket connection = its own XMage session
```

## Part 5 — Run the playit agent

Start the playit agent on the same machine. It connects to `127.0.0.1:8788` and
`127.0.0.1:8787` (as configured in Part 2) and makes them reachable publicly.

## Part 6 — Share the URL

Give players `http://<web-tunnel>`. Each player needs an account on
`beta.xmage.today`. If you built the client with the `VITE_*` variables in Part 1,
the login screen is already pointed at your tunnels and they only enter
user/password.

## Alternative — host builds from the repo (clone + rebuild)

Instead of the prebuilt bundle (Parts 1–5), the host can keep a clone of this
repository and rebuild in place. Handy when you want a single
`git pull && rebuild` workflow, but the host then needs the full toolchain
(JDK 17 + Maven + Node) and the first build is heavy (it compiles the XMage
engine and card sets).

One-time setup on the host:

```bash
git clone https://github.com/Adamychen/xmage-nexus.git
cd xmage-nexus

cat > web/.env.production.local <<'EOF'
VITE_DEFAULT_PROXY_HOST=<ws-tunnel-host>
VITE_DEFAULT_PROXY_PORT=<ws-tunnel-port>
VITE_DEFAULT_SERVER_HOST=beta.xmage.today
VITE_DEFAULT_SERVER_PORT=17171
EOF

node scripts/build.mjs                 # engine + plugins + proxy jar
npm --prefix web install && npm --prefix web run build
ln -sf "$PWD/Mage.Proxy/target/mage-proxy-1.4.61.jar" ~/xmage-proxy.jar
```

Create `/etc/systemd/system/xmage-proxy.service` pointing at the stable symlink:

```ini
[Unit]
Description=XMage Nexus proxy
Wants=network-online.target
After=network-online.target

[Service]
Type=simple
User=<your-user>
WorkingDirectory=/home/<your-user>/xmage-nexus
ExecStart=/path/to/jdk-17/bin/java --add-opens=java.base/java.io=ALL-UNNAMED --add-opens=java.base/java.util=ALL-UNNAMED --add-opens=java.base/java.lang=ALL-UNNAMED --add-opens=java.base/java.lang.reflect=ALL-UNNAMED --add-opens=java.base/java.text=ALL-UNNAMED -cp /home/<your-user>/xmage-proxy.jar org.mage.proxy.Main --host beta.xmage.today --port 17171 --wsPort 8787 --httpPort 8788 --bind 127.0.0.1 --webDir /home/<your-user>/xmage-nexus/web/dist --allowedOrigins http://<web-tunnel>
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl enable --now xmage-proxy
```

Update to a new release with the helper — it pulls, rebuilds engine + web,
refreshes the jar symlink and restarts the service:

```bash
scripts/host-deploy.sh
```

> **Laptop as host:** disable suspend so it survives a closed lid. Set
> `HandleLidSwitch=ignore` (plus `HandleLidSwitchExternalPower` / `Docked`) in
> `/etc/systemd/logind.conf`, restart `systemd-logind`, then mask
> `sleep.target suspend.target hibernate.target hybrid-sleep.target`.

## Autostart

Keep the proxy and the playit agent running automatically:

- **Linux (systemd)** — create `/etc/systemd/system/xmage-proxy.service`:

  ```ini
  [Unit]
  Description=XMage Nexus proxy
  After=network-online.target

  [Service]
  WorkingDirectory=/path/to/xmage-host
  Environment=ALLOWED_ORIGINS=http://<web-tunnel>
  Environment=WEB_DIR=./web-dist
  ExecStart=/path/to/xmage-host/start-proxy.sh
  Restart=always

  [Install]
  WantedBy=multi-user.target
  ```

  Then `sudo systemctl enable --now xmage-proxy`. Install the playit agent as a
  service too (its installer offers this).

- **Windows** — Task Scheduler → "Create Task" → trigger "At startup", action
  "Start a program" → `start-proxy.bat`. Set the env vars in a wrapper `.bat` or
  in the task. Install the playit agent as a service.

- **macOS** — a `launchd` `LaunchAgent`/`LaunchDaemon` running `start-proxy.sh`,
  and the playit agent's own service.

Also make sure the machine does not sleep (power settings) and restarts the
processes on reboot.

## Troubleshooting

| Symptom | Cause / fix |
|---|---|
| Public page loads but the game never connects | `ALLOWED_ORIGINS` missing or wrong. It must be exactly the page origin, e.g. `http://abc.playit.gg:12345`. |
| `MAGE_VERSION_RELEASE_INFO_MUST_BE_SAME` in the proxy log | `beta.xmage.today` moved to a new XMage release. Rebuild with the matching fork (`node scripts/build.mjs`) and restart. |
| Login is intermittent / `Can't receive server state before other data` | Known server-side handshake issue on `beta.xmage.today`. Retry; the local server is the reliable oracle for testing. |
| Port already in use | Another `ctl.mjs`/`dev.mjs` instance or process is using 8787/8788. Stop it or change `WS_PORT`/`HTTP_PORT`. |
| WebSocket rejected with `origin not allowed` | `ALLOWED_ORIGINS` does not match the browser's `Origin` header (scheme included). |
| Client cannot connect from an `https://` page | The web client currently uses `ws://` only; serve the client over `http://` (as in this guide) or add `wss://` support. |

## Notes

- **No secrets on the wire?** XMage's own client↔server protocol is not encrypted
  either, so a plain `ws://` hop to the proxy does not change the exposure of
  credentials compared to the official desktop client. If you want TLS, you need
  playit Premium + Caddy (HTTPS tunnel) **and** a small change in
  `web/src/state/gateway.ts` to use `wss://` on an HTTPS page.
- **Version pinning** — the proxy is built for XMage `1.4.61-V1`. It only connects
  to a server on the same release. When the target server updates, rebuild.
- **Resource usage** — one `Mage.Proxy` process serves many players (multi-tenant).
  It already limits message size/rate per connection; consider your machine's CPU
  and the playit tier for bandwidth.
- **Legal** — nothing is redistributed here; players connect to the existing
  `beta.xmage.today` server with their own accounts.
