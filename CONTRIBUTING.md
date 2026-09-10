# Contributing to XMage Nexus

Guide for developers working on the web client or the proxy. If you are new,
read in this order: `readme.md` → `docs/README.md` (onboarding path) → this
file (hands-on recipes and enforced rules). Scoped guides live next to the
code: `web/AGENTS.md`, `Mage.Proxy/AGENTS.md`.

## Quick start

Pick what matches your task — `web/` is fully isolated, you do **not** need
Java/Maven to work on the client alone:

- **Variant A — web-only** (UI, board, lobby, deterministic tests): `npm --prefix web install`, then `npm --prefix web run dev`. Full steps in `readme.md` ("Variant A").
- **Variant B — full stack** (real games, protocol work): `node scripts/install.mjs`, then `node scripts/ctl.mjs start all`. Full steps in `readme.md` ("Variant B").

## Everyday commands

```bash
node scripts/ctl.mjs start|stop|restart|status [server|proxy|vite|all]
node scripts/tail.mjs [server|proxy|vite|all] [lines]   # logs in .run/*.log
node scripts/test.mjs [layer...]                        # unit coverage typecheck build java self-test human-test e2e i18n
```

After touching `web/`: run `unit` + `typecheck` (`build` if the build changed).
After touching proxy Java: run `java` + `node scripts/build.mjs proxy` +
`node scripts/ctl.mjs restart proxy`. Before declaring anything done, run the
full suite with the stack up (`node scripts/test.mjs`). See `docs/testing.md`.

## Recipes

### Adding a game event handler

The server sends callbacks like `GAME_ASK`, `GAME_TARGET`,
`GAME_TARGET_PLAYER`, `GAME_CHOOSE_MODE`, `GAME_SELECT` (full list:
`EVENT_METHODS` in `web/src/net/types.ts`).

1. Decide: does it ask the player for input, or only update state?
2. **Player interaction** → `web/src/game/feedback/parse.ts` (`parseFeedback`)
   for parsing + a component under `web/src/game/feedbackModes/` (or a dialog),
   routed by `web/src/game/FeedbackDialog.tsx`.
3. **State update** → `web/src/state/eventHandler.ts` (keeps the `case` order;
   bodies live in `web/src/state/events/<domain>.ts`: `chat/game/prompts/`
   `sideboard/draft/tournament/replay/views`).
4. Add/refresh its row in `web/INTERACTION_COVERAGE.md` (callback, mechanic,
   test ref, date). The `callbackCoverage.test.ts` guard fails otherwise.

### Adding a Java view type

When the XMage server introduces a new view class (e.g. `NewThingView`):

```bash
# 1. Model it in web/schema/contract.schema.json (source of truth for the wire)
# 2. Regenerate:
cd web
npm run gen-types && npm run gen-zod && npm run gen-server-state
npm run gen-types:validate && npm run gen-zod:validate && npm run gen-server-state:validate
```

Never hand-edit `web/src/net/types.generated.ts` or
`web/fixtures/schema.generated.ts`. The `mechanicsCoverage` guard verifies
that every field the server can emit is modeled in the contract.

### Adding a proxy action

When the client needs to send a new action to the server:

1. Route it in `Mage.Proxy/src/main/java/org/mage/proxy/CommandDispatch.java`
   → implement it in the matching `InfoCommands` / `TableCommands` /
   `TournamentCommands` / `GameCommands.java`. Parse args defensively with
   `JsonArgs`, answer with the `ProxyProtocol` envelope.
2. Add the TypeScript wrapper in `web/src/net/commands.ts` and call it from the client.
3. Rebuild + restart: `node scripts/build.mjs proxy` then `node scripts/ctl.mjs restart proxy`.

### Adding a mechanic (recorded-frame workflow)

New mechanics ship with a real-protocol golden frame so CI replays them
without depending on the public server:

1. Register a driver in `scripts/record.mjs` (deck + `onSelect` script + `captureWhen`).
2. Run it against the local server; it dumps `web/fixtures/recorded/<mechanic>.json` + a `manifest.json` invariant.
3. `web/fixtures/recorded.test.ts` validates the frame against the contract; `web/e2e/recorded.spec.ts` replays it in the `FakeServer`.

## Rules that CI enforces (or humans will ask about)

- **Generated files are read-only**: `types.generated.ts`, `schema.generated.ts`
  (and friends under `gen-*:validate`). Regenerate, then fix the code.
- **i18n ×9 locales**: every user-facing string goes into all 9 locales in
  `web/src/i18n/` — the `i18n` test layer checks parity.
- **Docs duties on every finished task**: add a row to the `PROJECT.md` work
  log (and bump its header date) · update `web/INTERACTION_COVERAGE.md` for
  handler/interaction changes · update `web/COMPONENT_PARITY.md` when closing a
  parity unit · mirror phase/feature changes into `site/content.json`.
- **No comments in code** unless requested. Never commit generated or runtime
  output: `dist/`, `.run/`, `target/`, `local-server/`, `node_modules/`.
- Do not commit unless explicitly requested.

## File map

### Proxy (Java, `Mage.Proxy/src/main/java/org/mage/proxy/`)

| File | Purpose |
|---|---|
| `ProxyClient.java` | `MageClient` bridge: session lifecycle, callback forwarding, command router |
| `Gateway.java` | WS transport: `byConn`/`byAccount`, origin check, rate limit |
| `CommandDispatch.java` + `Info/Table/Tournament/GameCommands.java` | Action routing + implementations |
| `CommandContext.java` / `JsonArgs.java` / `ProxyProtocol.java` / `ErrorClassifier.java` | Router context, defensive arg readers, envelopes, error codes |
| `MatchOptionsParser.java` / `SimManager.java` / `SimPlayer.java` | Match/tournament options, SIM bot lifecycle, deterministic test bot |
| `JsonUtil.java` | Reflection Java → JSON serializer (camelCase 1:1, see `Mage.Proxy/README.md`) |
| `DeckJson.java` / `DeckValidation.java` | Deck JSON parsing + advisory pre-validation (`validateDeck`) |
| `Main.java` / `Config.java` | Entrypoint (WS + HTTP test page) and CLI flags |

### Web client (TypeScript, `web/src/`)

| Path | Purpose |
|---|---|
| `net/types.ts` | Hand-written protocol surface (envelopes + `EVENT_METHODS`) |
| `net/types.generated.ts` | Generated view types (DO NOT EDIT) |
| `net/Gateway.ts` / `net/commands.ts` | WS connection + reconnect; action wrappers |
| `state/eventHandler.ts` + `state/events/` | Server event router + per-domain bodies |
| `state/state.ts` + `state/slices/` + `store.ts` | `AppState` composed of slices; store facade |
| `game/feedback/` (`parse/detect/record/text`) + `feedbackModes/` | Prompt parsing + per-mode UI, routed by `FeedbackDialog.tsx` |
| `board/` | Battlefield rendering (`BoardScene` publishes `window.__mageScene` for E2E) |
| `lobby/` / `decks/` / `i18n/` / `audio/` / `cards/` | Login/lobby/wizard, DeckBuilder + Scryfall, 9 locales, sounds, card art |

### Schema, codegen & E2E

| Path | Purpose |
|---|---|
| `web/schema/contract.schema.json` | Wire format source of truth |
| `scripts/gen-types.mjs` / `gen-zod.mjs` / `server-state-schema.mjs` | Contract → TS / zod / server-state generators (+ `:validate`) |
| `scripts/view-schema.mjs` / `engine-view-schema.mjs` | Java `mage.view.*` oracle and engine→view gap baseline |
| `scripts/record.mjs` / `rec-lib.mjs` | Real-frame recorder → `web/fixtures/recorded/` |
| `web/fixtures/fake.ts` / `fixtures/scenarios/` / `fixtures/schema.ts` | Deterministic FakeServer, declarative scenarios, zod frame validation |
| `web/e2e/support/` / `web/e2e/wshelper.ts` | Test helpers; `HumanHelper` WS driver for fragile actions |
| `web/e2e/readme.md` | E2E modes, domain tags, failure artefacts |

## Commits & pull requests

- Commit style: `fix(web): …`, `feat(proxy): …`, `test(…)`, `docs`, `refactor`
  (see recent `git log` for examples).
- Open PRs against `main`/`master` with the PR template checklist
  (`.github/PULL_REQUEST_TEMPLATE.md`): layers run, docs updated, no generated files.
- Protocol reference: `Mage.Proxy/README.md` (actions, events, serialization).
  Architecture and testing details: `docs/architecture.md`, `docs/protocol.md`, `docs/testing.md`.

## Common pitfalls

1. **Stale types**: runtime errors about missing fields mean the TS contract is
   out of sync — regenerate (`gen-types` + `gen-zod`) and check the guards.
2. **Event not reaching the client**: the proxy drops outdated events on
   reconnect and events for games the session never joined. Check `proxy.err.log`.
3. **E2E fails only in real mode**: fake is deterministic, so a real-only
   failure is timing or protocol drift — never "fix" it by weakening the test.
4. **First game after a cold start**: `self-test` WATCHGAME may flake once
   (`SESSION CALLBACK EXCEPTION`). Retry warm; persistent failure is a real bug.
5. **Restart server + proxy together** (`ctl.mjs restart all`); restarting only
   the proxy leaves the first login hanging. Anonymous login to
   `beta.xmage.today` is intermittent — the local server is the reliable oracle.
