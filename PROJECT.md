# Project: XMage Nexus (Web) — Master Working Document

> This document is the **project source of truth**: roadmap, phases, decisions, and
> verified actual state. It is updated at every work step, not just at the end of phases.
> Last updated: 2026-08-30 (Commander/Pod polish: decoupled TurnOrderRing to top-bar capsule, full 100% board viewport in PodBoard with auto-scaling cards, dedicated 👑 CMD sidebar tab with vertical cards view, progress bars, lethal alert banner, multi-zone commander damage tracking, and 4 anti-drift guards 100% passing)

---

## 1. Objective

Replicate the full XMage experience (multiplayer and vs AI) with a
**modern, Arena-grade** web client: WebGL2 rendering, animations, visual targeting,
and instantly playable **without installing anything** (one link and play).

We do not re-implement game rules: the XMage Java server remains the authoritative rules engine,
card database (+25,000 cards), and social/multiplayer backend. We build a modern client on top.

## 2. Current Status

| Phase | Name | Status |
|---|---|---|
| 0 | XMage Proxy (bridge) | ✅ Completed and verified (2026-08-08) |
| 1 | Web Client: login + lobby + rendered board | ✅ Completed and verified (2026-08-08) |
| 2 | Full Interaction: feedback, targeting, playing | ✅ **Completed and verified (2026-08-15)** — X costs, multi-target, modal choices, and counters validated via WS (human-test 83 checks) and browser E2E (spells 4/4) |
| 2.5 | 1v1 Competitive Parity (clocks, DFC/Sagas, card selection, phase stops) | ✅ **Completed (2026-08-25)** — Match Chess Clock (+buffer, F4/F9), DFC/MDFC back-face, Saga lore, HD card-selection grid, phase stops, descarte interactivo desde reveal de mano (Thoughtseize) |
| 3 | Effects, audio, desktop launcher | ⬜ Pending |
| 5 | Advanced Formats & Tournaments (Commander 4-max, Draft 8, Swiss) | ✅ **Completed (2026-08-26)** — PodBoard 2x2 max 4 (TurnOrderRing + CommanderDamageMatrix sin tocar BoardZone.css), DraftScreen + ConstructScreen (40), TournamentBracket/Panel + Replay viewer, contrato Draft/TournamentView + proxy 12 actions |

## 3. General Architecture

```
┌──────────────┐   WS JSON    ┌────────────────┐   XMage Protocol     ┌───────────────────┐
│  Browser     │ ───────────▶ │ Java Proxy     │ ───────────────────▶ │ XMage Server      │
│  React+Pixi  │ ◀─────────── │ (Mage.Proxy)   │ ◀─────────────────── │ (Mage.Server)     │
│  WebGL2      │              │ Real Session   │   jboss-serialization│ 1.4.61-V1         │
└──────────────┘              └────────────────┘                      └───────────────────┘
```

- **XMage Server**: Rules engine and game state (Java, `Mage.Server`). Existing project, untouched.
- **Proxy (`Mage.Proxy/`)**: Custom Java module. Opens a real XMage session (`SessionImpl`),
  receives server callbacks, re-exposes them over WebSocket as JSON, and forwards client actions
  to the server. Necessary because browsers cannot speak jboss-serialization.
- **Web Client (`web/`)**: React + PixiJS app. Communicates solely with the proxy,
  never directly with Mage.Common → modifying the client does not break the proxy or vice versa.

## 4. Technical Decisions (and Rationale)

| Decision | Choice | Rationale |
|---|---|---|
| Client Stack | React 19 + Vite + TypeScript + PixiJS 8 (WebGL2) | PixiJS = GPU sprites/particles/filters; React = UI (lobby, dialogs). Maximum iteration speed and visual fidelity |
| State Architecture | **Snapshot-diff → animation**: each `GAME_UPDATE` delivers the full `GameView`; client calculates transitions (card A moved from hand→battlefield, B tapped...) and animates them | Pure testable logic; effects are data-driven rather than hardcoded per action |
| Effects | Declarative catalog (`fx/catalog.ts`): an effect = config entry (animation, easing, duration, particles) | Adding effects takes lines of config, not refactors; maintainable |
| Distribution | Pure browser (Phases 1-2) → Tauri launcher (Phase 3) | Web link = zero installation (core advantage vs desktop Swing); Tauri = ~15 MB desktop app running the embedded proxy automatically |
| Maintainability | `types.ts` = single source of protocol truth; pure logic decoupled from rendering; minimal pinned dependencies | Real project risk is XMage protocol versions (proxy), not client-side churn |
| Performance | Shared sprite sheets, unique card textures, particle pooling, DPI-aware rendering | Game is not performance-bound; memory usage and GC pauses are kept strictly bounded |

## 5. Phase 0 — XMage Proxy (✅ Completed & Verified 2026-08-08)

### Delivered Components (`Mage.Proxy/`)

| File | Purpose |
|---|---|
| `src/main/java/.../ProxyClient.java` | Implements `MageClient`; real XMage session via `SessionImpl`; forwards server callbacks as JSON; executes web client commands |
| `src/main/java/.../Gateway.java` | WebSocket server (Java-WebSocket) at `ws://localhost:8787` |
| `src/main/java/.../JsonUtil.java` | Reflection-based JSON serializer with cycle detection (critical for huge `GameView` objects) |
| `src/main/java/.../Main.java` + `Config.java` | Startup; flags `--host --port --username --password --wsPort --httpPort` |
| `src/main/java/.../DeckJson.java` | JSON deck parsing → `DeckCardLists` |
| `src/main/resources/web/index.html` | Test page served at `http://localhost:8788/index.html` |
| `README.md` | WS protocol documentation (commands, events, examples) |
| `pom.xml` (root) | Registered `Mage.Proxy` module; `Mage.Proxy/pom.xml` with dependencies for Mage.Common |

### Real Verification (Local Server in Test Mode, `local-server/`)

Full end-to-end flow verified:
- Login/session OK · lobby broadcast (tables/users/messages) every ~2s OK
- Room chat (joinChat + messages) OK
- Create table with AI + human, join with JSON deck, `startMatch` OK
- JSON events received: `START_GAME`, `GAME_INIT` (full GameView), `GAME_UPDATE`, `GAME_ASK` (mulligan) OK

### Lessons Learned (Crucial for Phases 1-3)

1. **Proxy AND Server** must run with `--add-opens=java.base/java.io=ALL-UNNAMED` (jboss-serialization fails on JDK 17 without these flags).
2. `beta.xmage.de` is obsolete/down (2026-08-08); use `beta.xmage.today:17171` or local server.
3. `deckType` must match a **real server configuration name** (e.g. `Constructed - Modern`).
4. AI seats are filled **before** the human seat (matching the official client behavior).
5. `createTable` requires the deck's `quitRatio` to be ≥ the user's `quitRatio` (default to 100).
6. Client version must strictly match server version; local server requires `config.xml` with `${project.version}` replaced and plugins placed in `plugins/`.
7. **Connect must NEVER restart an already active session for the same user+host** (browser reloads send repeated connects). In test mode, duplicate user connections from the same host are kicked (`Session.java` anon-dedup) → restarting triggered reconnect loops (~1.5s) that cleared WS registries and killed broadcasts. Fix: idempotent connect + `synchronized`.
8. **Game events continue arriving at the proxy for ~1 min after the watcher closes** (GAME_UPDATE/GAME_OVER from ongoing AI matches). "Broadcast to 0 connections" for game events is normal; for `lobby` events it is an issue (active clients should always be present).
9. **Unmounting the board requires disconnecting the ResizeObserver**: Pixi 8 sets `renderer` to null on destroy; a leaked observer triggers `resize()` against null after unmount.
10. Log checks must be **time-windowed** (offset to test start): proxy logs are append-only across restarts and historic traces cause false positives.
11. **Real XMage Boolean Semantics**: `sendPlayerBoolean(true)` = **take mulligan**, `false` = **keep** (the official client's "Mulligan" button sends true). For priority (`GAME_SELECT`), any boolean yields priority.
12. **Real London Mulligan**: After `GAME_ASK "Mulligan down to N?"`, taking a mulligan prompts `GAME_TARGET "Select a card (N more) to put on the bottom of your library"` (card UUIDs live in `targets`, **not** in `cardsView1`) and re-prompts with N−1.
13. **"Select a starting player" is random**: `GameImpl.pickChoosingPlayer()` randomly selects who chooses; if the human wins, a blocking `GAME_TARGET` arrives requiring a player UUID response.
14. **"Any target" prompts include both players**: When validating damage in tests, select the opponent's UUID (`gameView.players[].controlled`), not the first target in `targets` (which could be oneself).
15. **macOS `/usr/bin/java` stub breaks daemon scripts**: `scripts/lib.mjs` resolves the real binary (`javaBin()`, Homebrew `openjdk@17` in `/opt/homebrew/opt` first) and `daemon()` uses the absolute path.
16. **`SESSION CALLBACK EXCEPTION - Unable to create socket` becomes persistent if dead proxy sessions linger** (killed via kill -9): old client sockets remain on the server, causing new logins to fail with endless retries. Fix: restart server and start proxy cleanly.
17. **Real Mana Payment (`GAME_PLAY_MANA`) sends no color hints**: `data.options` only provides `{"queryType":"PLAY_MANA"}`. Payment occurs by tapping mana sources on the board (UUID from `canPlayObjects` in `players[].battlefield` — taps and adds mana to pool) and **then** paying from the pool with `sendPlayerManaType`.
18. **Browser E2E tests leave matches running on the server** (test mode, `maxGameThreads`=10): long test runs saturate server threads. Restart server between heavy test batches.
19. **Port map (post-2026-08-21)**: proxy WS `8787`, proxy HTTP test page `8788` (owned by the Java process whenever the stack is up), fake FixtureServer `8789`. The 2026-08-20 choice of 8788 for fake only worked with the proxy stopped.
20. **Real-mode e2e vs scripted fixtures**: the XMage server never auto-starts IA-vs-IA tables (`startMatch` must be sent explicitly) and advances turns by priority timers. Fixture-scripted specs (fixed hands/windows, forced Sim wins) are therefore fake-only until the HumanHelper learns to HOLD priority in main instead of auto-passing.
19. **Demo AI deck must be stable** (Islands + Mountains + 4 Bolts): 16 Bolts make AI vs AI matches end in 2-3 turns, preventing spectators from seeing board interactions. Decks separated in `web/src/lobby/decks.ts` (`STABLE_DECK` demo / `DEFAULT_DECK` for human matches).

---

## 6. Phase 1 — Web Client: Login + Lobby + Rendered Board (✅ Completed & Verified 2026-08-08)

### Objective

Web application connecting to the proxy, authenticating, displaying the lobby (tables, users, chat), allowing table creation/spectating, and **rendering the board with HD card art (Scryfall)**. Flagship demo: **spectating live AI vs AI matches** running autonomously.

### Codebase Structure (`web/`)

```
web/
├── index.html
├── package.json / vite.config.ts / tsconfig.json
└── src/
    ├── main.tsx / App.tsx          — Entry point, phase routing (login/lobby/game)
    ├── net/
    │   ├── types.ts                — PROTOCOL TYPES (single source of truth, mirrors proxy JSON)
    │   ├── Gateway.ts              — WS connection, reconnect backoff, event routing, result promises
    │   └── commands.ts             — Proxy action helpers
    ├── state/
    │   ├── store.ts                — Connection and lobby state
    │   └── gameStore.ts            — Current GameView snapshot + match log
    ├── lobby/
    │   ├── LoginScreen.tsx         — host/ws/user/pass → connect
    │   ├── LobbyScreen.tsx         — Tables, users, room chat, create table
    │   └── CreateTableDialog.tsx   — Game type, format, AI count
    ├── cards/
    │   └── cardImages.ts           — Scryfall (set + number) with memory LRU + 75ms throttle, Accept + 429 Retry-After; IndexedDB 24h cache planned Phase 3
    ├── board/
    │   ├── BoardView.tsx           — Mounts Pixi.Application (WebGL) within React
    │   ├── BoardScene.ts           — Orchestrates: snapshot → sprites; zones, tap, counters
    │   ├── zones.ts                — Layout: card slot coordinates in pixels
    │   └── gameToScene.ts          — Maps GameView → scene entities
    └── ui/
        ├── TopBar.tsx              — Turn, phase/step, player life/mana
        └── GameLog.tsx             — Match log from GAME_UPDATE_AND_INFORM / CHATMESSAGE
```

### Quality & Continuous Integration

| Layer | Tool | Command | Status |
|---|---|---|---|
| Unit (Pure Logic) | vitest | `npm --prefix web run test` | ✅ Clean |
| Web Core Coverage | vitest/v8 | `npm --prefix web run test:coverage` | ✅ Clean |
| Typecheck | tsc | `npm --prefix web run typecheck` | ✅ Clean |
| Production Build | vite | `npm --prefix web run build` | ✅ Clean |
| Java Proxy | Maven/JUnit 5 | `mvn -pl Mage.Proxy -am test` | ✅ 34 tests PASS (proxy 18 + common 16) |
| Headless E2E (Real Proxy) | `scripts/self-test.mjs` | `node scripts/self-test.mjs` | ✅ 15 checks PASS |
| Human vs AI E2E | Node/WebSocket | `node scripts/human-test.mjs` | ✅ 83 checks PASS |
| Browser E2E | Playwright | `npm --prefix web run test:e2e` | ✅ 27/27 fake · real: 3 pass + 15 fake-only (documented) |
| Interaction Coverage | vitest callbackCoverage.test.ts | `npm --prefix web run test` | ✅ 43 callbacks contabilizados · anti-drift doc↔código |
| Contract Drift Guard | CI | `gen-zod:validate` + `gen-types:validate` | ✅ up-to-date (contract → schema.generated.ts + types.generated.ts) |

- **One Command for Everything**: `node scripts/test.mjs [unit|coverage|typecheck|build|java|self-test|human-test|e2e]`.
- **Zero-Setup User Script**: `node scripts/install.mjs` (Maven build + plugins setup + npm install) → `node scripts/ctl.mjs start` → `node scripts/test.mjs`.

---

## 7. Phase 2 — Full Interaction (✅ Completed & Verified 2026-08-15)

- Comprehensive support for server interaction callbacks (`GAME_ASK`, `GAME_TARGET`, `GAME_PLAY_MANA`, `GAME_CHOOSE_*`, `GAME_SELECT`, quantities).
- Visual targeting: animated dotted lines, glowing highlight outlines on valid targets.
- Click-to-play card interactions, mode selections, X-cost resolution, and +1/+1 counters.
- Dispatches `sendPlayerAction`, `sendPlayerString`, `sendPlayerUUID`, `sendPlayerInteger` matching server asks.
- **Validated E2E**: `scripts/human-test.mjs` executes full match: starting player choice, London mulligan, land drops, turn passing, casting *Lightning Bolt*, *Blaze* (X=2), *Arc Trail* (multi-target), *Boros Charm* (modal choice), and *Walking Ballista* (X=4 counters). 83 checks PASS.

---

## 8. Phase 3 — Visual Polish, Audio & Distribution (In Progress)

- Declarative visual effect engine (`fx/engine.ts`, `fx/catalog.ts`): card trajectory arcs, color-coded particle bursts, glow/outline shaders, screen shake, floating $-X$ combat damage numbers, Web Audio sound pack.
- Structured event feed (`ActionFeed.tsx`) parsing rules engine logs into visual action cards.
- Tauri desktop packaging: lightweight native launcher (~15 MB) bundling embedded proxy.
- PWA support: installable browser app with offline card caching.

---

## 9. Work Log (Changelog)

| Date | Step | Description | Verification |
|---|---|---|---|
| 2026-08-25 | Feature | **Proxy multi-tenant** (un proceso sirve a muchos usuarios): `Gateway` pasa de un único `ProxyClient handler` a `byConn` (`Map<WebSocket,ProxyClient>`) + `byAccount` (`host|username` → sesión); `ProxyClient` gana `attach(WebSocket,requestId)` (misma cuenta reusa sesión vía `isSameSession`) y registra/desregistra su `accountKey` en el `Gateway`. `Main` deja de crear un `ProxyClient` singleton/auto-connect; el shutdown itera `gateway.getSessions()`. `GatewayProtocolIntegrationTest` migrado al nuevo modelo. Añadido `scripts/multi-tenant-test.mjs` (Node: aislamiento entre cuentas + adjunte de misma cuenta) y `web/e2e/multi-user.spec.ts` (Playwright 2 contextos: ambos entran y uno ve la mesa del otro) | `mvn -pl Mage.Proxy -am test` 18/18 ✅; `node scripts/multi-tenant-test.mjs` 6/6 ✅; `self-test`+`human-test` ✅; `web/e2e/multi-user.spec.ts` (real, localhost) ✅ |
| 2026-08-25 | QA/Feature | **Detector reverse-drift de mecánicas**: `scripts/view-schema.mjs` extrae el conjunto exhaustivo de campos serializables de las clases `mage.view.*` del server (oráculo derivado de las reglas de reflexión de `JsonUtil`, no de partidas grabadas) → `web/fixtures/server-view-schema.json`. `web/src/state/mechanicsCoverage.test.ts` difumina ese oráculo contra los campos modelados en `contract.schema.json` y falla si el server emite un campo que el cliente no modela (anti-drift automático, sin enumeración manual). Al correrlo solo faltaban 16 campos de carta de datos/ayuda de render (split-cards, selección, arte) — ya añadidos a `contract.schema.json` + `types.generated.ts`. Hallazgo corregido: **`goad`/`goaded` SÍ se emite** — el motor añade la restricción "Goaded by X (must attack)" a `rules` y a un icono `OTHER_HAS_RESTRICTIONS` de `cardIcons` (`CardView.java:758-773`), así que el cliente lo muestra como badge de restricción (`CardIcons.tsx`); el campo `goadingPlayers` no va en el DTO pero su info llega por el icono. Para cubrir la *segunda* dimensión de drift (estado del motor no serializado en `mage.view.*`) se añadió el **tercer guard** `engineViewCoverage.test.ts` + `scripts/engine-view-schema.mjs` (baseline `engine-view-gap.baseline.json`) que rastrea esos gaps reales (p.ej. `harnessed`/`monstrous`/`renowned`/targeting de jugador). | `node scripts/view-schema.mjs` ✅; `mechanicsCoverage.test.ts` 6/6 ✅; `node scripts/engine-view-schema.mjs` ✅; `engineViewCoverage.test.ts` 3/3 ✅; `gen-types:validate` + `typecheck` ✅ |
| 2026-08-25 | QA/Refactor | Contract anti-drift: (1) Plan A (`9e91197a04`) — `gameViewSchema` generado desde `contract.schema.json` (`scripts/gen-zod.mjs` → `web/fixtures/schema.generated.ts`), consumido por `schema.ts`; centralizadas las constantes de test en `deck-names.ts`/`table-names.ts`/`fake-mode.ts` (`FAKE_MODE = process.env.E2E_BACKEND !== 'real'`), reemplazando literales en 16 specs de mazos, 19 escenarios/tablas y 15 `fakeOnly()`. (2) Drift fix (`4a2e8aac48`) — `types.generated.ts` regenerado para casar con el contrato: conserva `CardView.sourceCard` y `UsersView.avatarId` (el server XMage los sigue enviando; verificado en `StackAbilityView.java`/`UserDataView.java`) y elimina 11 campos muertos (`CardView.white/blue/black/red/green`, `isSecondCardFace/isFrontFace/isBackFace`, `GameEndInfo.matchId/result/games`); las banderas sintéticas de preview `isFrontFace/isSecondCardFace` se castean en `FloatingCardPreview.tsx`/`CardPreview.tsx`. CI añade `gen-types:validate` (junto a `gen-zod:validate`) para fallar ante futuro drift | tsc ✅; vitest 354/354 ✅; e2e fake 31/1 ✅; `gen-types:validate` + `gen-zod:validate` en sincronía ✅ |
| 2026-08-24 | Bug/Fix | Fixed pre-existing `mulligan.spec` fake failure: the dedicated MulliganDialog renamed the keep button to "✋ Mantener (N)", but the spec still clicked `/Mantener mano/i` — never matched, and with no `actionTimeout` configured the click hung until the 120s global timeout (the London test passed because its substring `/Mulligan/` still matched). Selector is now scoped to `.mulligan-dialog` + `/Mantener/` | e2e fake **27/27** ✅ (7.8m) |
| 2026-08-24 | Feature/Bugfix | Stack controller attribution (kills the "Desconocido" pill when spectating): fork `CardView`/`StackAbilityView` now populate & serialize `controllerId`/`controllerName` via reflection serializer (covers local-server games); web consumes them typed in `StackZone.getControllerInfo`; NEW pure module `web/src/game/stackAttribution.ts` infers controllers on unpatched public servers (beta.xmage.today builds its GameViews remotely without the patch): abilities attributed by locating `sourceCard.id` in per-player zones (battlefield/graveyard/exile), new-since-prev-frame spells attributed to previous `priorityPlayerName` (fallback `activePlayerName`), carry-forward across frames, never overwrites server-provided data; wired in `eventHandler` GAME_UPDATE/GAME_INIT path (fresh attribution per game). Schema updated + types hand-edited (`npm run gen-types` still drops live fields — known tooling gap). **Confirmed live by user watching beta.xmage.today** | vitest 349/349 ✅; typecheck ✅; build ✅; java `mvn -pl Mage.Proxy -am test` 34/34 ✅; e2e fake 26/27 → 27/27 after mulligan fix |
| 2026-08-24 | UI/Fix | Responsive Battlefield & Rotation Geometry Polish: (1) resolved left-edge card clipping/disappearing on tap by upgrading flex bands to `justify-content: safe center` with padding boundaries; (2) implemented conditional Command Zone collapsing in `PlayerZone` and `OpponentZone` via `hasCommandObjects` to free full 100% row width for creatures when no commander is in the zone; (3) expanded `CardSlot` to render distinct counter badges for Shield (🛡️), Stun (⚡), Oil (🛢️), Finality (⏳), +1/+1 and -1/-1 | vitest 309/309 ✅; typecheck ✅; build ✅; e2e 23/23 ✅ (7.4m) |
| 2026-08-24 | Bug/Fix | Game Log (ActionFeed) only shows match events now. Root cause: the single `log` store mixed chat, lobby join/leave (`g-dogg has joined`, `gabrielk12 has left XMage`) and game-log lines, and unmatched lines fell back to `type:'system'` (🏆). Fix: route each `CHATMESSAGE` by XMage `messageType` (`GAME`→game log, `TALK`→Chat tab, `STATUS`/`USER_INFO`→system noise) via a new `channel` field on `LogEntry`; `ActionFeed` filters to `channel==='game'` and `GameChat` to `channel==='chat'`. No proxy rebuild needed — `JsonUtil` already serializes the whole `ChatMessage` (incl. `messageType`); updated `Mage.Proxy/README.md` contract. Fallback heuristic keeps the fake test server (no `messageType`) working | vitest 310/310 ✅; typecheck ✅; e2e chat 3/3 ✅ |
| 2026-08-23 | F2/F3 | Advanced Stack & Priority Suite (Block B): implemented `holdPriority` setting and UI toggle in `GameScreen` with `Ctrl`/`Cmd` key support; connected `HOLD_PRIORITY`/`UNHOLD_PRIORITY` actions via WebSocket; updated `HelpWikiModal` with full Stack, Priority, APNAP trigger ordering, and Storm rules; created deterministic scenario & Playwright E2E covering (1) Hold Priority response loop with *Infernal Tutor* + *Lion's Eye Diamond*, (2) APNAP simultaneous trigger stacking (*Soul Warden* + *Impact Tremors*), and (3) Storm count copies with re-targeting (*Grapeshot*) | vitest 306/306 ✅; typecheck ✅; e2e stack-priority 1/1 ✅ (3.1s) |
| 2026-08-23 | UI/Polish | Resource Piles Top Card Rendering & Hover Preview: upgraded `ResourceBar` to display the HD card artwork of the top card in Graveyard, Exile, and Cross-Zone (Ray stack) with count badge and mini-lightning icon; added full hover card preview & Scryfall resolution on resource stacks; updated `CardSlot` data-attributes | vitest 306/306 ✅; typecheck ✅; e2e cross-zone 2/2 ✅ |
| 2026-08-23 | F2/F3 | Complex Casting Costs Suite & E2E Validation: implemented Phyrexian mana symbols (`{U/P}`, `{W/P}`, etc. with $\Phi$ icon badges and gradients), hybrid mana badges, Convoke/Improvise board tapping guidance in `mana-prompt-bar`, and dedicated E2E test scenario covering (1) Phyrexian life payment with live 20→18 HUD life update, (2) Kicker confirmation with 4-damage resolution to opponent (20→16), (3) Split cards (Fire // Ice) modal choice, (4) Adventure/MDFC (Bonecrusher Giant // Stomp) choice, and (5) Convoke creature tapping on the battlefield | vitest 303/303 ✅; typecheck ✅; e2e complex-costs 1/1 ✅ (5.8s) |
| 2026-08-22 | F2/F3 | Comprehensive MTG Interactions Suite & Visual Showcase: built E2E test scenario covering `GAME_ASK` (Shockland binary prompts), `GAME_CHOOSE_COLOR` (mana color picker), `GAME_CHOOSE_PILE` (Fact or Fiction split piles), `CardGrid` (Demonic Tutor search with Scryfall HD art), `LibraryOrderDialog` (Scry 3 Top/Bottom order), and Command Zone Commander Tax (+2 badge & cast); updated `GAME_ASK` fallback and added `skipAsks` flag to `HumanHelper` | vitest 286/286 ✅; typecheck ✅; e2e interactions 1/1 ✅ (5.7s) |
| 2026-08-22 | F2/F3 | Universal Playable Objects Audit & Mana Floating: audited and unified `canPlayObjects` resolution across all zones (Hand, Battlefield lands & activated abilities, Command Zone commanders & companions, Graveyard, Exile, Library top card); fixed land tapping during regular priority to float mana before casting spells | vitest 286/286 ✅; typecheck ✅; e2e combat 4/4 ✅ |
| 2026-08-22 | F2/F3 | Combat Visuals & Mechanics Polish: multi-blocker arrows convergence, damage assignment ordering (`LibraryOrderDialog` in blocker mode), numeric damage distribution, 90° tapping rotation on attack with Vigilance exception handling, vertical blocker orientation, and automated E2E screenshots | vitest 285/285 ✅; typecheck ✅; e2e combat 4/4 ✅ |
| 2026-08-22 | F2/F3 | Mechanics & Reminder Tray Widget: added dedicated 2x2 tab in right-panel for global states (The Ring 4-level progressive breakdown & bearer, Active Dungeons room flow & tracker, Day/Night banner & transition rules, Monarch, Initiative, City's Blessing, Speed) with responsive 250px layout | vitest 285/285 ✅; typecheck ✅; build ✅; e2e mechanics 1/1 ✅ |
| 2026-08-22 | F2/F3 | Comprehensive Mechanic Badges & HD Token Previews: added The Ring (level 1-4), active Dungeons, Day/Night, Curses, specialized designations (City's Blessing, Speed, Enduring Story) and connected interactive hover preview for all badges and counters via Scryfall | vitest 279/279 ✅; typecheck ✅; build ✅; e2e 18/18 ✅ |
| 2026-08-21 | T | Repaired e2e suite after lobby rework: best-of-3/5 cursor bugs (`waitFrame` has no `.index`; NaN cursors skipped every frame), fixture `END_GAME_INFO` aligned with real `GameEndView` (`<sim> won the match!`, "You need N more wins…" also after losing a game) | fake e2e 18/18 ✅ |
| 2026-08-21 | T | Fixed real-mode e2e blockers: (1) page+HumanHelper pointed at fake port instead of proxy WS 8787 (`PROXY_PORT` in `e2e/dual.ts`); (2) demo launcher lost the explicit `startMatch` — the server never auto-starts IA-vs-IA tables (the fake scenario was emulating it); (3) empty-lobby second "Crear Nueva Mesa" button broke `/Nueva mesa/i` selector; (4) spectator Log tab auto-switches to Stack on live games | full-flow + combat + lobby-chat green in `E2E_BACKEND=real` |
| 2026-08-21 | T | Port split fix: fake FixtureServer moved **8788→8789** — 8788 is the Java proxy's HTTP test page and collides whenever the stack is up (fake suite silently depended on the proxy being stopped) | fake 18/18 with stack up ✅ |
| 2026-08-21 | T | Real-mode triage: spells/targeting/cross-zone/combat-human/best-of-N/defeat marked **fake-only** (`test.skip(!FAKE_MODE)`): they depend on fixture-scripted windows; vs a live server the HumanHelper auto-pass races server timers (games sprint to turn ~110 before the test acts). Real suite = full-flow, combat, lobby-chat. Pending: helper redesign to HOLD priority in main when the test wants to act | `E2E_BACKEND=real`: 3 pass / 15 skipped ✅ |
| 2026-08-08 | F0 | Built `Mage.Proxy` (client, gateway, json, deck, main) + test harness page | Compiled via `mvn -pl Mage,Mage.Common,Mage.Sets,Mage.Server,Mage.Proxy -am package` |
| 2026-08-08 | F0 | Local server configured in `local-server/` with plugins and test mode | Login, lobby, chat, table creation, startMatch OK |
| 2026-08-08 | F0 | Verified complete event flow: `START_GAME`, `GAME_INIT`, `GAME_UPDATE`, `GAME_ASK` in JSON | Test harness at `http://localhost:8788/index.html` |
| 2026-08-08 | F0 | Repo hygiene: `.gitignore` (local-server, target, plugins), root `pom.xml` module registration | `git status` clean |
| 2026-08-08 | F1 | Master document & stack decisions established (React + Vite + TS + PixiJS) | Approved |
| 2026-08-08 | F1.1 | Environment: Node.js v24.19.0 and `web/` scaffolding initialized | `npm install` + `vite dev` OK |
| 2026-08-08 | F1 | Built web client (types, Gateway, store, lobby, Pixi board, cards, game log) | typecheck + build clean |
| 2026-08-08 | F1 | Spectator crash fix: `game.players` undefined guards & types | `vite.log` 0 page errors |
| 2026-08-08 | F1 | Proxy session thrash fix: idempotent connect logic | self-test 15/15, E2E 0 page errors |
| 2026-08-08 | F1 | Leaked ResizeObserver fix: proper disconnect in cleanup | Playwright 0 TypeError |
| 2026-08-08 | F1 | Vitest unit tests (zones, gameToScene, Gateway, store) + fixtures | 38/38 PASS |
| 2026-08-08 | F1 | Orchestration scripts (`test.mjs`, `install.mjs`, `ctl.mjs`) | `node scripts/test.mjs` all green |
| 2026-08-08 | F1 | Playwright E2E full-flow (login → lobby → spectator demo → board progression) | 1/1 PASS, 0 page errors |
| 2026-08-08 | Hardening | Local-first proxy security: loopback bind, origin allowlist, WS limits, canonical path traversal, per-connection auth | Maven proxy tests + WS integration ✅ |
| 2026-08-08 | Contract | Enforced `requestId`, `errorCode`, `protocolVersion`, and required `gameId` in game actions | 14 Java tests + 53 web tests + typecheck/build ✅ |
| 2026-08-09 | F2 | Corrected priority boolean semantics, `GAME_UPDATE_AND_INFORM.gameView`, typed `canPlayObjects` | 60 web tests + typecheck ✅ |
| 2026-08-09 | F2 | Explicit target feedback, player targeting, optional targets, special payments | Vitest + coverage ✅ |
| 2026-08-09 | F2 | Highlighted playable cards & click-to-dispatch `sendPlayerUUID`; extended `human-test` through *Lightning Bolt* resolution | Build + 14 Java tests ✅ |
| 2026-08-09 | F2 | Fixed boolean mulligan semantics (TRUE=mulligan/FALSE=keep) in `feedback.ts`, `store.ts`, and `human-test.mjs` | 62 web tests + typecheck + build ✅ |
| 2026-08-09 | F2 | Random starting player selection handling in `GAME_TARGET` | Empirically verified via event dumps |
| 2026-08-09 | F2 | London mulligan library bottoming resolution in `GAME_TARGET` | Confirmed server re-ask loops |
| 2026-08-09 | F2 | "Any target" selection logic pointing to opponent player UUID | Verified life drop 20→17 |
| 2026-08-09 | F2 | Complete `human-test.mjs` green: roll → mulligan → land → turns → *Lightning Bolt* → target → mana → resolution → quit | 26 checks PASS; full suite 7/7 ✅ |
| 2026-08-10 | Env | Rebuilt macOS development environment: Java 17.0.20 + Maven 3.9.16, regenerated `local-server/` with 27 plugins | `install.mjs` + `build.mjs proxy` ✅ |
| 2026-08-10 | Infra | Fixed macOS daemon spawning: absolute path resolution in `javaBin()` | ctl.mjs start/restart stable |
| 2026-08-10 | F2 | Visual targeting overlay in `BoardScene`: pulsating outlines, animated dotted lines from source to targets, player targeting rings | unit + typecheck ✅ |
| 2026-08-10 | F2 | UI mana payment: non-blocking `GAME_PLAY_MANA`, color pool buttons (`sendPlayerManaType`), board source tapping | unit + typecheck ✅ |
| 2026-08-10 | F2 | Human vs AI lobby workflows: creator auto-seat, AI seat joining | full-flow E2E ✅ |
| 2026-08-10 | F2 | Visual targeting E2E (`e2e/targeting.spec.ts`): browser-driven match with canvas pulse verification | 2× PASS in sequence |
| 2026-08-10 | F2 | Multi-target UX: `chosenTargets` parsed in `feedback.ts`, chosen targets highlighted in green with checkmark badge | unit 67/67 + typecheck ✅ |
| 2026-08-10 | F2 | `ADVANCED_DECK` (Blaze, Arc Trail, Boros Charm, Walking Ballista) + deck selector in `CreateTableDialog` | typecheck ✅ |
| 2026-08-15 | F2 | Verified Phase 2 close: 100-card AI deck, preferential land discarding, complete advanced scenario | `human-test` 83 checks ALL PASS ✅ |
| 2026-08-15 | F2 | Re-architected `e2e/spells.spec.ts` into 4 serial independent tests (Blaze, Arc Trail, Boros Charm, Ballista) | E2E 6/6 PASS ✅ |
| 2026-08-15 | F2 | Scene-driven E2E clicking: `window.__mageScene` exposes live card coordinates and playable state | Boros→Ballista misalignment eliminated ✅ |
| 2026-08-15 | F2 | Color-aware mana payment: `payMana` parses required mana strings and taps matching color sources | Clean payment without server re-asks ✅ |
| 2026-08-16 | F2 | Simulated Bot Opponent (`SIM` seat in proxy): `SimPlayer.java` with independent server session playing lands, spells, attacking, and blocking | Java tests 18 ✅; unit 90 ✅; combat/targeting/full-flow ✅ |
| 2026-08-16 | F2 | WS `HumanHelper` (`e2e/wshelper.ts`): node helper managing lands, discards, and priority yielding over WS | unit 90 ✅; typecheck ✅ |
| 2026-08-16 | Arq | Dual-mode deterministic testing: `FixtureServer` (`fixtures/fake.ts`), declarative scenarios, zod schema anti-drift testing | unit 95/95 + typecheck ✅; fake full-flow 9s ✅ |
| 2026-08-16 | Arq | Deterministic UI assertions: `BoardScene` publishes `__mageScene.targeting` replacing canvas byte-diffs | typecheck ✅ |
| 2026-08-16 | F2 | Resolved Sim victory bug: caused by degraded server state with orphaned proxy sessions; resolved by coupled restarts | targeting 12.9s ✅; spells 4/4 ✅ |
| 2026-08-16 | F2 | Resolved spectator freeze bug: `SimPlayer.tryCast` made color-aware to avoid infinite GAME_SELECT loops | trace verified; demo casts ✅ |
| 2026-08-17 | F2 | Modular E2E suite (`web/e2e/support/`): shared DSL libraries, fake scenarios in `fixtures/scenarios/` | fake 7/7 ✅; real 7/7 ✅; unit 97/97 |
| 2026-08-17 | Up | Upgraded to upstream XMage 1.4.61-V1: cleanly merged upstream tags, updated proxy parent POM, set default host to `beta.xmage.today` | full suite 8/8 PASS ✅; real E2E 7/7 PASS ✅ |
| 2026-08-17 | Fx | Handshake buffer for `SHOW_USERMESSAGE` in `ProxyClient.java`: buffers early server messages until connected | unit/typecheck/build/java/self-test PASS ✅ |
| 2026-08-18 | Arq | Complete Board UI layout redesign: CSS Grid macro layout, `SideLayout` zones with creature/other/land bands, easing repositioning | unit 122/122 ✅; typecheck ✅; build ✅ |
| 2026-08-20 | Arq | Store refactoring: split `store.ts` into 7 cohesive modules (`state`, `persistence`, `gameUtils`, `eventHandler`, `gateway`, `selectors`, `actions`) | unit 75/75 ✅; typecheck ✅; 0 breaking consumer changes |
| 2026-08-20 | Arq | Java→TS JSON Schema codegen pipeline: `contract.schema.json` with `gen-types.mjs` and CI validation | typecheck ✅; `--validate` PASS ✅ |
| 2026-08-20 | Fix | Non-modal floating combat prompt bar and step-gated blocker declarations | unit 75/75 ✅; typecheck ✅; build ✅ |
| 2026-08-20 | Fix | Verified human combat E2E 4/4 and restored `HumanGame.start()` in fixture server | vitest 104/104 ✅; combat-human 4/4 ✅ |
| 2026-08-21 | F2/F3 | Persistent connection & clean reconnect: 60s disconnect grace period, localStorage session caching, auto-rejoin on F5 | vitest 132/132 ✅; Java 18/18 ✅ |
| 2026-08-21 | F2/F3 | Token and Ability Art Resolution: Scryfall multi-tier token lookups, source card extraction for abilities, multi-face card tabs | vitest 140/140 ✅; typecheck ✅; build ✅ |
| 2026-08-21 | F2/F3 | Cascading LIFO Stack UI: vertical cascading stack with topmost active spell, thumbnail strips, and integrated Resolve button | vitest 145/145 ✅; StackZone.test.tsx ✅; build ✅ |
| 2026-08-21 | F2/F3 | Floating HD Card Preview & hover stabilization on hand and battlefield slots | vitest 149/149 ✅; FloatingCardPreview.test.tsx ✅; build ✅ |
| 2026-08-21 | F2/F3 | Floating action prompt bars (`GAME_PLAY_MANA`/`GAME_TARGET`) & `FormattedText` component for mana badges and entity decoding | vitest 154/154 ✅; FormattedText.test.tsx ✅; build ✅ |
| 2026-08-21 | F2/F3 | Comprehensive UI Modernization (Arena-grade): Reactive ActionButton with global Space key, unified PhaseBar with stop toggles, circular PlayerInfoBar with priority ring | vitest 154/154 ✅; typecheck ✅; build ✅; java ✅ |
| 2026-08-21 | Fix | Combat attacker/blocker toggle de-selection and tapped combatant state management | vitest 154/154 ✅; typecheck ✅; build ✅ |
| 2026-08-21 | F2/F3 | Vertical layout proportion fixes and expanded card-sized resource piles (~68x96px) | vitest 154/154 ✅; typecheck ✅; build ✅ |
| 2026-08-21 | Fase A1 | SVG Bézier Combat & Target Arrows overlay and player avatar target glow | vitest 156/156 ✅; typecheck ✅; build ✅ |
| 2026-08-21 | F2/F3 | Full Match HUD Parity: Player priority clocks, match win gems, revealed top library card, summon sickness spiral for creatures | vitest 156/156 ✅; typecheck ✅; build ✅ |
| 2026-08-21 | Fase A2 | Dedicated CommandZone: Commander card renders with tax badge (`+{tax}`) and Planeswalker emblem trays | vitest 159/159 ✅; typecheck ✅; build ✅ |
| 2026-08-21 | Fase A3 | Interactive Scry / Surveil / Library Order Dialog & revealed opponent hand cards | vitest 165/165 ✅; typecheck ✅; build ✅ |
| 2026-08-21 | Feature | Live Structured Action Feed (`ActionFeed.tsx` & `gameEventParser.ts`) with live game log subscriptions | vitest 183/183 ✅; typecheck ✅; build ✅ |
| 2026-08-21 | Fix | Game session isolation and stale packet drop guards | vitest 184/184 ✅; typecheck ✅; build ✅ |
| 2026-08-21 | Fase 3 | Redesigned Lobby and Login Screen: animated mana orbs, 3-column table grid, deck manager with text list import | vitest 194/194 ✅; typecheck ✅; build ✅ |
| 2026-08-21 | UI/Fix | Unified vertical Stack card template, compact 250px right panel, and global targeting arrows | vitest 195/195 ✅; typecheck ✅; build ✅ |
| 2026-08-21 | Fix | Transform / MDFC back face artwork resolution in card preview inspector | vitest 197/197 ✅; typecheck ✅; build ✅ |
| 2026-08-21 | Feature/Fix | Universal HTML/Text sanitizer in `FormattedText.tsx` & interactive card hover previews across all chats and logs | vitest 199/199 ✅; typecheck ✅; build ✅ |
| 2026-08-21 | Feature | Interactive Library Stack & Card Viewer with standard card back | vitest 203/203 ✅; typecheck ✅; build ✅ |
| 2026-08-21 | UI/UX | High-definition card modals (210px cards) for direct reading without zoom | vitest 203/203 ✅; typecheck ✅; build ✅ |
| 2026-08-21 | Feature/UX | Modern Lobby Table Filter Bar: Omnibox search, format chips, open seats filter, and collapsible advanced options | vitest 211/211 ✅; typecheck ✅; build ✅ |
| 2026-08-21 | Feature/UX | Interactive Spectator Staging Screen: live 1v1 and pod staging room for waiting tables | vitest 214/214 ✅; typecheck ✅; build ✅ |
| 2026-08-21 | Fix/UI | Sanitized global system messages in ChatBox and join/leave notification toggle | vitest 217/217 ✅; typecheck ✅; build ✅ |
| 2026-08-21 | Fix | Chat room isolation and automatic `leaveChat` cleanup on table exit | vitest 219/219 ✅; typecheck ✅; build ✅ |
| 2026-08-21 | Feature/UX | Quick Deck Selector on Join Table Dialog with inline text decklist importer | vitest 222/222 ✅; typecheck ✅; build ✅ |
| 2026-08-21 | Fix | Robust lobby user list extraction supporting Array of RoomUsersView and direct UsersView wire formats | vitest 226/226 ✅; typecheck ✅; build ✅; Playwright e2e ✅ |
| 2026-08-21 | Feature/UX | Advanced Table Creation Dialog with categorized tabs (General, Clocks & Rules, Security & Passwords, Bot Seats with Custom Decks) | vitest 230/230 ✅; typecheck ✅; build ✅; java ✅; Playwright e2e ✅ |
| 2026-08-22 | Feature/UX | MTG Keywords Hover Tooltips (Arena-style) & In-Client Rules Wiki Modal: dynamic rule parsing, bilingual glossary with live search, turn phases guide, keyboard shortcuts reference | vitest 293/293 ✅; typecheck ✅; build ✅; Playwright e2e ✅ |
| 2026-08-22 | Feature/UX | Fullscreen Web Mode (in-game sidebar & lobby top bar), Real-time Dynamic Priority Chess Clocks (`useTickingTimer`, hours formatting `1:55:08`), and Automated Extraction of 267 MTG Keywords from XMage rules engine | vitest 302/302 ✅; typecheck ✅; build ✅; Playwright e2e ✅ |
| 2026-08-24 | Feature/Fix | Priority & Stack Suite (Bloque B): Hold Priority toggle with Ctrl+Click, APNAP trigger ordering, Storm copy cascade stack view & Ability Tiles | vitest 307/307 ✅; typecheck ✅; Playwright E2E 23/23 ✅ |
| 2026-08-24 | Fix/UI | Battlefield Card Polish: Eliminated boolean-coercion text node "0" on undamaged creatures, vertical tab cascade for auras/attachments, top-left sickness badge relocation, and removed dead targeting overlay | vitest 309/309 ✅; typecheck ✅; Playwright E2E 23/23 ✅ |
| 2026-08-24 | Fix/UI | Modal & Arrow Layering: React Portal for `PileOverlay` (z-index 100), elevated feedback/grid backdrops (z-index 90), defeat overlay over arrows (z-index 30 vs 28), and filtered defeated player arrows | vitest 309/309 ✅; typecheck ✅; build ✅ |
| 2026-08-24 | Feature/UX | Stack Player Identification: Controller Ribbons with avatar, controller name, color-coded badges (cyan `[👤 Tú]` vs red `[🤖 Opponent]`) and left border accents across compact/expanded views | vitest 310/310 ✅; typecheck ✅; build ✅ |
| 2026-08-24 | UI/UX | HUD Corner Alignment & HD Card Preview: Anchored PlayerInfoBar to top-left (opponent) and bottom-left (player) corners, enlarged FloatingCardPreview to 320x448px with 240px keywords sidebar | vitest 310/310 ✅; typecheck ✅; build ✅ |
| 2026-08-24 | F2/F3 | Missing Server Prompts E2E Suite: new `missingPrompts` FixtureServer scenario + `missing-prompts.spec.ts` covering the 9 supported-but-untested `feedback.ts` prompts (`GAME_SELECT_PLAYER`, `GAME_CHOOSE_STRING` list + free-text, `GAME_CHOOSE_NUMBER`, `GAME_CHOOSE_ONE`, `GAME_CHOOSE_BETWEEN`, `GAME_CHOOSE_MODE`, `GAME_TARGET_AMOUNT`, `GAME_SELECT_CARDS` multi, `GAME_PLAY_XMANA`); fixed `FeedbackDialog` to render a free-text input for `GAME_CHOOSE_STRING` with no options; added 10 unit tests in `feedback.test.ts` | vitest 315/315 ✅; typecheck ✅; build ✅; e2e missing-prompts 1/1 ✅ (7.0s) · e2e 24/24 ✅ |
| 2026-08-24 | E2E/Tool | Global visual-verification screenshots: `autoShot` `auto:true` fixture in `e2e/fixtures.ts` captures a final `fullPage` PNG per test into `e2e/shots/<spec>__<title>.png` (and `-FAILED` on failure). Replaces the flaky `test.afterEach` approach (only fired for 1 test in combined runs); migrated `stack-priority.spec.ts` to import `test` from `./fixtures` so it inherits the fixture. All 24 E2E specs now emit a screenshot | e2e 24/24 ✅ (7.6m) · 24 screenshots generadas |
| 2026-08-24 | Fix/F2 | Callbacks perdidos del servidor: añadidos `GAME_CHOOSE_CARDS` y `GAME_TARGET_PLAYER` al parser `feedback.ts` (antes caían en `default`→`null` y se ignoraban en silencio). Eliminada la etiqueta `case 'GAME_SELECT':` redundante en el grupo de `GAME_SELECT_CARDS`/`GAME_SELECT_TARGETS` (código muerto inofensivo). Ampliado el escenario `missingPrompts`` y su E2E con los 2 prompts nuevos (flujo lineal: … CHOOSE_MODE → CHOOSE_CARDS → TARGET_PLAYER → TARGET_AMOUNT → SELECT_CARDS → PLAY_XMANA) | vitest 317/317 ✅; typecheck ✅; e2e missing-prompts 1/1 ✅ (8.0s) |
| 2026-08-24 | F2 | Callbacks críticos del servidor sin manejar: nuevo `UserRequestDialog.tsx` que renderiza `USER_REQUEST_DIALOG` (hasta 3 botones → `sendPlayerAction(PlayerAction)`), desbloqueando rollback / stop-until-* y otras confirmaciones que antes se ignoraban; `GAME_ERROR` ahora se muestra como error; `VIEW_LIMITED_DECK`/`VIEW_SIDEBOARD` abren `LimitedDeckDialog.tsx` (visor de cartas con `CardSlot`); `GAME_REDRAW_GUI` registrado. Nuevo estado `userRequest`/`viewer` en `state.ts`. Cubierto con `eventHandler.test.ts` (4 tests) y paso `USER_REQUEST_DIALOG` en `missing-prompts` E2E | vitest 321/321 ✅; typecheck ✅; e2e missing-prompts 1/1 ✅ (8.2s) |
| 2026-08-24 | Doc/Test | Registro de cobertura de interacciones: nueva matriz `web/INTERACTION_COVERAGE.md` (Tabla A: los 43 callbacks de `ClientCallbackMethod.java` con estado implementado/unit/E2E + ref; Tabla B: interacciones especiales como costes complejos/DFC/sagas/morph con su spec). Nueva guardia `web/src/state/callbackCoverage.test.ts` (capa `unit`) que lee el enum Java y falla si un callback no tiene `case` en `eventHandler.ts`/`feedback.ts` ni está en `KNOWN_UNHANDLED`, y si la matriz no lista todos los callbacks (anti-drift). `KNOWN_UNHANDLED` documenta Draft/Tournament/Replay como Slices A/B/C planeados | vitest 325/325 ✅; typecheck ✅ |
| 2026-08-24 | Doc | Catálogo completo de mecánicas de juego en `web/INTERACTION_COVERAGE.md`: la `Tabla B` se expandió a 13 categorías (A–M) cubriendo morfologías (MDFC/aventura/split/sagas/battles/tokens), adjuntos (aura/equipo/mutate), estados globales/contadores (Monarca/Anillo/Mazmorra/Día-Noche/Poison/Emblemas), keyword badges, info revelada, combate, stack/prioridad, maná/costes, elecciones/voting, biblioteca (scry/surveil/mill), planeswalkers, modos de juego (Commander/2HG) y miscelánea. Cada fila con estado ✅/⚠️/❌ auditado en `web/src` (CardPreview, CardSlot, OpponentZone, PlayerInfoBar, CommandZone, MechanicsTray, keywordExtractor, gameEventParser) y refs a specs E2E (mechanics, complex-costs, combat*, stack-priority). Documenta como pendientes: Mutate, Battles (spec), Sagas/Planeswalkers (solo render parcial), Scry/Surveil/Mill, Voting, Commander/2HG, Concede | typecheck ✅ |
| 2026-08-24 | Test | Cobertura E2E+unit de mecánicas implementadas sin test: enriquecido `fixtures/scenarios/mechanics.ts` (planeswalker con lealtad, token, battle, emblema y comandante en `commandList`, aura adjunta al oponente, `topCard` revelado, `game.revealed`) y ampliado `mechanics.spec.ts` (`@mechanics`) con aserciones de `.loyalty-badge`, `.defense-badge`, token, `.emblem-slot`, `.commander-slot`, `.attachment-subcard`, known hand y `.library-stack.has-top-revealed`. Añadido caso unitario en `feedback.test.ts` para el parser `GAME_CHOOSE_CARDS_ORDER`. Filas de `INTERACTION_COVERAGE.md` volteadas a ✅/✅ (tokens, auras/equipo, emblemas, poison/energy/city's blessing, revealed hand, lealtad PW, scry/surveil/mill, reorder, commander, battles) | vitest 326/326 ✅; typecheck ✅; e2e mechanics (fake) ✅ |
| 2026-08-24 | F2 | Concede real (T1): nueva `concedeGame(gameId)` en `actions.ts` que envía `PlayerAction.CONCEDE` al servidor (antes el botón solo hacía `returnToLobby`); usada por el botón `🏳️ Conceder` de `GameScreen` y el ítem `exit` de `Sidebar` (en espectador solo `returnToLobby`). Nuevo escenario `fixtures/scenarios/concede.ts` que responde a CONCEDE con `GAME_OVER`+`END_GAME_INFO`, y E2E `concede.spec.ts` (fake) + unit `concede.test.ts` que verifican el cableado y el retorno al lobby. Fila M (Concede) → ✅/✅ | vitest 328/328 ✅; typecheck ✅; build ✅; e2e concede (fake) ✅ |
| 2026-08-24 | F2/E2E | Mulligan (Keep + London): el auto-keep (`autoKeepMulligan`) impedía que la ventana de mulligan se pintara en los E2E; añadido gancho de debug `window.__mageStore.setSetting` y opción `autoKeepMulligan` en `startGame` para desactivarlo en test. Nuevo escenario estático `fixtures/scenarios/mulligan.ts` (no auto-avanza) que emite `GAME_ASK` de mulligan y, al elegir Mulligan, el `GAME_TARGET` de London-bottom. E2E `mulligan.spec.ts` (fake, 2 tests): (1) ventana visible + screenshot `shots/mulligan-01-window.png` + "Keep hand" → sigue la partida; (2) "Mulligan" → barra de target de London + clic en carta de mano → `sendPlayerUUID`. Los unit tests de mulligan ya existían (`feedback.test.ts`, `store.test.ts`). Fila M (Mulligan) → ref actualizada | vitest 328/328 ✅; typecheck ✅; build ✅; e2e mulligan (fake) 2/2 ✅ |
| 2026-08-24 | F2/UI | UI Mulligan dedicada (`MulliganDialog`): se añaden flags `isMulligan`/`isMulliganLondon` en `feedback.ts` (`prompt()` + GAME_ASK + GAME_TARGET con regex exacta `^select a card to put on the bottom of (your|the) library`) y `FeedbackPrompt`. `FeedbackDialog` enruta estos casos a `MulliganDialog` (nuevo), que reusa `HandZone`/`CardSlot` para mostrar la mano en abanico con arte real: en Keep/Mulligan dos botones grandes (verde "Mantener mano" / ámbar "Mulligan"); en London la mano es clicable para poner cartas al fondo (selección múltiple si `max>1`, contador). Reemplaza el modal genérico `.feedback-dialog` y la barra flotante `.action-prompt-bar.targeting-bar`. CSS en `MulliganDialog.css`. E2E `mulligan.spec.ts` actualizado a `.mulligan-dialog`. | vitest 328/328 ✅; typecheck ✅; build ✅; e2e mulligan (fake) 2/2 ✅ |
| 2026-08-24 | F2/Bug | Mulligan visible para el humano: el default `autoKeepMulligan` era `true`, así que `eventHandler` auto-contestaba el `GAME_ASK` de mulligan ("mantener") sin mostrar el diálogo → al crear mesa en localhost no aparecía la ventana. Cambios: (1) default `autoKeepMulligan: false` en `state.ts`; (2) guard de espectador en `eventHandler` (`isSpectator = !players.some(p => p.controlled)`) para que el auto-skip solo ocurra con el setting activo O siendo espectador (también en el ask de "jugador inicial"); (3) el helper E2E `startGame` ahora fuerza `autoKeepMulligan=true` salvo `false` explícito, preservando el resto de specs que dependían de auto-keep. El toggle en `GameScreen` sigue disponible. | vitest ✅; typecheck ✅; build ✅; e2e mulligan 2/2 + combat-multiblock ✅ |
| 2026-08-25 | F2 | Mecánica Mutate (fiel al protocolo real XMage): el server expone `PermanentView.mutateView` (tipo `MutateView` = `Record<id, CardView>`) con la composición de la pila (no solo el flag `mutated`). Añadido `MutateView`+`mutateView` al schema `contract.schema.json` y a `types.generated.ts` (edición manual, respetando la práctica de campos droppeados por `gen-types`). Render en `PlayerZone`/`OpponentZone`: rama `card-mutate-pile` con `.mutated-badge` (🧬) y sub-cards `.mutate-part` (constituyentes, arte Scryfall) detrás de la carta superior; se distingue de `.card-attachment-group` (auras/equipo). La activación de habilidades de la criatura fusionada ya funciona por el pipeline genérico (`canPlayObjects`→click→`sendPlayerUUID`→`GAME_CHOOSE_ABILITY`). Unit en `OpponentZone.test.tsx`; escenario `fixtures/scenarios/mutate.ts` + E2E `mutate.spec.ts` (`@mutate`, fake) que verifica pila/badge/parts y el click→`GAME_CHOOSE_ABILITY`. Fila Mutate en `INTERACTION_COVERAGE.md` → ✅/✅. Nota anti-drift: requiere verificar en modo real que el proxy serializa `mutateView` (Java `JsonUtil`); si no, pequeño fix en `Mage.Proxy`. | vitest 350/350 ✅; typecheck ✅; build ✅; e2e mutate (fake) 1/1 ✅ + regresión 12/12 ✅ |
| 2026-08-25 | F2/E2E-real | Verificación real de Mutate contra `beta.xmage.today`: el proxy (`Mage.Proxy`) conecta a beta (login OK, partida corre) y el mazo mutate IKO (formato `Constructed - Pioneer`, tierras `iko 272`) es aceptado por el servidor (criaturas + Forests en mano). **Hallazgo clave**: el proxy reenvía `mutateView` por reflexión (`JsonUtil.toJson` sobre el grafo de vistas XMage, `ProxyClient.java:317`); `PermanentView.mutateView` es `private final MutateView` (no static/transient) → llega al web intacto. **NO requiere cambio Java**. El play en vivo quedó BLOQUEADO por el modelo de sesión del proxy: el `HumanHelper` del harness abre un 2º WS con el mismo `username` que la página y `Mage.Proxy` rechaza sesiones duplicadas del mismo usuario (el `self-test` de Node sí funciona porque usa una sola conexión). Esto afecta a CUALQUIER E2E real que necesite el helper, no solo a mutate. Para cerrar el bucle real falta: (a) permitir la 2ª sesión en `Mage.Proxy`, o (b) grabar frames reales de una partida mutate (extender `scripts/self-test.mjs` o un recorder) y regenerar `fixtures/scenarios/mutate.ts` como fixture anti-drift. El render del cliente quedó verificado en fake; el forwarding del proxy, por inspección de código. | e2e mutate-real (real) corre contra beta pero el helper no conecta (sesión duplicada); fake mutate 1/1 ✅ |
| 2026-08-25 | F2 (Phase 2.5) | Match Chess Clock — cierre de paridad: el reloj de prioridad ya existía en `PlayerInfoBar` (`useTickingTimer` + badge `player-timer-badge`); se superficia `bufferTimeLeft` (campo del contrato hasta ahora sin usar) como subcadena `+MM:SS` y se añaden atajos de teclado **F4/F9** en `GameScreen` para alternar el "stop" de fin de turno (tu turno / turno del oponente) vía `updatePreferences`. Tests añadidos en `PlayerInfoBar.test.tsx` (badge con `priorityTimeLeftSecs`, clase `timer-low` ≤30s, buffer). `ROADMAP.md` §3 y `site/content.json` marcan "Match Clocks / Visible Timers" → ✅. Sin cambios de contrato → `callbackCoverage`/`mechanicsCoverage` siguen verdes. | vitest 352/352 (PlayerInfoBar + timer) ✅; typecheck ✅ |
| 2026-08-25 | F2 (Phase 2.5) | Cierre de DFC/Sagas y Card Selection Lists: (1) DFC/MDFC ya resuelven cara trasera en `cardImages.ts` (`isCardBackFace` considera `transformed`) y Sagas muestran contador `lore` (📖 + nº de capítulo) en `CardSlot.tsx:245`; (2) `GAME_CHOOSE_CARDS`/`GAME_SELECT_CARDS`/`GAME_SELECT_TARGETS` ahora enrutan a la grilla HD `CardGrid` (`FeedbackDialog.tsx`) en vez de la lista genérica de botones, con búsqueda y multi-select (`sendPlayerUUID`). Test añadido en `FeedbackDialog.test.tsx` (tutor → `CardGrid` → `sendPlayerUUID`). `ROADMAP.md` §3 y `site/content.json` marcan "Double-Faced Cards" y "Card Selection Lists" → ✅; `web/INTERACTION_COVERAGE.md` actualiza Sagas y añade fila de selección HD. | vitest 354/354 (FeedbackDialog + PlayerInfoBar + timer) ✅; typecheck ✅ |
| 2026-08-25 | F2 (Phase 2.5 follow-up) | Descarte interactivo desde reveal de mano (Thoughtseize): la mano revelada del oponente ya se muestra boca arriba en `OpponentZone` vía `game.revealed`+`game.opponentHands`; cuando el server pide descartar (`GAME_CHOOSE_CARDS`/`GAME_SELECT_TARGETS` con la mana ajena como `cardsView1`) la `FeedbackDialog` enruta a la grilla HD `CardGrid` y el clic envía `sendPlayerUUID` (descarte). Se añadió claridad de título: "Elige una carta para que descarte" cuando el mensaje coincide con `/descart|discard/i` (`feedback.ts`). Nuevo escenario fake `fixtures/scenarios/thoughtseize.ts` + spec E2E `e2e/reveal.spec.ts` (`@reveal`) que verifica diálogo, mano revelada, descarte y desaparición de la carta de la zona del oponente. `INTERACTION_COVERAGE.md` añade fila de descarte desde reveal. **Phase 2.5 queda completa.** | vitest 367/367 (feedback + FeedbackDialog + PlayerInfoBar + timer) ✅; typecheck ✅; e2e reveal 1/1 ✅ |
| 2026-08-25 | QA/E2E estability | Investigación y cierre de la cascada de fallos en la suite E2E fake (un spec lento/timbado envenenaba a los siguientes vía puerto compartido 8789). **Fix 1**: `missing-prompts.spec.ts` conducía `GAME_CHOOSE_CARDS`/`GAME_SELECT_CARDS` como `.feedback-dialog`/`.feedback-options`, pero `feedback.ts` los renderiza en `CardGrid` (`.card-grid-dialog`/`.card-grid-cell`) → los clics no aterrizaban. Corregido: `step()` genérico (`.feedback-dialog, .card-grid-dialog, .targeting-bar, .mana-prompt-bar`) y pasos 8/11 vía clic raw por `evaluate` sobre `.card-grid-cell` (el `.feedback-backdrop` intercepta el `.click()` de Playwright, igual que en `reveal.spec.ts`). **Fix 2**: `withFakeServer`/`FakeServer` ahora usan **puerto efímero por test** (`FakeServer.start(0)` + `getFakePort()/setFakePort()` en `e2e/support/fake-port.ts`) en vez del 8789 fijo; login y `HumanHelper` leen el puerto dinámico (`getFakePort()`), eliminando colisiones TIME_WAIT entre specs secuenciales. El server compartido por worker (`fixtures.ts`) sigue en 8789. | tsc ✅; vitest ✅; `npx playwright test` (suite fake completa) 32 passed / 0 failed / 2 skipped ✅; `missing-prompts` 3/3 ✅; `reveal` 20/20 ✅ |
| 2026-08-25 | UI/Refactor | Refactorizado simétrico del tablero (`BoardZone.tsx` + `BoardZone.css`): unifica la estructura de filas para jugador y oponente en 1vs1 y Commander (modo estándar y POD 2x2). La fila superior es el espejo exacto de la inferior (criaturas enfrentadas al divisor central, tierras al medio, barra de estado en el borde exterior). Corrige el recorte vertical de cartas (reemplazo de flex asimétrico 42%/58% por 50%/50% y corrección de `useZoneScale.ts` con cálculo exacto de altura segura). Animaciones espejo en manos (inferior hacia arriba, superior hacia abajo). `PlayerZone` y `OpponentZone` delegan a `BoardZone`. | vitest 381/381 ✅; typecheck ✅; build ✅; e2e 35/35 ✅ |
| 2026-08-26 | F5 (Stage 0) | Contrato Draft/Tournament: `contract.schema.json` añade `DraftView/DraftPickView/DraftClientMessage/DeckView/TableClientMessage/TournamentView/RoundView/TournamentPlayerView/TournamentGameView` + `SimpleCardView` extendido (expansionSetCode/cardNumber); `types.generated.ts` regen 414→430L. `ProxyClient.java` añade 12 actions (`createTournamentTable/joinTournamentTable/watchTournamentTable/getTournament/quitTournament/quitDraft/sendCardPick/sendCardMark/setBoosterLoaded/replayNext/Previous/SkipForward/stopReplay` + `getTournamentTypes/getDraftCubes` + `parseTournamentOptions`) y `state.ts` `draft/tournament/construct/replayViewer`. `eventHandler.ts` maneja `START_DRAFT/DRAFT_* (4)`, `CONSTRUCT`, `TOURNAMENT_* (5)`, `REPLAY_* (4)`; `callbackCoverage` vacía allowlist (todos manejados). | vitest 402 ✅; typecheck ✅; `mvn -pl Mage.Proxy -am test` 18/18 ✅ |
| 2026-08-26 | F5 Agent B | Draft & Sealed Construct: `DraftScreen.tsx` (booster grid SimpleCardsView + Scryfall, timeout live, `sendCardPick`/`setBoosterLoaded`/`sendCardMark`, picks tray) + `ConstructScreen.tsx` (pool 40 pool→deck con `ArenaCardStrip`, agrupación, timer auto-submit, `submitDeck`) + `CreateTableDialog.tsx` (LimitedDraftOptions + `MAX_COMMANDER=4`/`MAX_DRAFT=8`/`getEffectiveMaxPlayers`, UI draftSets/boosters/constructionTime). Fixture `scenarios/draft.ts` + `App.tsx` overlay. | vitest 409 ✅; typecheck ✅; build ✅; e2e draft 2/2 ✅ |
| 2026-08-26 | F5 Agent C | Torneo Swiss/Bracket: `TournamentBracket.tsx` (rounds bracket + standings sorted points) + `TournamentStandings.tsx` + `TournamentPanel.tsx` (overlay `state.tournament` con `TournamentBracket` compact) + `LobbyScreen.tsx` (`Ver bracket` + `getTournament` polling). Fixture `scenarios/tournament.ts` (sample 4 players/2 rounds). | vitest 417 ✅; typecheck ✅; e2e tournament 2/2 ✅ |
| 2026-08-26 | F5 Agent A | Commander Pod 4-max (sin tocar `BoardZone.css`): `PodBoard.tsx` wrapper `TwoHeadedBoard` (`clampedGame` `slice(0,4)` + `TurnOrderRing` + `CommanderDamageMatrix`) + `TurnOrderRing.tsx` (circular 3-4, pill 2) + `CommanderDamageMatrix.tsx` (Target×Commander 21 lethal) + `GameScreen.tsx` (`boardLayout==='pod' ? PodBoard : GameBoard`). `PodBoard.test.tsx` 12. `MAX_POD_PLAYERS=4` en `PodBoard/TurnOrderRing/CommanderDamageMatrix` + `CreateTableDialog.getEffectiveMaxPlayers` (XMage hard limit). `BoardZone.css` intacto verificado `git diff --stat`. | vitest 429 ✅; typecheck ✅; build ✅ |
| 2026-08-26 | F5 Integración | Fase 5 completa: todos los callbacks `INTERACTION_COVERAGE.md` Tabla A → ✅ (15 Slices A/B/C a log/UI), L/Tournament/Replay en `site/content.json` `done 2026-08-26` + `PROJECT.md` §2. Verif: `vitest 67 files 429` ✅; `typecheck` ✅; `vite build 193kB` ✅; `mvn Proxy 18` ✅; `playwright draft 2 + tournament 2 + PodBoard 12 unit` ✅; `git diff` sin `BoardZone.css` | — |
| 2026-08-28 | QA/Antidrift | **4º guard ServerState** (`scripts/server-state-schema.mjs` → `web/fixtures/server-state-schema.json` 17 gameTypes/52 deckTypes/4 playerTypes/21 tournamentTypes/46 cubes desde `Mage.Server/config/config.xml` + `MatchType` limits): `web/src/state/serverStateCoverage.test.ts` (7 tests: schema up-to-date, DEFAULT_GAME_TYPES/DEFAULT_DECK_TYPES válidos y exhaustivos, FakeServer válido). `CreateTableDialog.tsx` DEFAULTs expandidos a exhaustivos 1.4.61-V1 (`Two Player Duel`…`Custom Pillar`, `Constructed - Standard`…`Limited` 52), `fake.ts`/`draft.ts`/`tournament.ts` corregidos (`Three/Four Player`→`Free For All`/`Commander Free For All`, `Commander`→`Variant Magic - Commander`). `web/package.json` `gen-server-state[:validate]`, `web-ci.yml` step `Validate server-state schema`. `site/content.json` 4º guard `serverStateCoverage`. | vitest 68/436 ✅; typecheck ✅; build 715kB ✅; `gen-server-state:validate` ✅ |
| 2026-08-30 | UI/Commander | **Commander & Pod Layout Polish**: Desacoplados `TurnOrderRing` y `CommanderDamageMatrix` de `PodBoard` ganando 100% de altura de viewport en partidas de 4 jugadores con escalado de cartas dinámico (`clamp(80px, 6.8vw, 118px)`). `TurnOrderRing` integrado en la cabecera superior como cápsula de progresión de turno con avatares, prioridad y vidas. `CommanderDamageMatrix` movido a pestaña dedicada `👑 CMD` en el sidebar con diseño vertical en tarjetas de jugador (`.cdm-player-card`), barras de progreso codificadas por color (0-7, 8-14, 15-20, 21 letal), banner de alerta de peligro inminente y selector de vista `[📊 / ⊞]`. Rastreo exhaustivo de daño de comandante multizona (`battlefield`, `graveyard`, `commandList`, `counters`). | vitest 74 files / 461 tests ✅; typecheck ✅; build ✅; Playwright e2e ✅ |
| 2026-08-30 | Feature/Images | **XMage Image & Symbol Download Manager**: Implementado servicio de descarga persistente (`imageDownloader.ts`) y modal oficial de descarga (`DownloadImagesDialog.tsx`/`.css`). Soporta fuentes Scryfall (Normal ~10GB, Large ~15GB, Small ~1.5GB), alcances completos (`- ALL images` vía Scryfall Bulk Data, `- STANDARD`, `- MODERN`, `- COMMANDER`, `- MIS MAZOS`, `- TIERRAS BÁSICAS`, `- FICHAS`, o sets individuales), multihilo configurable (1-10 hilos), descarga de símbolos de maná y fases (`symbology` SVG), y caché persistente de navegador con `CacheStorage` (`xmage-card-images-v1`/`xmage-symbols-v1`) integrado con `cardImages.ts` para carga offline instantánea. Botón `📥 Imágenes` en la barra lateral del Lobby. | vitest 76 files / 466 tests ✅; typecheck ✅; build ✅ |
| 2026-08-30 | Feature/i18n | **Multi-Language (i18n) Engine & Card Artwork Localization**: Sistema tipado y reactivo de internacionalización (`web/src/i18n/`) con 5 idiomas completos de interfaz (`es`, `en`, `de`, `fr`, `ja`), hook `useTranslation()`, selector visual con bandera (`LanguageSelector.tsx`), persistencia en `localStorage` (`nexus_lang`) y soporte para ilustraciones multilingües de Scryfall (`nexus_card_lang`) en `cardImages.ts` con fallback automático. Integrado en cabecera del Lobby y barra de navegación. | vitest 78 files / 473 tests ✅; typecheck ✅; build ✅ |

---

## 10. Execution Notes

- Rule: At the completion of each step, update Section 6 (checklist) and Section 9 (changelog) with verified reality.
- Verification must always be performed against the live environment (local server + proxy), never in theory.
- Document any discoveries in Section 5 (lessons learned).
