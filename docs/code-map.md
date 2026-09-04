# Code map — where things live (verified 2026-09-05)

Line counts below are `wc -l` output. Section ranges for `ProxyClient.java` are approximate guides, not a contract.

## `web/src` — 368 files (158 tsx + 118 ts + 92 css)

| Folder | Files | What lives here |
|---|---|---|
| `board/` | 79 (21 css) | Battlefield rendering: `BoardZone` (shared zone layout), `PlayerZone`/`OpponentZone` (thin wrappers, do not merge), `GameBoard`/`PodBoard`/`ArenaBoard`/`TwoHeadedBoard`, `CardSlot`, `HandBar`, overlays (`Targeting`, `CombatArrows`, `FlyingCard`), sizing/scale hooks, `sceneBridge` (publishes `window.__mageScene` for E2E) |
| `game/` | 96 (32 css) | Match flow: `GameScreen` (layout router), `FeedbackDialog` (prompt router), `feedback.ts` (prompt parsing), `PhaseBar`, `StackZone`, `ActionFeed`, `SideboardScreen`, `DraftScreen`/`ConstructScreen`, dialogs (Mulligan, Voting, Planeswalker, LibraryOrder, Rollback) |
| `lobby/` | 62 (19 css) | `LoginScreen`, `LobbyScreen`, `CreateTableDialog` (wizard), `JoinTableDialog`, staging (`SpectatorStagingScreen`), chat, decks gallery/manager, tournament bracket, leaderboard |
| `decks/` | 60 (16 css) | `DeckBuilder`, search/list panels, Scryfall integration, import/export (Plain/DCK/Arena), curve chart, validation issues |
| `state/` | 18 + `events/` (8) | `state.ts` (`AppState`), `store.ts` (facade + `__mageStore`), `actions.ts`, `selectors.ts`, `persistence.ts`, `gateway.ts`, `eventHandler.ts` (envelope + event router), `events/` (chat/game/prompts/sideboard/draft/tournament/replay/views), `gameUtils.ts`, coverage guards |
| `net/` | 6 | `types.ts` (protocol truth: envelopes + `EVENT_METHODS`), `types.generated.ts` (generated, do not hand-edit), `Gateway.ts` (WS + reconnect), `commands.ts` (action wrappers) |
| `i18n/` | 16 | `types.ts` (TranslationSchema, master), `index.ts`, 9 locales (~980 lines each), `LanguageSelector` |
| `cards/` | 4 | `cardImages.ts` (Scryfall resolution + cache), `cardLocalization.ts` |
| `audio/` | 5 | `soundManager`, `soundSynthesizer`, `gameSoundDispatcher` |
| `data/` | 3 | `mtgKeywords.ts` (2951, generated via `scripts/extract-keywords.mjs`), extractor |
| `appearance/` | 5 | Playmat/sleeve settings + modals |
| `services/` | 2 | Image downloader/cache |
| `ui/` | 3 | `Icon`, `ErrorBoundary` |
| `utils/` | 4 | Timer, fullscreen |

## Biggest files first (refactor queue, incremental only)

| Lines | File | Responsibility | Plan ref |
|---|---|---|---|
| 1484→739+10 files | `Mage.Proxy/.../ProxyClient.java` (2026-09-05, R7 done) | Lifecycle/callbacks/lobby/connect + command router; `ProxyProtocol/JsonArgs/ErrorClassifier/MatchOptionsParser/SimManager/CommandContext/Info|Table|Tournament|GameCommands/CommandDispatch` |
| 1400→~110+7 files | `web/src/lobby/CreateTableDialog.tsx` + `CreateTable/` (2026-09-05, R1 done) | Create-table wizard shell + `constants.ts` (was lines 12-261: options/defaults/builders), `useCreateTableForm.ts` (state/effects/submit), `General/Timing/Security/Seats/DevTab.tsx`, `SummaryStrip.tsx`. Shell keeps default export + `export *` re-exports; guard `serverStateCoverage` repointed to `CreateTable/constants.ts` |
| 1160→~330+8 files | `web/src/lobby/LobbyScreen.tsx` (2026-09-05, R6 done) | Page shell; `lobbyUtils` (helpers+`LobbyTab`), `useTableActions`, `useTournamentBracket`, `LobbyHeader/Sidebar/TableCard/Aside/TournamentBracketModal` |
| 1040→~480+8 files | `web/src/decks/DeckBuilder.tsx` (2026-09-05, R6 done) | Composer; `deckCardOps` (puro+test), `useDeckMetadata/useDeckMutations/useDeckValidation`, `exportDeckFile`, `DeckBuilderFooter/DeckServerIssues/DeckHoverPreview` |
| 577→~70+6 files | `web/src/game/FeedbackDialog.tsx` + `useFeedbackForm.ts` + `feedbackModes/` (2026-09-05, R3 done) | Thin router (order/mulligan/voting/PW/starting/grid/target/mana/combat/generic); `StartingPlayer/TargetBar/ManaBar/CombatBar/GenericDialog` (kicker+títulos movidos a GenericDialog; `poolMana` a ManaBar; `sendValue` exportado del hook) |
| 542 | `web/src/game/SideboardScreen.tsx` | Bo3 sideboarding | — (stable, no split planned) |
| 516→~230+8 files | `web/src/state/eventHandler.ts` + `events/` (2026-09-05, R4 done: `context/chat/game/prompts/sideboard/draft/tournament/replay/views`) | Envelope (`handleMessage`) + event router con todos los `case` en orden (guard sin cambios); cuerpos por dominio con `Snapshot` compartido |
| 507→6 files | `web/src/game/feedback/` (2026-09-05, R3 done: `types/detect/record/text/parse/index`) | `parseFeedback(method, objectId, raw, t=defaultText)`; `detect.ts` sin import i18n; `callbackCoverage` escanea el directorio |
| 484 | `web/src/board/BoardZone.tsx` | Shared zone layout (20 optional props, 4 board callers) | — (do not split; reduce props only opportunistically) |
| 479 | `web/src/game/GameScreen.tsx` | Match layout router + WS handlers + targeting/combat | — (thin only when touching it) |
| 200 | `web/src/state/state.ts` | `AppState` compuesto por slices + runtime (`setState/getState/addLog`) — ver `slices/` | R5 done 2026-09-05: `slices/session| lobby|game|limited|settings` + barrel; `store.ts` facade intacta |

Cross-cutting: 21 `*Dialog|*Modal` total 5657 lines — shared base `ui/Modal.tsx` exists since 2026-09-05 (R2 pilot: Mulligan both branches via `trailing` preview slot + Voting; backdrop/dialog roles + aria preserved verbatim). Migrate remaining dialogs opportunistically. `board/` ↔ `game/` imports form a logical cycle (zones import game widgets and vice versa) → do not fix by moving folders in the incremental track; keep `features/` restructuring out of scope.

## `Mage.Proxy/src/main` — 18 files, 3556 lines

| Lines | File | Responsibility |
|---|---|---|
| 739 | `ProxyClient.java` | `MageClient` bridge: session lifecycle, callback forwarding (`{type:event,method,messageId,objectId,data}`), lobby timer, `connect/attach`, command router (`connect/disconnect/ping` + `CommandDispatch`), `requiresGameId` |
| 104 | `InfoCommands.java` | Info/chat/read commands (`getServerInfo/getTables/.../sendChatMessage`) |
| 91 | `TableCommands.java` | Table/match commands (`createTable/joinTable/leave/remove/start/watch`) |
| 108 | `TournamentCommands.java` | Tournament + draft commands |
| 173 | `GameCommands.java` | Replay/deck/preferences/`sendPlayer*` commands |
| 17 | `CommandDispatch.java` | `dispatch` → Info/Table/Tournament/Game (returns handled?) |
| 23 | `CommandContext.java` | Interface: session/gateway/isConnected/sendFailure/startSims |
| 64 | `ProxyProtocol.java` | `ERR_*` + `resultJson` envelope |
| 54 | `JsonArgs.java` | Defensive JSON arg readers + `parseActionData` |
| 36 | `ErrorClassifier.java` | Server-error → errorCode + prefix strip |
| 191 | `MatchOptionsParser.java` | `parseMatchOptions/parseTournamentOptions` from JSON |
| 110 | `SimManager.java` | SIM seats lifecycle (per-table bots, server endpoint) |
| 608 | `SimPlayer.java` | Deterministic test bot (land/turn, first payable cast, all-attack/all-block, keep, pass) |
| 385 | `DeckValidation.java` | Advisory pre-validation (`validateDeck`: `ready/missing/mismatches/fixedDeck/suggestions`), background card-DB build |
| 247 | `Gateway.java` | WS transport: `byConn`/`byAccount`, origin check, rate limit, pre-auth `connect/ping` only |
| 233 | `JsonUtil.java` | Reflection serializer (camelCase 1:1, skips null/static/transient/logger/Class/Throwable, UUID/Enum→string, Date→epoch) |
| 165 | `Main.java` | Entrypoint: WS + HTTP test page, anti-traversal |
| 120 | `Config.java` | CLI flags; defaults `beta.xmage.today:17171`, WS 8787 / HTTP 8788 / bind 127.0.0.1 |
| 89 | `DeckJson.java` | Deck JSON → `DeckCardLists` + promo/set normalization |

Tests: `src/test` (8 files) — `DeckValidationTest`, `GatewayProtocolIntegrationTest`, `SimPlayerTest`, `JsonUtilTest`, `ConfigTest`, `ProtocolTest`, `MainSecurityTest`, `GatewaySecurityTest`.

## `scripts/` — 24 files, 4975 lines

| File | Lines | Role |
|---|---|---|
| `lib.mjs` | 405 | Shared base: repo root, `.run/`, ports, daemon/pid/port helpers, server classpath, plugin copy |
| `dev.mjs` | 148 | Real logic: `start/stop/status/restart [server/proxy/vite/all]` (blocking diagnostics) |
| `ctl.mjs` | 45 | Thin wrapper: spawns `dev.mjs` detached, non-blocking |
| `tail.mjs` | 31 | Log reader: `tail [server/proxy/vite/all] [n]` |
| `build.mjs` | 46 | `proxy`-only vs full (base + plugins + copy to `local-server/plugins/` + package; stops proxy first) |
| `install.mjs` | 52 | Deps + jars from scratch (no start, no package) |
| `test.mjs` | 212 | 9 layers: `unit/coverage/typecheck/build/java/self-test/human-test/e2e/i18n` + `--skip=` |
| `human-test.mjs` | 1014 | Full human-vs-AI match driver (mulligan → spells → targets) |
| `self-test.mjs` | 284 | Headless proxy check (login → AI table → spectator) |
| `warmup.mjs` | 201 | Throwaway game vs cold-start `SESSION CALLBACK EXCEPTION` flake |
| `clean-tables.mjs` | 97 | Purge orphan tables (`maxGameThreads=10`) |
| `multi-tenant-test.mjs` | 129 | Cross-account isolation + same-account attach |
| `rec-lib.mjs` / `record.mjs` | 435 / 255 | Real-frame recorder → `web/fixtures/recorded/*.json` + `manifest.json` |
| `view-schema.mjs` | 130 | `mage.view.*` → `server-view-schema.json` oracle |
| `engine-view-schema.mjs` | 65 | `mage.game.*` not copied to view → gap baseline |
| `server-state-schema.mjs` | 206 | `config.xml` game/deck types → schema |
| `gen-types.mjs` / `gen-zod.mjs` | 160 / 141 | `contract.schema.json` → `types.generated.ts` / zod schema (+ `--validate` for CI) |
| `extract-keywords.mjs` | 369 | Engine keywords → `mtgKeywords.ts` |
| `i18n-coverage.mjs` | 213 | 894 keys + whitelist parity check |
| `gen-dashboard.mjs` | 245 | Test artefacts + `content.json` → `site/status.json` |
| `dashboard-ci.mjs` | 50 | Lightweight CI layers for Pages |
| `integration-report.mjs` | 42 | Nightly real-stack → `reports/integration-result.json` |
