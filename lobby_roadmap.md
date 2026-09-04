# XMage Nexus — Lobby Roadmap & Feature Matrix

> Reference document for the evolution of the **XMage Nexus** Web Lobby, based on functional analysis of the desktop XMage client (`Mage.Client`).

---

## 1. Lobby Feature Matrix

### A. Active Tables Panel
* [x] **1.1 Status & Type Badges**:
  * Match / Tournament distinction (`isTournament`).
  * Password / Lock indicator (`passworded`).
  * Skill Level: `Beginner` (*), `Casual` (**), `Competitive` (***) (`skillLevel`).
  * Rated match / ELO (`rated`).
  * Relative elapsed time (*"Created 2m ago"* / *"In match 12m"*).
* [x] **1.2 Match Settings & Permissions**:
  * Detailed breakdown of `additionalInfoShort` / `additionalInfoFull` (Bo1/Bo3/Bo5 match wins, player clock, rollback allowed `RB`, spectators allowed `SP`).
  * Entry restrictions: Max `Quit %` and `Min Rating`.
* [x] **1.3 Seat Visualizer**:
  * Avatar / Icon by type (Human, AI Mad, AI Draft, Sim).
  * Country / Flag for seated players (`flagName`).

### B. Search & Filters
* [x] **2.1 Real-Time Search**: Filter by table name, host/creator, or format.
* [x] **2.2 Status Filters**:
  * *"Open seats only"* (Waiting).
  * *"Hide in-progress"* (Hide dueling).
  * *"No password only"*.
* [x] **2.3 Format & Skill Filters**: Quick chips by game format and skill level.

### C. Community & Players Panel (`RoomUsersView`)
* [x] **3.1 Enriched User List**:
  * Country / Flag (`flagName`, 264 country flag PNG icons).
  * ELO / Constructed Rating (`constructedRating`) and Limited Rating (`limitedRating`).
  * Match Quit Ratio (`matchQuitRatio` MQP %).
  * Latency / Ping in ms with status indicators (`infoPing`).
  * Granular state: *"In lobby"*, *"Playing Table #X"*.
* [x] **3.2 MTG Arena Official Rank Tiers & Live Room Leaderboard**:
  * 6 official tiers (Bronze 🟤, Silver ⚪, Gold 🟡, Platinum 💠, Diamond 💎, Mythic 🟠).
  * Interactive Leaderboard Modal (`Top Sala`, `Mi Perfil Competitivo`, `Guía de Rangos`).
  * Rank badges with glowing borders and tooltips.
* [x] **3.3 Direct User Actions**:
  * Direct private messaging (Whisper `/w <user> <msg>` or `/whisper`).
  * Interactive User Action Modal with avatar, flag, ELO, and status.
  * Direct Spectate Match button for active players.
  * Leaderboard & Profile link.
  * Server ignore / mute toggle (`/ignore <user>`, `/unignore <user>`).

### D. Advanced Table Creation Dialog (`NewTableDialog`)
* [x] **4.1 Timing & Rules Configuration**:
  * Per-player clock selection (15m, 20m, 25m, 30m, 45m, 60m, 90m, None) and buffer reserve timer.
  * Toggles for *"Allow spectators"* and *"Allow rollbacks"*.
  * Optional table password.
  * Skill Level selector (Beginner / Casual / Serious) and Rated match flag.
  * Player entry restrictions: Minimum ELO Rating (`minimumRating`), Max Quit Ratio (`quitRatio`), and Commander EDH Power Level (`edhPowerLevel`).
* [x] **4.2 Multiplayer & Seat Configuration**:
  * Individual AI archetype and deck assignment for bot seats.
  * Influence range and attack mode for multiplayer/Commander FFA.

### E. Match History & Replays (`MatchesTableModel`)
* [x] **5.1 Finished Matches View**:
  * Final score (e.g. `Player1 2 - 1 Player2`).
  * Match duration and completion timestamp.
  * Replay launcher / viewer.

### F. Wizard Crear Mesa — Auditoría vs desktop `Mage.Client` (2026-09-04)
> Análisis exhaustivo: `web/src/lobby/CreateTableDialog.tsx` (640 líneas, 4 pasos + Dev) vs `Mage.Client/dialog/NewTableDialog.java` (1126 líneas) + `CustomOptionsDialog.java` (631 líneas) vs `Mage/src/main/java/mage/game/match/MatchOptions.java` vs `Mage.Proxy/ProxyClient.parseMatchOptions` (1142-1292). Oráculo anti-drift: `Mage.Server/config/config.xml` → `web/fixtures/server-state-schema.json` (17 gameTypes, 45 deckTypes, 21 tournamentTypes, 41 draftCubes).

**Gaps funcionales que el usuario ve como "faltan cosas":**

| # | Campo `MatchOptions` | Desktop | Web hoy | Proxy `parseMatchOptions` | Impacto |
|---|---|---|---|---|---|
| F1 | `numPlayers` (min/max por `GameTypeView`) | ✅ spinner + `setGameOptions()` adapta visibilidad de `range/attackOption` | ❌ deriva `maxPlayers` y avisa "Máx N bots" sin selector | derivable de `playerTypes.length` | Free For All/Commander FFA (3-10) no puede limitar a 3-4 |
| F2 | Asientos por plaza (tipo+skill+deck) | ✅ `List<TablePlayerPanel>` | ⚠️ `playerTypesSel[]` único + 1 `simDeck` replicado, sin skill por bot | ✅ (`SIM`→`HUMAN` en servidor, join per-`TablePlayerPanel`) | No hay 3-10 plazas mixtas |
| F3 | `mulliganType` | ✅ combo en CustomOptions | ❌ no enviado | ❌ ignora → `GAME_DEFAULT` | Sin fix London/Vancouver etc. |
| F4 | `customStartLife` / `customStartHandSize` (bool+valor) | ✅ | ❌ | ❌ | Sin vida/mano inicial custom |
| F5 | `planeChase` | ✅ | ❌ | ❌ | Sin Planechase |
| F6 | `perPlayerEmblemCards`/`globalEmblemCards` (experimental dck) | ✅ file picker | ❌ | ❌ | Stretch, deja fuera del MVP |
| F7 | `bannedUsers` (`IgnoreList`) | ✅ | ❌ | ❌ | Ignorados pueden entrar |
| F8 | `limited` para `Freeform Unlimited Commander` | ✅ `startsWith("Limited")` \|\| `Freeform Unlimited Commander→limited=true` | ❌ `=== "Limited"` literal | ✅ si web lo manda | Sideboarding roto para ese deckType |
| F9 | `range`/`attackOption` gating | ✅ `isUseRange/isUseAttackOption` + fila oculta si ninguno aplica | ⚠️ `maxPlayers>2 \|\| commander` | ✅ | Heurística imperfecta en 2p no-FFA |
| F10 | `tournamentType` (21) + `draftCubeName`/`numberRounds` | ✅ 21 entradas de `config.xml` | ⚠️ solo 3 (`Booster Draft/Sealed/Elimination`) | ✅ parser ya soporta los 21 + `draftCubeName`/`sets`/`numberBoosters`/`constructionTime` | Draft Cube no se puede elegir |

**Gaps de UX / robustez:**

| # | Problema | Detalle |
|---|---|---|
| U1 | Sin validación `deckType ↔ gameType` | Desktop `checkMatchOptions()` rechaza `Commander`+`Two Player Duel` antes de server; web dispara `createTable` y falla post-submit |
| U2 | Sin validación por paso | `goNext` siempre habilitado, `name` vacío, `quitRatio`>100, etc. no bloquean |
| U3 | `freeMulligans` auto→1 vía `useEffect` silencioso | Compite con setting manual, sin badge |
| U4 | Sin persistencia `lastSessionId`/slots | Desktop `PreferencesDialog.KEY_NEW_TABLE_*` (2 slots + last); web resetea cada apertura |
| U5 | Sin pre-validación viva por plaza | Solo `requestDeckValidation` en submit secuencial (humano+SIM), sin hint inline |
| U6 | Summary strip incompleto + i18n mixto | Tags hardcodeados "Buffer de tiempo", stepper no responsive |
| U7 | `winsNeeded` 1-5 vs solo 1/2/3 | Desktop permite 1-5 (Bo7) |
| U8 | `Draft` con `numberRounds`/cube faltan | No hay `isSingleMultiplayerGame` / `numberRounds` en UI |

**Plan de cierre (ordenado):**

| Fase | Alcance | Toca | Verifica |
|---|---|---|---|
| **1** | Fixes sin contrato: validación `formatRules.ts` port de `checkMatchOptions`, selector `numPlayers` (min/max del oráculo), matriz `SeatConfig[]` por plaza (colapsa a chips en 2p), fix `limited` F8, `wins 1-5`, `freeMulligans 0-5`, `localStorage mage_createTable_v1`, live badge `validateDeck` debounced, i18n+stepper | `CreateTableDialog.*`, `decks/formatRules.ts`, `net/commands.ts` (`CreateTableArgs`), `i18n/locales/*`, `fixtures/fake.ts` | `unit` (serverStateCoverage) + `typecheck` + `e2e fake` |
| **2** | Contrato proxy: añadir a `parseMatchOptions` `mulliganType`+`customLife/Hand`+`planeChase`+`bannedUsers`; UI Custom Options (mulligan select, vida/mano custom, Planechase) en tab Timing → chip "Custom (n)" | `Mage.Proxy/ProxyClient.java` + tests, `web/...` | `java` (`mvn -pl Mage.Proxy -am test`) + rebuild `build.mjs proxy` + `ctl.mjs restart proxy` |
| **3** | Torneos: `tournamentType` exhaustive (agrupado por familia) + `draftCubeName` (41 cubes del oráculo) + `numberRounds`/`isSingleMultiplayerGame`; forzar `playerTypes=['HUMAN']` y `MAX_DRAFT_PLAYERS=8` en draft | mismo web + `Mage.Proxy` (parseTournament ya cubre) | `self-test` real localhost |
| **4 (stretch)** | Emblem cards + Save/Load presets (2 slots + last) + `bannedUsers` de `ignoreList` | web + proxy | — |

Guard (`web/src/state/serverStateCoverage.test.ts`) ya cubre drift `gameTypes/deckTypes` vs `config.xml`; se extenderá a `draftCubes/tournamentTypes` si se exponen dinámicamente. El oráculo vivo es `scripts/server-state-schema.mjs` (no necesita Java).

---

## 2. Implementation Roadmap

| Step | Module | Scope | Status |
|---|---|---|---|
| **1** | **Enriched Table Cards** | Skill Level badges, Lock icon, Relative time, Rated badge, SP/RB permissions, entry restrictions, and tooltips | ✅ Completed |
| **2** | **Search & Quick Filters** | Live text search bar and open-seats / no-password toggles | ✅ Completed |
| **3** | **Community, Country Flags & ELO** | User list with flags, ELO, stats, status, and MTG Arena rank badges | ✅ Completed |
| **4** | **Advanced Table Creation Modal** | Turn clocks, rules, password, skill level, player restrictions, and seat setup | ✅ Completed |
| **5** | **Live Room Leaderboard & Tiers** | MTG Arena style 6-tier ladder modal (Bronze to Mythic) with room ranking & profile | ✅ Completed |
| **6** | **Finished Matches & Replays** | History view of completed duels with final scores and replay viewer | ✅ Completed |
