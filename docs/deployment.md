# Deployment — stack, logs, builds, dashboard

## Stack control

- `node scripts/ctl.mjs start|stop|restart|status [server|proxy|vite|all]` — normal control (non-blocking).
- `node scripts/dev.mjs start|stop|status|restart` — direct diagnostics (blocks the shell).
- `node scripts/tail.mjs [server|proxy|vite|all] [lines]` — log reader. Files in `.run/*.log` (`server.out.log`, `proxy.out.log`, `proxy.err.log`, `vite.out.log`, `*.pid`).
- Restarting `server` also restarts `proxy` (stale JBoss Remoting sessions corrupt the bridge). Never restart only the proxy to fix a login hang; restart all.

## Ports

XMage `17171` (testMode) · proxy WS `8787` · proxy HTTP page `8788/index.html` · Vite `5173` · fake E2E `8789` + Vite `5175`. The proxy test page owns 8788 whenever the stack is up; fake mode never uses it.

## Builds

- `node scripts/build.mjs proxy` — proxy jar only (requires the fork in `~/.m2` once per XMage release; stops the proxy itself first for the Windows lock). Output: `Mage.Proxy/target/mage-proxy-1.4.63.jar`. Afterwards `node scripts/ctl.mjs restart proxy`.
- `node scripts/build.mjs` — full (server + plugins + proxy; copies plugins to `local-server/plugins/`).
- `node scripts/install.mjs` — zero-setup from scratch (Maven build + plugins + npm install), then `ctl.mjs start` + `test.mjs`.
- Requirements: JDK 17 (Homebrew `openjdk@17`; `/usr/bin/java` stub breaks daemons — `scripts/lib.mjs` resolves the real binary), Maven 3.9, Node 20+ for the web client and the scripts (**Node ≥24 for `mcp/`**, which runs TypeScript directly via native type stripping). Server and proxy must run with `--add-opens=java.base/java.io=ALL-UNNAMED` (jboss-serialization on JDK 17).
- XMage version `1.4.63-V1` (upstream tag `xmage_1.4.63V1`). Release bumps are a one-line pom change + recompile, but strict version checks mean a mismatched server rejects the proxy. Default target server: `beta.xmage.today:17171`.

## Second flavor: XDHS (`mage.xdhs.net`)

The proxy is also built against the xenohedron fork (XDHS server, tag
`1.6.1-XDHS-r2`) so both servers can be served side by side. One web build,
two proxy processes:

- Build: `patches/xdhs/*.patch` are applied to a `xenohedron/mage` checkout,
  then `mvn -Dmage.version=1.6.1`. `Mage.Proxy/pom.xml` takes the XMage
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

See **`docs/deploy-tunnels.md`** for the full English guide: run one `Mage.Proxy`
(multi-tenant) on an always-on machine, expose its two ports through playit.gg
TCP tunnels, and point it at `beta.xmage.today`. Bundle it with
`node scripts/deploy-bundle.mjs`; start scripts live in `scripts/deploy/`
(`start-proxy.sh` for Linux/macOS, `start-proxy.bat` for Windows).

## Production deploy (`.github/workflows/deploy.yml`)

The project's own server is updated by a self-hosted runner (labels `self-hosted, xmage-nexus`) that runs
`~/deploy-xmage.sh` (it lives on the server, not in the repo: it pulls `master` and rebuilds proxy and web)
and then restarts `xmage-proxy.service`.

- **Only a version bump deploys.** The trigger is a push to `master` that touches `web/package.json`, and the
  `gate` job then compares the version of the pushed commit with the one in its first parent (`fetch-depth: 2`,
  `git show HEAD~1:web/package.json`). The path filter alone would not do: a dependency change touches the same
  file and must not reach players. A `workflow_dispatch` run deploys without the gate, for a hotfix.
- **The gate reads the head commit against `HEAD~1`**, so a bump that lands on `master` as a merge commit or as
  a squash is seen. The one case it misses is a direct push of several commits with the bump in the middle: the
  head commit and its parent already carry the new version, so nothing deploys. Run the workflow by hand then.
- **Two bumps inside one deploy lose the middle release.** `concurrency: deploy` keeps at most one run waiting,
  so if a second bump lands while a deploy is running and a third follows it, GitHub cancels the one in the middle:
  its code still reaches the server with the next deploy, but its release is never created and the bell never shows
  that version. The deploy takes about half a minute, so it takes two bumps inside the same minute. The way back is
  `gh release create v<version> --prerelease --notes-file docs/release-notes/<version>.md`; the `release` job
  leaves a tag that already exists alone, so nothing collides afterwards.
- **The job that runs on the server keeps a read-only token** (`contents: read`, spelled out in the job), and the
  workflow never gains a `pull_request` trigger: a pull request from a fork would otherwise run code on the host.
  `concurrency: deploy` with `cancel-in-progress: false` keeps two deploys from overlapping and never cuts one
  halfway through.
- Guard: `scripts/workflows.test.mjs` (trigger, gate, condition, token and concurrency).
- **The deploy publishes the GitHub release of that version**, which is what lights the news bell in the client:
  `web/src/system/news.ts` reads the releases API, not what is running on the server. The `release` job runs on a
  GitHub runner, is the only one with a `contents: write` token, waits for the deploy (a version that never reached
  the server is not announced), takes its body from `docs/release-notes/<version>.md` and leaves an existing tag
  alone, so a re-run publishes nothing twice.
- **That release is born a prerelease.** `releases/latest`, which the download page reads (`site/app.js`), skips
  prereleases, so it keeps pointing at the last release that carries launcher installers; the releases list the bell
  reads does include it. When `release.yml` later uploads the installers for that tag it restores the body with the
  download guide and clears the flag, and the version becomes the full release. A tag that `release.yml` opens by
  itself is still born as a draft, as before.

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
