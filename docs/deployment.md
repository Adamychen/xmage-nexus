# Deployment — stack, logs, builds, dashboard

## Stack control

- `node scripts/ctl.mjs start|stop|restart|status [server|proxy|vite|all]` — normal control (non-blocking).
- `node scripts/dev.mjs start|stop|status|restart` — direct diagnostics (blocks the shell).
- `node scripts/tail.mjs [server|proxy|vite|all] [lines]` — log reader. Files in `.run/*.log` (`server.out.log`, `proxy.out.log`, `proxy.err.log`, `vite.out.log`, `*.pid`).
- Restarting `server` also restarts `proxy` (stale JBoss Remoting sessions corrupt the bridge). Never restart only the proxy to fix a login hang; restart all.

## Ports

XMage `17171` (testMode) · proxy WS `8787` · proxy HTTP page `8788/index.html` · Vite `5173` · fake E2E `8789` + Vite `5175`. The proxy test page owns 8788 whenever the stack is up; fake mode never uses it.

## Builds

- `node scripts/build.mjs proxy` — proxy jar only (requires the fork in `~/.m2` once per XMage release; stops the proxy itself first for the Windows lock). Output: `Mage.Proxy/target/mage-proxy-1.4.61.jar`. Afterwards `node scripts/ctl.mjs restart proxy`.
- `node scripts/build.mjs` — full (server + plugins + proxy; copies plugins to `local-server/plugins/`).
- `node scripts/install.mjs` — zero-setup from scratch (Maven build + plugins + npm install), then `ctl.mjs start` + `test.mjs`.
- Requirements: JDK 17 (Homebrew `openjdk@17`; `/usr/bin/java` stub breaks daemons — `scripts/lib.mjs` resolves the real binary), Maven 3.9, Node 20+. Server and proxy must run with `--add-opens=java.base/java.io=ALL-UNNAMED` (jboss-serialization on JDK 17).
- XMage version `1.4.61-V1` (upstream tag `xmage_1.4.61V1`). Release bumps are a one-line pom change + recompile, but strict version checks mean a mismatched server rejects the proxy. Default target server: `beta.xmage.today:17171`.

## Second flavor: XDHS (`mage.xdhs.net`)

The proxy is also built against the xenohedron fork (XDHS server, tag
`1.5.8-XDHS-r1`) so both servers can be served side by side. One web build,
two proxy processes:

- Build: `patches/xdhs/*.patch` are applied to a `xenohedron/mage` checkout,
  then `mvn -Dmage.version=1.5.8`. `Mage.Proxy/pom.xml` takes the XMage
  dependency version from the `mage.version` property. See
  `patches/xdhs/README.md`.
- Launcher: the `proxy-xdhs` component (CI job `proxy-xdhs` in
  `modules.yml`) is started by the Tauri shell as a second proxy instance on
  ports 8797/8798 with its own card database (`proxy-xdhs/` under the data
  dir). The web login has an "XDHS" preset; everything else is shared.
- Host: `scripts/deploy/host-xdhs.sh` builds and restarts
  `xmage-proxy-xdhs.service` (first run installs the unit). The beta jar,
  symlink and service are untouched.

## Public multi-user deployment (playit.gg)

See **`docs/deploy-playit.md`** for the full English guide: run one `Mage.Proxy`
(multi-tenant) on an always-on machine, expose its two ports through playit.gg
TCP tunnels, and point it at `beta.xmage.today`. Bundle it with
`node scripts/deploy-bundle.mjs`; start scripts live in `scripts/deploy/`
(`start-proxy.sh` for Linux/macOS, `start-proxy.bat` for Windows).

## Host status dashboard (LAN only)

`ops/status/` is a dependency-free Node service (`xmage-status.service`) that runs next to the proxy on the
host and serves `http://<host-lan-ip>:8790/`: players online, history/statistics, proxy and playit logs, host
metrics and restarts, indexed from `journalctl -u xmage-proxy` and `/var/log/playit/playit.log` into SQLite.
It has no playit tunnel and rejects every non-LAN client, loopback included (playit visitors arrive as `127.x`).
Deploy/update with `ops/status/deploy.sh` (never restarts the proxy). Details: `ops/status/README.md`.

## Dashboard (GitHub Pages, zero-build static `site/`)

- `site/content.json` — canonical dashboard copy (project, phases, features, guards). Keep in sync with `ROADMAP.md`.
- `scripts/gen-dashboard.mjs` — merges `content.json` + test artefacts → `site/status.json`.
- `scripts/dashboard-ci.mjs` — lightweight CI layers for Pages pushes.
- `scripts/integration-report.mjs` — nightly real-stack (self-test/human-test/e2e-real) → `reports/integration-result.json`.
- Workflow `.github/workflows/pages.yml`: push = light layers, nightly cron = + integration. Pages **source must be "GitHub Actions"** (repo Settings → Pages).
