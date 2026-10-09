# AGENTS.md — XMage Nexus

A modern, high-performance web client for XMage. The stack consists of:
XMage server (Java, test mode) + WebSocket proxy (`Mage.Proxy`, Java) + web
client (`web`, React 19 + TypeScript + Vite).

**Docs model — no work log**: the narrative of a task lives in its commit
message; do not keep a dated log. When finishing a task update only the
affected docs — pending work in `ROADMAP.md` §4, durable lessons in
`docs/lessons.md`, phases/features in `site/content.json` — and keep the
interaction coverage matrix `web/INTERACTION_COVERAGE.md` in sync (mark
implemented/tested + test ref + date per callback/interaction); the guard
`callbackCoverage.test.ts` enforces that every server callback has a handler or
is listed as planned. A
second guard, `web/src/state/mechanicsCoverage.test.ts` (backed by
`scripts/view-schema.mjs`, which extracts the exhaustive serializable field set
from the XMage `mage.view.*` classes via the `JsonUtil` reflection rules),
verifies that **every field the server can emit is modeled** in
`contract.schema.json` / `types.generated.ts` — surfacing unmodeled game-state
(reverse-drift) automatically, without a hand-maintained mechanic list. A
**third guard**, `web/src/state/engineViewCoverage.test.ts` (backed by
`scripts/engine-view-schema.mjs`), catches the inverse gap: engine state in
`mage.game.*` that is **not** copied into the `mage.view.*` DTOs (so no remote
client can ever show it — e.g. `goad` reaches the client via `cardIcons`/`rules`,
but `harnessed`/`monstrous`/`renowned`/player-targeting do not). It compares the
engine→view gap against a committed baseline and fails on any change, forcing a
triage. See `web/INTERACTION_COVERAGE.md`.

**Contributor docs:**
- `Mage.Proxy/README.md` — proxy architecture, full protocol reference (all events/actions), serialization rules, type system
- `CONTRIBUTING.md` — developer workflow, file map, how to add events/types/features, testing guide

## Development stack

- Control: `node scripts/ctl.mjs start|stop|restart|status [server|proxy|vite|all]`
- Direct diagnostics (blocks the shell): `node scripts/dev.mjs start|stop|status|restart`
- Logs: `node scripts/tail.mjs [server|proxy|vite|all] [lines]` — files in `.run/*.log`
  (`server.out.log`, `proxy.out.log`, `proxy.err.log`, `vite.out.log`)
- Ports: XMage server `17171` (testMode), proxy WS `ws://127.0.0.1:8787`,
  proxy test page `http://127.0.0.1:8788/index.html`, Vite dev `http://localhost:5173`
- Rebuild the proxy jar: `node scripts/build.mjs proxy` (requires stopping
  the proxy; `build.mjs` stops it on its own) — afterwards `node scripts/ctl.mjs restart proxy`
- Full build (server + plugins + proxy): `node scripts/build.mjs` (engine
  steps run inside the fork checkout; the proxy builds standalone in this repo)
- XMage version: **1.4.62-V1** (upstream magefree/mage; merge of tag `xmage_1.4.62V1`).
  Proxy jar: `Mage.Proxy/target/mage-proxy-1.4.62.jar`. A second proxy flavor is built against the
  **XDHS fork** (xenohedron/mage, tag `1.5.8-XDHS-r1`) for `mage.xdhs.net`:
  `mage-proxy-1.5.8.jar` + `patches/xdhs/*.patch` + `-Dmage.version=1.5.8`
  (see `patches/xdhs/README.md`; launcher component `proxy-xdhs`, host script
  `scripts/deploy/host-xdhs.sh`). The proxy's default server is **`beta.xmage.today:17171`** (current official server; `beta.xmage.de` is obsolete).
  If the remote server changes release (strict version check `MAGE_VERSION_RELEASE_INFO_MUST_BE_SAME`),
  the proxy won't connect: the fork must be updated (fetch upstream + merge, in
  `../xmage-fork`) and everything rebuilt. The `Upstream XMage release` workflow
  (`scripts/check-upstream-release.mjs`, every 6 h) fails as soon as magefree/mage tags a newer
  release than the fork's `MageVersion`; that failure email is the signal to do it.
- Smoke test against the public server: works via the proxy (WS probe: login, SIM table, WATCHGAME/GAME_INIT/updates).
  **Anonymous login to `beta.xmage.today` is stable** (measured 2026-09-20: 17/17 logins, ~1.6 s each).
  The former "intermittent beta handshake bug" was a **misdiagnosis**: the server rejects any username
  longer than `maxUserNameLength` (**14**, `local-server/config/config.xml:48`, enforced in the fork's
  `Mage.Server/.../Session.java:153`) and answers `User name may not be longer than 14 characters`.
  `Can't receive server state before other data` (fork `SessionImpl.java:621`) is only a **symptom**:
  `connectStart()` fetches `getServerState()` *after* a successful login, so on any login failure
  `serverState` stays `null` and the server's `SHOW_USERMESSAGE` with the real reason trips that log
  line. It correlates 1:1 with `Logging: FAIL` and happens just as often against `localhost`. The
  apparent intermittency was generated usernames of varying length (`warmup-825244967` = 16 chars
  failed, `warmup-510227` = 13 passed). Keep every generated username **≤ 14 chars**; `LoginScreen`
  already enforces `maxLength={14}` and the `FixtureServer` validates it so fake mode catches drift.
  (The local server `localhost:17171` remains the oracle for real-protocol CI — it is deterministic,
  not because beta is broken.)
- **Web login already separates Proxy and XMage Server**: `LoginScreen` has independent fields for the
  proxy WS (`Proxy` host/port) and the target server (`XMage Server` host/port). No host-split work remains.
  Because the proxy is now **multi-tenant** (see below and `Mage.Proxy/README.md`), a single deployed
  proxy + static web serves many users: each player points the **Proxy** field at the shared proxy and
  the **XMage Server** field at the target server → zero-install, server-side play.

### Real-protocol validation harness (anti-drift)
The goal is a client that works against `beta.xmage.today`, but the public server is shared, latency-prone
and not reproducible. So the **oracle for
"real protocol" in CI is the local XMage server** (`node scripts/ctl.mjs restart all` →
`localhost:17171`, same 1.4.62-V1 fork). The recorder captures real frames and the fake-mode tests
replay them, giving drift detection without depending on beta:

- `scripts/rec-lib.mjs` + `scripts/record.mjs <mechanic|all>` — a single WS recorder that drives a
  real game (HUMAN+SIM, `skipInitShuffling`) and dumps the first `GAME_UPDATE` matching a driver's
  `captureWhen` predicate to `web/fixtures/recorded/<mechanic>.json`
  (`{recordedAt, gameId, gameView}`). Add a mechanic by registering a driver in `record.mjs`
  (deck + `onSelect` script + `captureWhen`); the boilerplate (connect, table, mulligan, mana via
  `sendPlayerUUID` of an untapped source, capture) is shared.
- `web/fixtures/recorded/manifest.json` — lists each frame + its invariant (`hasMutatedPermanent`,
  `hasNonMutatedCreature`, …).
- `web/fixtures/recorded.test.ts` — vitest that validates every frame's `gameView` against the
  contract schema (`gameViewFromAndValidate`) and asserts its invariant. Runs with no Java/stack.
- `web/fixtures/scenarios/replay-recorded.ts` + `web/e2e/recorded.spec.ts` — replays each recorded
  frame in the `FakeServer` and asserts the web renders it (no `pageErrors`, board paints,
  mechanic-specific DOM). Run with `npx playwright test recorded.spec.ts`.

Workflow: after changing the proxy/web, regenerate golden frames with `record.mjs all` against the
local server, commit `web/fixtures/recorded/*.json`, and let CI validate + replay them.


## Working model & isolation

This repo has three independent concerns, each developable on its own:

- **`web/`** — React/Vite/TS client. **No Java, no fork, no proxy needed.**
  Runs against the bundled `FakeServer` for all `unit`/`typecheck`/`build`/
  `e2e-fake`. Scoped doc: `web/AGENTS.md`.
- **`Mage.Proxy/`** — Java WebSocket bridge. Needs the XMage fork artifacts in
  `~/.m2` (once per XMage release; `ensureMageArtifacts()` installs them from
  the fork checkout automatically); develop standalone after that. Standalone
  pom (`mvn -f Mage.Proxy/pom.xml test`). Scoped doc: `Mage.Proxy/AGENTS.md`.
- **XMage fork (`Mage.*`)** — the rules engine, in a SEPARATE checkout, NOT in
  this repo. Resolution order (`scripts/lib.mjs` `forkDir()`):
  `NEXUS_FORK_DIR` env → `../xmage-fork` → error with instructions. Clone it
  once: `git clone https://github.com/Adamychen/xmage-nexus.git -b nexus ../xmage-fork`
  (branch `nexus` = upstream tag `xmage_1.4.62V1` + our test-mode/view patches;
  upstream releases merge cleanly there). Rebuild only when the XMage version
  changes or the test-mode patches change.

## Multi-tenant proxy (one process, many users)

`Mage.Proxy` is **multi-tenant**: every browser WebSocket owns its own XMage
session (`SessionImpl`). A single proxy process serves many independent players
at once (see `Mage.Proxy/README.md` "Connection & Session").

- **Same account, multiple windows** (normal + incógnito, or several tabs): a
  second connection with the same `host|username` **attaches** to the existing
  session — one session shared across windows (`ProxyClient.isSameSession` /
  `Gateway.attach`). This is what lets two browser contexts (e.g. normal +
  incógnito) share one account on one proxy.
- **Different accounts**: isolated sessions; server→client events for a session
  reach only that session's connections (`Gateway.byConn` / `byAccount`).
- **Deployment**: host the static `web` build + one `Mage.Proxy` instance. Each
  user sets the **Proxy** field to that instance and the **XMage Server** field
  to the target server. No per-user proxy is needed — zero-install, server-side
  play is already possible today.

Real-mode E2E (against a live proxy + server) reuses a prebuilt
`mage-proxy-*.jar` (`build.mjs proxy` once); web developers never run Maven.

## Test suite

Orchestrator: `node scripts/test.mjs [layer...] [--skip=unit,e2e]` — layers:

`unit` (vitest) · `coverage` (vitest --coverage) · `typecheck` (tsc -b --noEmit) ·
`build` (tsc -b && vite build) · `java` (mvn -f Mage.Proxy/pom.xml test) ·
`self-test` (headless E2E against the proxy; requires stack) ·
`human-test` (E2E human player vs AI; requires stack) ·
`verify` (9 anti-drift scripts: multi-tenant isolation, hand permissions, player leave,
range attack, rollback vote, spectator end, swiss, tournament watch, create-table matrix) ·
`verify-restart` (`verify-reconnect.mjs`; restarts the proxy, so it runs alone) ·
`fuzz` (`fuzz.mjs` self-play soak; nightly, not per push) ·
`e2e` (playwright in web; requires vite) · `i18n` (translation coverage guard)

The stack layers wait for the proxy's `/ready`, not just for its port: a proxy that has just
started answers on 8787 while its card database is still building, and every script then fails
with `Proxy is still loading card data` — a real failure that reads exactly like a broken test.
They also warn when the stack has been up for over an hour, because a long-lived stack with
dozens of sessions degrades the server's callback channel and the games stop producing views
(`WATCHGAME` never arrives, a spec "freezes" at turn 2). If `verify`/`self-test` fail that way,
`node scripts/ctl.mjs restart all` before touching anything.

Every script in `verify` logs out with `disconnect` before closing its socket. Without it the
proxy holds each session (and its SIM seats) for the whole grace period, so a run accumulated
21 live sessions and 458 threads by the seventh script and the sensitive ones failed on a
degraded server; `clientsAlive` in the watchdog line went from `created=21 disposed=0` to
`created=47 disposed=46`.

Success criteria and details in the `mage-test-suite` skill.

## MCP server (`mcp/`)

`mcp/` is a standalone MCP (stdio) server registered in `opencode.json` as `mage`: **38 `mage_*` tools**
that wrap the repo's scripts (stack, logs, tests, build, fixtures, e2e) and drive a real XMage session over
the proxy's WebSocket (login, lobby, tables, watching, and playing: compact game state, prompts, mana,
combat, auto-pass, reconnect/resync, multi-session). `mcp/README.md` is the canonical per-tool reference with
its argument tables — read it instead of this file when you need a tool's signature.

- No build: Node ≥24 runs the TypeScript directly (`node mcp/src/index.ts`).
  Strip-only mode: no `enum`/`namespace`/parameter properties.
- After touching `mcp/`: `npm --prefix mcp test` + `npm --prefix mcp run typecheck`.
- Never write to stdout outside the MCP transport (diagnostics → stderr).
- Scoped doc: `mcp/README.md`; pending work: `ROADMAP.md` §4.

**Interactive browser MCP**: `opencode.json` also registers `playwright`
(`scripts/playwright-mcp.mjs` → `@playwright/mcp`, reusing web/playwright's
Chromium; overrides `PLAYWRIGHT_MCP_VERSION`/`PLAYWRIGHT_EXECUTABLE_PATH`).
It gives the agent real UI interaction (accessibility snapshots, click/hover/
drag, screenshots, console/network) against a running app (stack vite on 5173
or any URL); artifacts land in `.run/playwright-mcp/`. Complementary to `mage`:
`mage` operates the protocol/backend, `playwright` sees and touches the UI.
**Default browser workflow (2026-09-12, user-mandated)**: snapshot to act +
**screenshot to verify** — after every meaningful browser step take a
screenshot and actually look at it (read the image file), so visual regressions
(overlap, clipping, empty states, mis-scaled or clipped cards) are caught without being asked.

## E2E with dual backends: deterministic fake and real

Browser E2E (Playwright) runs in **two modes with the SAME specs**:

- **fake (default, `npm run test:e2e` / `test:e2e:fake`)**: against the
   `FixtureServer` (`web/fixtures/fake.ts`, contract from
   `src/net/types.ts` + declarative scenarios in `fixtures/scenarios/`). No
   Java, no proxy, no flakes — the daily iteration loop. Uses dedicated port
   **8789** (independent of the proxy ports: WS 8787 and HTTP page 8788). `playwright.config.ts` starts
   vite only in fake mode.
- **real (`E2E_BACKEND=real npm run test:e2e:real`)**: against the stack
   (server+proxy+vite). This is the anti-drift net: if the real protocol moves,
   this mode detects it. Runs in CI/nightly and on demand.

The FakeServer is typed against `types.ts` (typecheck guards consistency) and
the frames it emits are validated with `fixtures/schema.ts` (zod) — if the real
proxy adds/changes fields, the schema test fails and is regenerated with the recorder.

**Deterministic UI assertions**: the board renders in DOM/CSS (no canvas engine), and
`web/src/board/sceneBridge.ts` publishes `window.__mageScene`
(cards, playable, targeting{active,source,ids,chosen}, game). Tests assert
against that state and the DOM, never against screenshots or pixel diffs (byte-diffs were
the source of flakes).

**Resolved defects (a pointer, not a log)**: the AI-vs-AI demo freeze
(`SimPlayer.tryCast` sent the Bolt UUID whatever its untapped lands produced; the server rejected the cast
and re-granted priority with the same view, flooding the watcher with ~48 `GAME_SELECT`/s — it is color-aware
now and dedups by `(turn, step, hand, untapped lands)`), the `spells`/`targeting` real-mode failures
(orphan sessions degrading the server: restart server **and** proxy together), the fake-mode demo being
immune (its timeline is deterministic), the 8787/8788/8789 port conflict (fake E2E has its own dedicated
port), the missing SIM keep-alive, the missing `Build-Time` manifest entry, the per-failed-login thread
leak, `catch (Exception)` in front of the single-thread executors plus a probe that answered "no" when it
could not ask, and the one-thread-pool-per-session leak. **All of them are fixed.** The durable version of
each one, with the measurement that proved it, is in `docs/lessons.md`; the narrative is in the commit that
fixed it. This file used to restate them, which only duplicated those two sources (and drifted: they were
numbered 1-8, then 10, then 9).

- The proxy's **watchdog** is what would catch a leak like those again: one line per minute with `threads`,
  `clientsAlive` (`clientsCreated - clientsDisposed`), `openConns`, `accounts`, `wsErrors` and the card-DB
  state, plus the same under `/admin/status` (`runtime`, with per-connection detail under `sessions`). It is
  on **stderr** (`.run/proxy.err.log`), because the fork routes JUL through log4j. Read `clientsAlive`
  across ticks: one live session accounts for one, a client released after a rejected login for none, so a
  climb with flat `openConns`/`accounts` is a client nothing can reach.

## E2E with simulated opponents (Sim) and WS helper

UI E2E uses `SIM` seats (the proxy joins a deterministic bot with its own
session) and a `HumanHelper` over WS (`web/e2e/wshelper.ts`) that
plays lands, passes priorities, discards and answers asks — fragile actions go
over WS and the UI only verifies (dialogs, render, pageerrors). Tests do NOT
enable the web's auto-pass (it competes with the launch windows). Load `mage-e2e-sim`
before touching or debugging any E2E.

**Modular architecture (2026-08-17)**: tests by functionality, independent
game per test. Common libraries in `web/e2e/support/`
(`frames.ts`, `start-game.ts`, `game-screen.ts`, `scene.ts`, `canvas.ts`,
`fake-backend.ts`) and declarative scenarios for the FixtureServer in
`web/fixtures/scenarios/` (mini-engine `humanGame.ts`). Tags by
domain: `@spells`, `@targeting`, `@combat`, `@fullflow`, `@board`, `@site` (scripts
`test:e2e:spells|targeting|combat|fullflow|board|site`). Every spec runs in fake
(no stack, ~9 min for all 312) and can run in real; the nightly real-mode job
covers the five protocol-sensitive specs (`deckvalidation`, `multi-user`,
`priority-stop-real`, `skips`, `full-flow`) plus the `verify` layer, not all 312.
When touching `e2e/support/` or the scenarios, run the full fake + real suite.
**The helper does NOT answer the mulligan** (the web's auto-keep already does it;
a second false breaks the test window).

A viewer that latches open covers the board and silently breaks specs that are not about it:
`infoWindowState` opens a `.pile-overlay` for a looked-at/revealed/companion group and keeps it
until closed, so a spec that hovers or clicks the board beneath must call
`dismissInfoWindows(page)` (`e2e/support/info-windows.ts`) first. The failure looks unrelated
(`locator.click` timing out "waiting for element to be visible, enabled and stable", or a 120 s
timeout in a spec about badges) — read the failure screenshot before blaming flake. Shared
fixtures are the other half: `mechanics`/`podGame` publish a `revealed` group that is load-bearing
for `mechanics.spec.ts`, so a fixture change must be checked against every spec using it.

## Rules

- **English only**: every artifact is written in English — commit messages and
  PRs, docs (`*.md`), skills/commands, code identifiers, comments (when
  allowed), test names, fixtures and log/error strings. The only exceptions are
  the translation locales (`web/src/i18n/locales/*`) and quoted server output.
  Existing Spanish prose is migrated to English as its file is touched; do not
  do unrelated mass rewrites.
- **After touching `web`**: run `unit` and `typecheck` (and `build` if
  the build changed). After touching proxy Java: `java` + rebuild jar
  (`build.mjs proxy`) + restart proxy.
- **Before declaring a task "done"**: the full suite (`node scripts/test.mjs`) with the stack up, **and the
  remote CI green afterwards** (`gh run list -R Adamychen/xmage-nexus -L 5`). `Web client CI` once sat red on
  `master` for a week while the local suite was 9/9, because CI's Maven cache held old `org.mage` artifacts.
  If the fork is touched, publish `origin/nexus` first: CI and `release.yml` build from there.
- **Restart the stack right before** (`node scripts/ctl.mjs restart all`): a server that accumulated orphan
  sessions and matches degrades the callback channel and makes `warmup`/`self-test`/`human-test` flaky
  (`WATCHGAME` never arrives, `GAME_PLAY_MANA` expires). On a freshly restarted, warm stack: self-test
  15/15 and human-test 80/80 (measured 2026-09-18). Parallel-run e2e failures (hover/click under load:
  `printing-preview`, `auto-pod`) are flakes: rerun the spec alone before touching anything.
- **Known failure**: `self-test` may fail in `WATCHGAME` only on the first game after a cold server start
  (the server loses the callback return socket: `SESSION CALLBACK EXCEPTION - Unable to create socket` in
  `server.out.log`). Retry once with a warm server; if it fails repeatedly it is a real bug, not a flake —
  the last time it repeated for a whole day it was a proxy bug (a missing `ObjectNameFactory` in the shaded
  jar, fixed by a shim + a `publishLobby` throttle, see `docs/lessons.md`), and some AI-vs-AI games simply
  end before the watch lands.
- **No known-broken list and no way to exclude specs** (the `grepInvert` / `E2E_INCLUDE_KNOWN_BROKEN`
  mechanism was removed 2026-09-30): a fake test that fails stably is investigated and fixed. Watch for
  environment causes that read like product bugs — the desktop launcher (`today.xmage.nexus` JRE) can squat
  ports 17171/8787 while dev processes fail to bind with a stale `.run/*.pid`, and the 09-05→09-10 window
  of 77 fake failures had the same shape: `SetupWizard.skip()` persisted a default connection (proxy 8787)
  whose `setup-conn` event overwrote the FixtureServer's `?proxyPort=8789`, so those e2e runs played against
  the real proxy and beta. `skip()` persists nothing now (the flag is re-guessed by `guessDefaultFlag`),
  `LoginScreen` lets an explicit `?proxyPort=` win in `applySetupConn`, and the e2e helper points at
  `localhost` in fake mode.
- **Do not touch** generated files: `dist/`, `.run/`, `local-server/`,
  `node_modules/`, `target/`.
- No comments in code unless requested.
- Do not commit unless explicitly requested.

## Status dashboard (GitHub Pages)

`site/` is a zero-build static dashboard (HTML/CSS/JS) that renders `site/status.json`
(test layers, coverage, roadmap phases, feature-parity matrix, anti-drift guards).

- Generator: `scripts/gen-dashboard.mjs` (merges `site/content.json` + test artefacts).
- CI orchestrator: `scripts/dashboard-ci.mjs` (unit+coverage, typecheck, build, fake-e2e, proxy java).
- Nightly real-stack: `scripts/integration-report.mjs` (self-test/human-test/e2e-real → `reports/integration-result.json`).
- Published by `.github/workflows/pages.yml` (push = lightweight layers; nightly cron = also integration).
  Pages **source must be "GitHub Actions"** (Settings → Pages).
- `site/content.json` is the dashboard's canonical roadmap/feature/guard source — keep it in sync
  with `ROADMAP.md` when phases or the feature matrix change.