# AGENTS.md — XMage Nexus

A modern, high-performance web client for XMage. The stack consists of:
XMage server (Java, test mode) + WebSocket proxy (`Mage.Proxy`, Java) + web
client (`web`, React 19 + TypeScript + Vite).

**Master document: `PROJECT.md`** — source of truth for status, phases and
lessons. Update it when finishing a task (phases, lessons, quality table,
dated log) and record the date in the header. Also keep the interaction
coverage matrix `web/INTERACTION_COVERAGE.md` in sync (mark implemented/tested
+ test ref + date per callback/interaction); the guard `callbackCoverage.test.ts`
enforces that every server callback has a handler or is listed as planned. A
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
- XMage version: **1.4.61-V1** (upstream magefree/mage; merge of tag `xmage_1.4.61V1`).
  Proxy jar: `Mage.Proxy/target/mage-proxy-1.4.61.jar`. The proxy's default
  server is **`beta.xmage.today:17171`** (current official server; `beta.xmage.de` is obsolete).
  If the remote server changes release (strict version check `MAGE_VERSION_RELEASE_INFO_MUST_BE_SAME`),
  the proxy won't connect: the fork must be updated (fetch upstream + merge, in
  `../xmage-fork`) and everything rebuilt.
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
The goal is a client that works against `beta.xmage.today`, but beta is flaky. So the **oracle for
"real protocol" in CI is the local XMage server** (`node scripts/ctl.mjs restart all` →
`localhost:17171`, same 1.4.61-V1 fork). The recorder captures real frames and the fake-mode tests
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
  (branch `nexus` = upstream tag `xmage_1.4.61V1` + our test-mode/view patches;
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
`build` (tsc -b && vite build) · `java` (mvn -pl Mage.Proxy -am test) ·
`self-test` (headless E2E against the proxy; requires stack) ·
`human-test` (E2E human player vs AI; requires stack) ·
`e2e` (playwright in web; requires vite)

Success criteria and details in the `mage-test-suite` skill.

## MCP server (`mcp/`)

`mcp/` is a standalone MCP (stdio) server, registered in `opencode.json` as
`mage`. Fase A (done) exposes DevOps tools wrapping the existing scripts:
`mage_stack`, `mage_logs`, `mage_run_tests`, `mage_build`,
`mage_record_fixture`, `mage_validate_generated`, `mage_e2e` (Playwright con
`spec`/`grep` y backend fake/real), plus resources
(`mage://status/project`, `mage://coverage/interactions`, …). Fase C1 (done)
exposes the WS session/lobby: `mage_connect`, `mage_lobby`,
`mage_create_table`, `mage_join_table`, `mage_start_match`, `mage_leave_table`,
`mage_session`. Fase C2 (done) makes it play: `mage_game_state` (compact view),
`mage_wait_for_prompt`, `mage_action`/`mage_choose`/`mage_play_card`/
`mage_pay_mana`/`mage_combat`/`mage_pass_priority`, `mage_auto_pass`,
`mage_concede`, `mage_chat`, `mage_watch_tournament_match` (espectar un match de
torneo en vivo). Verified with a full real game vs Sim
(`MCP_E2E=1 npm test` in `mcp/`). Fase C3 (done): arnés con el FixtureServer de
`web/` en los tests (sin Java) + capa `mcp` en CI, maná/interacciones complejas
(auto-pago/botón especial, X, orden, multi-amount, trigger order) con auto-pass
anti-flood, reconexión/resync (`mage_reconnect`; el proxy cachea y reenvía el
último estado+prompt en el re-attach, y `connect` devuelve `data.attached`) y
multi-sesión (`mage_connect {session}`, `mage_use_session`, `mage_sessions`).

- No build: Node ≥24 runs the TypeScript directly (`node mcp/src/index.ts`).
  Strip-only mode: no `enum`/`namespace`/parameter properties.
- After touching `mcp/`: `npm --prefix mcp test` + `npm --prefix mcp run typecheck`.
- Never write to stdout outside the MCP transport (diagnostics → stderr).
- Scoped doc: `mcp/README.md`; roadmap/status: `PROJECT.md`.

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
(overlap, clipping, empty states, canvas) are caught without being asked.

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

**Deterministic UI assertions**: `BoardScene` publishes `window.__mageScene`
(cards, playable, targeting{active,source,ids,chosen}, game). Tests assert
against that state (and the DOM), NOT against canvas pixels (byte-diffs were
the source of flakes).

**Resolved issues (historical context — all RESOLVED, kept for reference)**:
1. **The AI-vs-AI demo NO LONGER FREEZES (RESOLVED)**: `SimPlayer.tryCast` was sending
   the Bolt UUID even when its untapped lands were ISLANDs; the server correctly
   rejected the cast (`canPay` doesn't cover {R}) and the game re-granted
   priority with the same view → infinite GAME_SELECT (flood ~48/s to the watcher).
   **Fix**: `tryCast` is now color-aware (`colorsOf` + `canProduceColors`, only
   casts if there are lands that produce ALL the colors of the cost) + dedup by
   signature `(turn, step, hand, untapped lands)` as defense. Verified in real
   ×6+ (the demo casts and resolves Bolts).
2. **`spells.spec.ts` and `targeting.spec.ts` in real mode: GREEN** (2026-08-16).
    The cause of their failures ("Sim win after the mana ask") was the
    **degraded server state caused by orphan sessions** — restarting
    server+proxy TOGETHER fixes it (`ctl.mjs restart all`); restarting ONLY the
   proxy leaves the first login hanging. Combined with test fixes (`nextManaSource`
    retry, strict cursor in the mana loop).
3. **The fake-mode demo (`fixtures/scenarios/fullFlow.ts`) suffers neither the
    freeze nor the flood**: the timeline is deterministic.
4. **Port conflict resolved (2026-08-20)**: fake mode now uses port **8789** (dedicated; the earlier 8788 collided with the proxy's HTTP test page),
   real proxy stays on **8787**. No more stop/start race conditions — both modes
   can run simultaneously.
5. **SIM sessions used to die after ~4 minutes (RESOLVED 2026-09-11)**: `ProxyClient`
   keeps its session alive with a periodic `session.ping()` (`PING_SERVER_SECS`),
   but `SimPlayer` had none, so `UserManagerImpl` expired the bot's connection
   (`sim-... disconnected due connection problems`) and the game declared it
   lost/quit — any human-vs-SIM game longer than the lease broke. **Fix**:
   `SimPlayer` schedules the same ping after `connect()` and cancels it in
   `stop()`. Lesson: every `SessionImpl` in the proxy (web client, SIM, future
   bots) needs its own keep-alive; the server never pings first.
6. **Proxy jar had no `Build-Time` manifest entry (RESOLVED 2026-09-11)**:
   `MageVersion`/`JarVersion` parsed a null attribute and logged an NPE
   (`Can't read build time in jar manifest`) for `ProxyClient` and every
   `SimPlayer`. **Fix**: the shaded jar's `ManifestResourceTransformer` now
   writes `${maven.build.timestamp}` (the ISO format `JarVersion` expects).

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
domain: `@spells`, `@targeting`, `@combat`, `@fullflow` (scripts
`test:e2e:spells|targeting|combat|fullflow`). All specs run in fake
(no stack, ~56s) and in real (contract). When touching `e2e/support/` or the
scenarios, run the full fake + real suite. **The helper does NOT answer the
mulligan** (the web's auto-keep already does it; a second false breaks the
test window).

## Rules

- **After touching `web`**: run `unit` and `typecheck` (and `build` if
  the build changed). After touching proxy Java: `java` + rebuild jar
  (`build.mjs proxy`) + restart proxy.
- **Before declaring a task "done"**: full suite
  (`node scripts/test.mjs`) with the stack up.
  - **Y CI remoto en verde** (plan7, 2026-09-19): tras el push, `gh run list -R
    Adamychen/xmage-nexus -L 5` — `Web client CI` estuvo una semana en rojo en
    `master` con la suite local 9/9 (caché de Maven con artefactos `org.mage`
    viejos). Si se toca el fork, publicar `origin/nexus` antes: CI y
    `release.yml` construyen desde ahí.
  - **Reiniciar el stack justo antes** (`node scripts/ctl.mjs restart all`): un
    server con muchas sesiones/partidas huérfanas acumuladas degrada el canal de
    callbacks y hace flaky `warmup`/`self-test`/`human-test` (WATCHGAME que no
    llega, `GAME_PLAY_MANA` que expira); con el stack recién reiniciado y
    caliente, self-test 15/15 y human-test 80/80 (medido 2026-09-18). Los fallos
    e2e de la suite en paralelo (hover/clic bajo carga: `printing-preview`,
    `auto-pod`) también son flakes: reintentar el spec aislado antes de tocar nada.
- **Known failure**: `self-test` may fail in `WATCHGAME` only on the first
  game after a cold server start (the server loses the callback
  return socket: `SESSION CALLBACK EXCEPTION - Unable to create socket`
  in `server.out.log`). Retry once with a warm server; if it fails
  repeatedly, it's a real bug, not a flake.
  - **Resuelto 2026-09-18 (bug real del proxy + flake del test)**: los fallos
    repetidos con `Lobby publish failed: NoClassDefFoundError
    org/jboss/mx/util/ObjectNameFactory` (log de 648 MB) eran un bug del proxy:
    `TransporterClient.findAlternativeTarget()` (solo tras
    `CannotConnectException`) inicializa `InternalTransporterServices`, cuyo
    `<clinit>` usa `ObjectNameFactory` de jboss-mx; el jar sombreado no lo
    incluía y el artefacto ya no se publica en ningún repo. Fix: shim
    `Mage.Proxy/src/main/java/org/jboss/mx/util/ObjectNameFactory.java` (el
    proxy no usa clustering: `NetworkRegistry` nulo ⇒ el failover devuelve false
    y se propaga el `CannotConnectException` real) + throttle de `publishLobby`
    (1 stack + 1 línea/min por sesión). Verificado con caída controlada del
    server (0 stacks tras el fix, recuperación automática,
    `verify-spectator-end` 17/17) y `self-test` 15/15: el WATCHGAME era además
    flaky por partidas IA-vs-IA que pueden terminar antes del watch.
- **RESUELTO (2026-09-12): `known-broken.ts` vacío; `invite-link.spec` pasa**
  (era coletazo del SetupWizard; histórico abajo). `web/e2e/known-broken.ts` es
  una lista vacía desde esa fecha, `playwright.config.ts` deja `grepInvert`
  no-op con lista vacía y los deep links de invitación (`invite-link.spec`)
  volvieron a pasar al re-ejecutarlos (`web/COMPONENT_PARITY.md:27`).
  `E2E_INCLUDE_KNOWN_BROKEN=1` sigue disponible para re-incluir títulos si se
  añaden. **Histórico resuelto (2026-09-11)**: los 77 tests fake que fallaban
  desde la ventana 09-05→09-10 (firma "Sala de Espera de Espectador" + asientos
  `0/N` en lobby) tenían causa raíz en el SetupWizard (commit `03abd96354`):
  su `skip()` persistía una conexión por defecto (proxy 8787) y el evento
  `setup-conn` pisaba el `?proxyPort=8789` del FixtureServer, así que los e2e
  jugaban contra el proxy real (beta.xmage.today en CI; evidencia: snapshot
  con "Mesas (21)" reales y seats `0/2` = formato real `TableView.seatsInfo`).
  Fix: `skip()` no persiste nada (la bandera ya la re-adivina
  `guessDefaultFlag`) + `LoginScreen` da prioridad al `?proxyPort=` explícito
  en `applySetupConn` + helper e2e apunta a `localhost` en fake. Also beware:
  the desktop launcher (`today.xmage.nexus` JRE) can squat ports 17171/8787
  while dev processes fail to bind with a stale `.run/*.pid` — kill those
  processes before self-tests.
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
  with `ROADMAP.md` / `PROJECT.md` when phases or the feature matrix change.