# Code map — where things live (counts verified 2026-10-09)

Counts are `wc -l` / `find | wc -l` output from the working tree, so re-run them before trusting a number
here (`find web/src -name '*.ts' -o -name '*.tsx' -o -name '*.css' | wc -l`, etc.). The **refactor queue**
of the 2026-09-05 version of this file is finished: every file it listed at 1 000+ lines was split then. In the proxy the only hand-written source still above 1 000 lines is `ProxyClient.java`, and it has grown back
from the 739 lines that split left (1 161 now, with the relink / sequencer / probe work). In the web client
the only files over 1 000 lines are generated data (the 9 locales, `data/mtgKeywords.ts`), a data catalog
(`decks/metaDeckCatalog.ts`), one test (`state/store.test.ts`), the dev-only `dev/galleryFixtures.ts` and
three CSS files (`lobby/LobbyScreen.css`, `lobby/SpectatorStagingScreen.css`, `board/CardSlot.css`). What is
left below is a locator, not a to-do list.

## `web/src` — 807 files (385 ts + 293 tsx + 125 css + 4 others; tests sit next to their source)

| Folder | Files | What lives here |
|---|---|---|
| `game/` | 200 (41 css) | Match flow: `GameScreen` (layout router), `FeedbackDialog` (prompt router) + `feedback/` (`types/detect/record/text/parse`) + `feedbackModes/` (per-mode UI: `AskBar`, `ManaBar`, `TargetBar`, `CombatBar`, `GenericDialog`, …), `PhaseBar`, `StackZone`, `ActionFeed`, `SideboardScreen`, `DraftScreen`/`ConstructScreen`, `smartManaPayment.ts`, `smartStops.ts`, `triggerOrderPlan.ts`, `mulliganEvaluator.ts`, `deckTracker.ts`, dialogs (Mulligan, Voting, Planeswalker, LibraryOrder, Rollback) |
| `board/` | 145 (26 css) | Battlefield rendering in DOM/CSS: `ArenaBoard`/`GameBoard`/`PodBoard`/`TwoHeadedBoard`, `BoardZone` (shared zone layout), `PlayerZone`/`OpponentZone`, `CardSlot` (classic + compact), `HandBar`, `StackZone`, `CommandZone`, `PileOverlay`, overlays (`Targeting`, `CombatArrowsOverlay`, `FlyingCardOverlay`), `bandFit.ts`, `combatStrikes.ts`, `gameTransitionEngine.ts`, `commanders.ts`, `designations.ts`, `ptTrend.ts`, `targetZones.ts`, `sceneBridge` (publishes `window.__mageScene` for E2E) |
| `lobby/` | 115 (22 css) | `LoginScreen`, `LobbyScreen`, `CreateTableDialog` + `CreateTable/`, `JoinTableDialog`, staging (`SpectatorStagingScreen`), chat, decks gallery/manager, `TournamentBracket`/`TournamentStandings`, leaderboard |
| `decks/` | 112 (21 css) | `DeckBuilder`, search/list panels, Scryfall integration, import/export, curve chart, `formatRules.ts`, `deckIssues.ts`, `starterDecks.ts`, validation issues |
| `state/` | 50 (`events/` + `slices/`) | `state.ts` (`AppState`), `store.ts` (facade + `__mageStore`), `actions.ts`, `selectors.ts`, `persistence.ts`, `gateway.ts`, `eventHandler.ts` + `events/` (chat/game/prompts/sideboard/draft/tournament/replay/views), `gameUtils.ts`, `engineViewRegistry.ts`, and the coverage guards (see below) |
| `ui/` | 46 (6 css) | `Modal`/`DialogShell`, `Field`, `Input`, selectors, plus the style ratchets |
| `appearance/` | 23 | Playmat/sleeve/card-image settings + modals (`playmats.ts` catalog kept separate from `playmatIdentity.ts`, which is game-aware) |
| `system/` | 22 | `AboutModal`, diagnostics export, `desktopCsp.test.ts` |
| `i18n/` | 19 | `types.ts` (TranslationSchema, master), `index.ts`, 9 locales (~2 284 lines each), `LanguageSelector`, `i18n.coverage.test.ts` |
| `audio/` | 13 | `soundManager`, `soundSynthesizer`, `gameSoundDispatcher` |
| `net/` | 10 | `types.ts` (protocol truth: envelopes + `EVENT_METHODS`), `types.generated.ts` (generated, do not hand-edit), `Gateway.ts` (WS + reconnect), `commands.ts` (action wrappers) |
| `settings/` | 8 | Gameplay presets (`gameplayPresets.ts`) and the settings screens |
| `cards/` | 14 | `cardImages.ts` (Scryfall resolution + IndexedDB cache), `cardLocalization.ts`, custom card images |
| `data/` | 6 | `mtgKeywords.ts` (2 951, generated via `scripts/extract-keywords.mjs`), extractor |
| `utils/` | 6 | Timer, fullscreen, misc |
| `dev/` | 5 | `#/gallery` harness + `galleryFixtures.ts` (1 485, dev-only) |
| `setup/` | 4 | First-run SetupWizard (its `skip()` persists no connection on purpose — see `AGENTS.md`) |
| root | 7 | `App.tsx`, `main.tsx`, `styles.css`, `test-setup.ts`, two root-level guards |

## Biggest files today (context, not a queue)

Test files and generated data dominate: `data/mtgKeywords.ts` (2 951, generated) and the 9 locales
(~2 284 each) are generated/data. The largest hand-written sources are `dev/galleryFixtures.ts` (1 485,
dev-only), `decks/metaDeckCatalog.ts` (1 033, data), `lobby/SpectatorStagingScreen.tsx` (726),
`lobby/CreateTable/useCreateTableForm.ts` (662), `state/persistence.ts` (635), `decks/formatRules.ts` (627),
`decks/DeckBuilder.tsx` (615), `board/BoardZone.tsx` (609). The largest CSS is `lobby/LobbyScreen.css`
(1 479) and `lobby/SpectatorStagingScreen.css` (1 183).

Cross-cutting rules that still hold: `state/slices/*` may only import dependency-free modules (a helper that
reaches `board/*` creates an import cycle and a TDZ crash at store init); fixed-size boxes use
`overflow: clip`, not `hidden`; board effects use `translate`/`scale` so they compose with the tap
`transform`; every decorative animation needs its `html.fx-off` + `prefers-reduced-motion` opt-out.

## Guards that read the code (run in the `unit` layer)

`state/callbackCoverage.test.ts` (every server callback handled or planned — reads
`web/INTERACTION_COVERAGE.md`), `state/mechanicsCoverage.test.ts` + `state/hintCoverage.test.ts` +
`state/serverStateCoverage.test.ts` (contract/schema coverage), `state/engineViewCoverage.test.ts`
(engine→view gap vs `web/fixtures/engine-view-gap.baseline.json`), `ui/styleTokens.test.ts` +
`ui/cssIntegrity.test.ts` + `ui/rawButtons.test.ts` (style ratchets), `lintRatchet.test.ts` (oxlint effect-dep
baseline), `system/desktopCsp.test.ts` (external hosts must be in the Tauri CSP).

## `Mage.Proxy/src/main` — 34 files, 7 865 lines

| Lines | File | Responsibility |
|---|---|---|
| 1 161 | `ProxyClient.java` | `MageClient` bridge: session lifecycle, callback forwarding (`{type:event,method,messageId,objectId,data}`), lobby timer, `connect/attach`, command router, `requiresGameId` |
| 821 | `SimPlayer.java` | Deterministic test bot (land/turn, color-aware first payable cast, all-attack/all-block, keep, pass, keep-alive ping) |
| 681 | `DeckValidation.java` | Advisory pre-validation + official `validateDeckFormat`/`commanderEligibility` passthrough, background card-DB build |
| 515 | `Gateway.java` | WS transport: `byConn`/`byAccount`, origin check, rate limit, pre-auth `connect/ping` only, watchdog line |
| 358 | `Main.java` | Entrypoint: WS + HTTP test page, anti-traversal, `/ready`, `/admin/status` |
| 340 | `JsonUtil.java` | Reflection serializer (camelCase 1:1, skips null/static/transient/logger/Class/Throwable, UUID/Enum→string, Date→epoch) |
| 333 | `GameActivity.java` | Per-game journal: `game_start`/`game_end`, commander damage and hidden-commander probes |
| 272 | `GameCommands.java` | Replay/deck/preferences/`sendPlayer*` commands |
| 226 | `MatchOptionsParser.java` | `parseMatchOptions/parseTournamentOptions` from JSON |
| 217 | `SimManager.java` | SIM seats lifecycle (per-table bots, server endpoint, roster) |
| 193 | `Config.java` | CLI flags; defaults `beta.xmage.today:17171`, WS 8787 / HTTP 8788 / bind 127.0.0.1 |
| 190 | `DeckJson.java` | Deck JSON → `DeckCardLists` + promo/set normalization + printing resolution at the edge |
| 179 | `SimRoster.java` | On-disk SIM roster so a proxy restart re-logs the bots that were seated |
| 173 | `OnlineDeckCommands.java` / `Activity.java` | Online deck fetching; the `[activity]` journal lines |
| 166 | `RestoreIds.java` | Per-account `restoreSessionId` kept outside the live client (memory + disk) |
| 166 | `CardCatalog.java` | Card DB lookups for the client: `resolvePrintings`, `cardPrintings` |
| 164 | `OutboundLog.java` | Outbound-frame logging for diagnostics |
| 155 | `AuthorizedConnections.java` | Connection authorization/LAN rules |
| 134 / 130 / 127 / 125 / 117 | `CallbackEvents.java` / `InfoCommands.java` / `ReplayCache.java` / `TournamentCommands.java` / `TableCommands.java` | Event plumbing + the four command domains |
| 110 | `CallbackSequencer.java` | Re-sequences server callbacks by `messageId` (they arrive out of order) |
| 104 | `SessionProbe.java` | Asks the server before acting on a "link looks down" report |
| 100 | `JsonArgs.java` | Defensive JSON arg readers + `parseActionData` |
| 97 | `LobbyPublisher.java` | Lobby broadcast with the per-minute stack throttle |
| 90 / 80 | `SessionGames.java` / `ServerMessageMailbox.java` | Per-session game bookkeeping; server messages |
| 61 / 38 / 37 | `ProxyProtocol.java` / `CommandContext.java` / `ErrorClassifier.java` | `ERR_*` + envelope, router context, server-error classification |
| 32 | `org/jboss/mx/util/ObjectNameFactory.java` | Shim, not a vendored copy: see `docs/lessons.md` |

Tests: `Mage.Proxy/src/test` — **36 files**, including `ProxyClientFailedLoginTest` (thread leak),
`GatewayWatchdogTest`, `RestoreIdsTest`, `SessionProbeTest`, `CallbackSequencerTest`, `GameActivityTest`,
`DeckValidationTest`, `CardCatalogTest`, `MainSecurityTest`/`GatewaySecurityTest`, `SimPlayerTest`,
`ReplayCacheTest`, `GatewayCompressionTest`.

## `scripts/` — 47 `.mjs` files, ~14 600 lines

| Group | Files | Notes |
|---|---|---|
| Stack control | `lib.mjs` (542), `dev.mjs`, `ctl.mjs`, `tail.mjs`, `install.mjs` | `.run/*.pid` + `.run/*.log`, port helpers, `javaBin()`, `forkDir()` |
| Test orchestration | `test.mjs` (352) | 12 layers: unit, coverage, typecheck, build, java, self-test, human-test, verify, verify-restart, fuzz, e2e, i18n |
| Real-stack harnesses | `self-test.mjs`, `human-test.mjs`, `fuzz.mjs`, `warmup.mjs`, `clean-tables.mjs`, `multi-tenant-test.mjs` | Need the stack; `warmup.mjs` exists because of the cold-start callback-socket flake |
| Anti-drift `verify` layer | `verify-player-leave`, `verify-hand-permission`, `verify-range-attack`, `verify-rollback-vote`, `verify-spectator-end`, `verify-swiss`, `verify-tournament-watch`, `verify-wizard-matrix`, `verify-reconnect` | The nine scripts listed in `VERIFY_SCRIPTS`; each logs out before closing its socket |
| Fixture recording | `record.mjs` (3 866), `rec-lib.mjs`, `record-sync.mjs`, `drivers/*.mjs` | Real frames → `web/fixtures/recorded/`; one driver per mechanic |
| Contract generators | `view-schema.mjs`, `engine-view-schema.mjs`, `server-state-schema.mjs`, `hint-schema.mjs`, `gen-types.mjs`, `gen-zod.mjs`, `gen-splash-i18n.mjs`, `gen-keywords-i18n.mjs`, `extract-keywords.mjs` | Each has a `--validate` mode used by CI; `*_schema.json` outputs live in `web/fixtures/` |
| Release/site | `gen-dashboard.mjs`, `dashboard-ci.mjs`, `integration-report.mjs`, `gen-latest.mjs`, `gen-manifest.mjs`, `gen-release-body.mjs`, `assemble-modules.mjs` | Feed `site/` and the release workflow |
| Deploy/host | `deploy-bundle.mjs`, `deploy/*` (`host-xdhs.sh`, …), `check-upstream-release.mjs` | The public host + the 6-hourly upstream release probe |
| MCP tooling | `playwright-mcp.mjs` | Wraps `@playwright/mcp` for browser interaction |

## `mcp/` and `site/`

- `mcp/src` + `mcp/test`: 27 files. `src/index.ts` (entry), `src/tools/` (DevOps tools), `src/xmage/`
  (`wsClient`, `session`, `compactView`, `promptView` — the headless player), `src/resources.ts`.
  38 `mage_*` tools, catalogued in `mcp/README.md`.
- `site/`: zero-build static dashboard (`index.html`, `app.js`, `styles.css`, `assets/`) rendering
  `site/status.json` (generated) from `site/content.json` (canonical copy) + test artifacts.
