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

## Dashboard (GitHub Pages, zero-build static `site/`)

- `site/content.json` — canonical dashboard copy (project, phases, features, guards). Keep in sync with `PROJECT.md`/`ROADMAP.md`.
- `scripts/gen-dashboard.mjs` — merges `content.json` + test artefacts → `site/status.json`.
- `scripts/dashboard-ci.mjs` — lightweight CI layers for Pages pushes.
- `scripts/integration-report.mjs` — nightly real-stack (self-test/human-test/e2e-real) → `reports/integration-result.json`.
- Workflow `.github/workflows/pages.yml`: push = light layers, nightly cron = + integration. Pages **source must be "GitHub Actions"** (repo Settings → Pages).
