# Project Roadmap: XMage Nexus

> **A Modern, Web-Based Digital Card Game Client for XMage**  
> *Last updated: 2026-10-15*

---

## 1. Vision & Architectural Philosophy

The goal of **XMage Nexus** is to deliver a fast, modern, and beautiful web client with an **Arena-grade aesthetic** (hardware-accelerated DOM/CSS animations, animated targeting, sound, smooth interaction) while leveraging the battle-tested, 10-year **XMage Java server** (`Mage.Server`) as the authoritative rules engine, card database (+25,000 cards), and multiplayer matchmaking backend.

### The 3-Tier Architecture
```
┌─────────────────────────┐          WebSocket JSON          ┌──────────────────────────┐      JBoss / TCP      ┌─────────────────────────┐
│  XMage Nexus Web Client │ ◄──────────────────────────────► │        Mage.Proxy        │ ◄───────────────────► │      XMage Server       │
│  (React 19 + Vite)      │   (Type-safe protocol schema)    │  (Java 17 / MageClient)  │   (Native protocol)   │  (1.4.62-V1 / Official) │
└─────────────────────────┘                                  └──────────────────────────┘                       └─────────────────────────┘
```

- **Zero Rules Re-implementation**: XMage handles all legality, priority checks, layers, triggers, timers, and state-based actions.
- **Clean Decoupling**: The Java proxy acts as a legitimate `MageClient`, translating JBoss serialization into clean, reflection-safe JSON.
- **Asynchronous State Machine**: The web client uses non-blocking reactive stores, monotonic state tracking, and floating UI dialogs to bridge XMage's synchronous Swing origins into modern web paradigms.

---

## 2. Current State Assessment (Verified & Completed)

The project has successfully conquered the most difficult engineering hurdles (protocol bridging, async feedback loops, mana payments, targeting):

| Milestone | Scope | Status | Verification & Evidence |
|---|---|---|---|
| **Phase 0: Proxy Bridge** | Java 17 proxy (`Mage.Proxy`), WebSocket gateway, cycle-safe JSON serializer. | ✅ **Completed** | Connect + real game flow works against `beta.xmage.today:17171` AND local `localhost:17171` (same 1.4.62-V1 fork). NOTE (corrected 2026-09-20): beta's anonymous login is **stable** (17/17 measured). The former "intermittently fatal handshake" was a misdiagnosis — `Can't receive server state before other data` is logged on *any* failed login (the client fetches the server state only after login succeeds), and the real cause was generated usernames exceeding `maxUserNameLength` (**14**). CI's real-protocol oracle stays the local server for determinism. The proxy is now **multi-tenant** (one process serves many independent users), which already enables zero-install server-side play today (see `AGENTS.md`). |
| **Phase 1: Web Foundation** | React 19 + TS + Vite. Lobby, room chat, real-time tables/users, Scryfall HD card cache (IndexedDB), full 1v1 board rendering & spectator mode. | ✅ **Completed** | 100% typecheck clean, live AI vs AI spectator matches working end-to-end. |
| **Phase 2: Interaction Engine** | London mulligan, priority loops (`GAME_SELECT`), visual targeting (animated dotted lines & pulsing glows), mana tapping & pool payment (`sendPlayerManaType`), floating non-blocking combat UI (attack/block & alpha strike), advanced spell interactions (X-costs, multi-target, modal choices, +1/+1 counters). | ✅ **Completed** | Validated via `human-test.mjs` (83 checks PASS) and Playwright E2E suites (*Blaze*, *Arc Trail*, *Boros Charm*, *Walking Ballista*). |
| **Quality & QA Foundation** | 1,900+ unit tests (vitest, ~13 s), Java→TS JSON Schema codegen (`gen-types.mjs`), dual-mode Playwright E2E (deterministic FakeServer + Real XMage Stack; bot seats use the server-native Mad AI since 2026-10-10 — the proxy `SimPlayer` bot is dev-only behind `--sim on`, see `docs/plans/2026-10-10-sim-dev-only-design.md`). | ✅ **Completed** | Zero-flake local iteration loop + continuous anti-drift contract testing (3 guards: `callbackCoverage`, `mechanicsCoverage` server→client, `engineViewCoverage` engine→view). |
| **Phase 2.5: 1v1 Competitive Parity** | Match Chess Clocks (+buffer `F4`/`F9`), DFC/MDFC back-face + Saga `lore`, HD `CardGrid` para selección de cartas (tutores, scry/surveil, reveal de mano), **descarte interactivo desde reveal de mano** (Thoughtseize: `GAME_CHOOSE_CARDS`/`GAME_SELECT_TARGETS` con la mano ajena como `cardsView1` → `CardGrid` → `sendPlayerUUID`), **sideboard Bo3/Bo5** (`SIDEBOARD` → `SideboardScreen`) y **orden de asignación multi-bloqueador** (`GAME_GET_MULTI_AMOUNT`). Phase stops F4/F9 (ya completados en F2). | ✅ **Completed** | `e2e/reveal.spec.ts` (`@reveal`), `best-of.spec.ts`, `combat-multiblock.spec.ts`, `FeedbackDialog.test.tsx`, `PlayerInfoBar.test.tsx`, `INTERACTION_COVERAGE.md` actualizado. |
| **Phase 3: Visual Polish, Audio & Deck Builder** | Web Audio engine (15 sfx, 3 buses), VFX (floating damage, shake, mana donut), in-app deck builder (Scryfall full syntax, curve, sample hand, Arena/DCK/Plain import/export), card sleeves and avatars, design system (tokens, primitives, style ratchet). | ✅ **Completed** (selectable playmats delivered 2026-09-23) | Visual-regression gallery (`#/gallery`, 3 resolutions × chromium + webkit) and the gallery/recorded E2E specs. |
| **Phase 4: Desktop Packaging (Tauri)** | Tauri launcher with embedded proxy + trimmed JRE, signed auto-updater. | ✅ **Published** (v0.1.0 2026-09-10, v0.2.0 2026-09-19, v0.2.1 2026-09-22, v0.2.2 2026-09-22, v0.2.3 2026-09-22, v0.2.4 2026-09-24, v0.2.6 2026-09-24, v0.2.7 2026-09-24, v0.3.0 2026-09-27, v0.4.0 2026-09-30, v0.4.1 2026-10-01, v0.4.2 2026-10-02, v0.4.3 2026-10-04) | `release.yml`, signed bundles + `latest.json`. Clean-machine validation still open (§4.1 V7). |
| **Phase 5: Advanced Modes & Tournaments** | Commander / FFA pod board (2×2 clamp 4; server FFA 3-10), Booster Draft & Sealed (8P `DraftScreen`/`ConstructScreen`), Swiss and elimination brackets, spectating of tournament matches. | ✅ **Completed** | `verify-swiss.mjs`, `verify-spectator-end.mjs`, e2e `draft`/`tournament` specs. |

---

## 3. Feature Parity Matrix: Official XMage (Swing) vs. XMage Nexus

| Category | Feature | Official XMage (Swing) | XMage Nexus (Current) | Roadmap Phase |
|---|---|---|---|---|
| **Connectivity & Lobby** | Connect to Local / Custom / Public Server (`beta.xmage.today`) | ✅ Yes | ✅ Yes | Completed |
| | Real-time Table & User Broadcasts | ✅ Yes | ✅ Yes | Completed |
| | Room & Match Chat | ✅ Yes | ✅ Yes | Completed |
| | 1v1 Table Creation (Human vs Human / Human vs AI) | ✅ Yes | ✅ Yes | Completed |
| | Table Filters & Private Messaging (Whispers/PM) | ✅ Yes | ✅ Yes | Completed |
| | Enriched table cards (match/tournament, password, skill, rated, clocks, `SP`/`RB` permissions, quit % / min rating) | ✅ Yes | ✅ Yes | Completed |
| | User list with flags, ELO, ping and status; Arena-style rank tiers + room leaderboard | ⚠️ Basic | ✅ Yes | Completed (Surpasses Swing) |
| | Create-Table wizard (per-seat type/deck/skill, clocks, mulligan, custom life/hand, Planechase, banned users, 21 tournament types, 41 cubes, HUMAN seats) | ✅ Yes | ✅ Yes (`lobby/CreateTable/`; only emblem cards out of scope) | Completed |
| | Finished matches + replays | ✅ Yes | ✅ Yes | Completed |
| | Invite links (`#join=` / `#watch=`) | ❌ No | ✅ Yes | Completed (Surpasses Swing) |
| | Match Clocks / Visible Timers | ✅ Yes | ✅ Yes | Completed |
| **Deck Management** | Predefined / JSON Deck Loading | ✅ Yes | ✅ Yes | Completed |
| | Full-featured In-App Deck Builder with Scryfall Filters | ✅ Yes (Local DB) | ✅ Yes (Scryfall full syntax + help, 9-lang, curve/donut, CMC sort, drag-drop) | Completed |
| | Text / Arena / Standard Deck Import & Export | ✅ Yes | ✅ Yes (Arena/DCK/Plain + clipboard, file drop, 9-lang normalization; 3-step import wizard: format detection, bulk printing resolution, legality review) | Completed |
| **1v1 In-Game Board** | Hand, Battlefield (Lands / Creatures / Non-creatures) | ✅ Yes | ✅ Yes (HD Art) | Completed (Surpasses Swing) |
| | Stack, Library, Graveyard, Exile | ✅ Yes | ✅ Yes | Completed |
| | Tap Rotations, Life Totals, Counters (+1/+1, loyalty) | ✅ Yes | ✅ Yes | Completed |
| | Graveyard / Exile Pile Inspector Overlays | ✅ Yes | ✅ Yes | Completed |
| | In-game deck tracker (remaining library + draw odds) | ❌ No | ✅ Yes (`DeckTrackerPanel`) | Completed (Surpasses Swing) |
| | Double-Faced Cards (Transform, MDFC, Sagas) | ✅ Yes | ✅ Yes | Completed |
| **In-Game Rules & Prompts** | Priority & Turn Passing (`GAME_SELECT`) | ✅ Yes | ✅ Yes | Completed |
| | Mana Payment (Tapping lands on board + color pool) | ✅ Yes | ✅ Yes | Completed |
| | Visual Targeting (Outlines, arrows to cards/players) | ❌ Crude lines | ✅ Dotted animated lines + Glow | Completed (Surpasses Swing) |
| | Complex Spells (X-costs, Modals, Multi-target) | ✅ Yes | ✅ Yes | Completed |
| | Interactive Combat (Declare Attackers / Blockers) | ✅ Yes | ✅ Yes (Floating UI) | Completed |
| | **Card Selection Lists (Tutors, Scry, Surveil, Hand Reveal)** | ✅ Yes (`ShowCardsDialog`) | ✅ Yes (HD grid via `CardGrid`) | Completed |
| | **Phase Stops & Priority Shortcuts (F4, F9, Space)** | ✅ Yes | ✅ Yes | Completed |
| | **Sideboarding Screen between Bo3 Matches** | ✅ Yes | ✅ Yes | Completed |
| | Multi-blocker Damage Assignment Order | ✅ Yes | ✅ Yes | Completed |
| **Presentation & Audio** | Sound Effects (Turn bell, life loss, spell cast, combat) | ✅ Basic | ✅ Yes (Web Audio 22 sfx, 4 buses incl. adaptive music, JIT unlock) | Completed (Surpasses Swing) |
| | VFX & Animations (Spell cast arcs, screen shake, damage) | ❌ No | ✅ Yes (donut color pie, bars, shake, floating damage, spell-weight slam, hit sparks, destroy/exile/token deaths, countered-spell shatter, transform flip, bounce swirl, life-gain motes, library riffle, flicker, monarch/initiative passing, elimination crack, dice rolls, phasing, mulligan deal, day/night sky, sacrifice, spell copies, planeswalker ultimates, revealed-card flip, keyword auras and keyword combat moments, low-life vignette, foil + tilt preview, playmats, cinematic end screen) | Completed (Surpasses Swing) |
| **Distribution** | Desktop & Web Deployment | ❌ Heavy JRE required | ✅ Web + Tauri launcher (v0.2.3, updater firmado y componentes desacoplados) | Completed |
| **Distribution** | Interactive Web Demo (GitHub Pages, no install) | ❌ None | ✅ `site/demo/`: the real client on scripted scenarios, ELO ranking, deck builder + EDHREC, 12 playable scenes (§4.10) | Completed |
| **Advanced Formats** | 4-Player Commander / EDH (Command zone, tax, damage) | ✅ Yes | ✅ Yes (PodBoard 2×2 clamp 4; server FFA 3-10) | Completed |
| | Booster Draft & Sealed Tournaments (Pick timer, packs) | ✅ Yes | ✅ Yes (8P DraftScreen/ConstructScreen) | Completed |

---

## 4. Pending Work (single live list)

> Only what is still open. Everything resolved up to 2026-10-15, with its measurements and rationale, is archived verbatim in `docs/history/roadmap-resolved-2026-10.md`; the narrative of any task is in its commit message. Product-idea specs: `docs/enhancements.md`.

### 4.1 Desktop launcher

- Clean-machine validation of the signed bundles (V7) is still open.

### 4.2 Product ideas not built yet

| Area | Idea | Impact / effort | State |
|---|---|---|---|
| Attract | Draft pick helper: pool-aware ranking | Done 2026-10-15 | `game/draftAdvisor.ts` (pure scoring: rarity, colour fit once committed, creature curve, creature count) + `game/DraftHelper.tsx` in `DraftScreen`: top 3 suggestions with reasons and an outline on the first. Never picks for the player, labelled as a guess, hide/show remembered. Open: format-specific card ratings (17Lands-style data) need an external source |
| Attract | Waiting room (`SpectatorStagingScreen`) polish | Done 2026-10-16 (P0/P1/P2): the bottom status banner no longer clips under the sticky action bar (the table area scrolls, banner and actions stay put); the step label no longer overlaps on phones; "Change deck" is secondary so Ready/Start lead; the chat column is narrower; the format's table art backdrops the arena; a seat that just got a player pops; empty seats breathe; the arena flashes once when everyone is ready. Open: the chat hint "Table chat unavailable — using global" reads like an error and needs copy in all 9 locales; the header chips (up to 7) could group; the "3-1" seat badge needs a W-L label after its meaning is confirmed; "Preparing…" appears in three places and could be one. A pre-start countdown was left out on purpose: it would delay the real start |
| Game UI | Board rewind: shareable moment as an image/GIF, and a replay that carries chat and the decklist | Low / ~1-2 d | Rewind and the replay file shipped 2026-10-15: opt-in `boardRewind`, one in-memory snapshot per step (max 40, `game/rewind.ts`), `RewindBar` (slider, arrows, Esc), a read mode that swaps the displayed `GameView` in `GameScreen`; **Save replay** writes `nexus-replay_*.json.gz` (`game/replayFile.ts`, gzip via `CompressionStream`, plain JSON fallback) and **Open replay file** in Lobby → History plays it with no server connection (read-only, validated: format/version, ≤ 40 unique snapshots). Tests: `rewind.test.ts`, `replayFile.test.ts`, `RewindBar.test.tsx`, `e2e/rewind.spec.ts`. Limits: a long game is a large file (each snapshot is a full `GameView`, 200-800 KB raw) and the demo does not load replays yet |

| Game UI | Opponent-turn recap: highlight new/changed/died permanents when priority returns + one-line summary ("played X, attacked with Y, you lost 4") | Very high / ~1-2 d | Done 2026-09-23 (non-blocking strip at my turn start: summary + departed-card chips by destination; NEW/CHANGED marks on the board) |
| Game UI | Smart stops (Arena-style): only stop when the server reports something playable | High / ~1 d | Done 2026-09-23 (opt-in toggle, off by default; ignores mana-only `canPlayObjects`; answers each `GAME_SELECT` once; validated against the local server by `e2e/smart-stops-real.spec.ts`) |
| Game UI | P/T tinted vs base (green up / red down), summoning-sickness marker, "entered this turn" glow | Medium / ~1 d | Done 2026-09-23 (per-component tint vs printed value with base in the tooltip; client-tracked entered-this-turn glow; sickness badge already existed) |
| Game FX | Spell weight impact: high-CMC / mythic spells darken the board, shake and flash in the card's colours | High / ~1 d | Done 2026-09-23 (2026-09-25: fires when the spell resolves, not when it is cast; countered permanents and cancelled casts never slam) |
| Game FX | Sequential combat strikes: when combat damage resolves, attackers lunge one after another at their blocker or at the player/planeswalker/battle they attack, each landing with the hit sound, sparks and a shake; dying combatants stay on screen until the sequence ends and damage/life numbers pop on each impact | High / small | Done 2026-09-25 (first-strike and regular damage steps animate separately; declaring attackers only shows the existing nudge) |
| Game FX | Physical combat: impact particles on damage, distinct deaths (destroy = burn, exile = beam of light, token = pop/puff); the attacker lunge already existed | High / ~2 d | Done 2026-09-23 |
| Game FX | Low-life tension: red vignette + heartbeat at ≤ 5 life | Medium / small | Done 2026-09-23 |
| Game FX | Countered spells shatter on the stack, double-faced cards flip when they transform, bounced permanents swirl and fly to their owner's hand (opponents included, without a fake draw), life gain lights the portrait with rising motes | High / ~1 d | Done 2026-10-20 (`gameTransitionEngine.ts`: `counteredSpellIds`, `opponentBounceIds`, transform flip; gallery `anim:countered`, `anim:transform`, `anim:bounce`, `anim:opp-bounce`, `anim:life-gain`). Library shuffle shipped the same day (`board/shuffleFx.ts`, read from the game-log line since a shuffle changes nothing in the view; gallery `anim:shuffle`, `anim:shuffle-opp`, `anim:shuffle-classic`). The rest of the animation backlog shipped the same day too: flicker, monarch/initiative passing, player elimination, dice rolls, phasing, mulligan, day/night, sacrifice, spell copies, planeswalker ultimates and revealed cards (`buenas_animaciones.md`; the log-only ones in `board/gameLogFx.ts` and `board/diceRollFx.ts`), and so did the last polish batch: spent mana flying from the pool to the stack, goad and new card-icon pops, the library glowing red at 3 cards and cracking at 0, and blockers stepping up to their attackers; designation gains (monstrous, renowned, suspected, class level, case solved…, read from the `rules` hints) and the scry / surveil library peek (log line) followed on 2026-10-21 (gallery `anim:designation-*`, `anim:scry`, `anim:surveil-opp`), and so did the remaining log-only effects: fizzle, behold, paying or declining to prevent an effect, announced choices, a completed dungeon and a concession (`fizzleFx.ts`, `beholdFx.ts`, `playerLogFx.ts`, `concedeFx.ts`); what remains is only what neither the view nor the log carries (player targeting, regeneration, prevented damage, crime committed). Keyword effects followed on 2026-10-21: a looping aura per battlefield permanent for its main keyword (setting *Keyword effects* off / subtle / vivid, `keywordAura.ts`, `KeywordAura.css`), a pop when a keyword is gained, and combat moments for first strike, deathtouch, lifelink, trample and indestructible (`keywordStrikeFx.ts`; gallery `anim:keyword-auras`, `anim:keyword-gain`, `anim:kw-*`) |
| Game FX | Foil shimmer + 3D tilt on the enlarged card preview | Medium / small | Done 2026-09-23 |
| Game FX | Selectable playmats, including animated mats tinted by colour identity (Phase 3 leftover; 7 static + 2 animated mats) | Medium / ~1 d | Done 2026-09-23 |
| Game UI | Compact (Arena-style) battlefield cards: art-crop tiles with name, type and mana-source pips; Settings → Board → Card style (Classic / Compact) and Tapped cards (Sideways 90° / Tilted 45°) | High / ~1 d | Done 2026-09-25 (battlefield only; hand, stack and dialogs keep full cards; tapped cards are scaled so the rotated box fits the row) |
| Game UI | New table interface (`gameUi` setting, `v2`): top bar with turn and day/night, six-pip phase dial around the pass button (blue pass, gold resolve, grey wait), the stack as a card deck (top card + one tab per object), seat-coloured player portraits (hand count on the avatar, Lib/GY/Exile chips, mechanic chips, commander-damage chips, your own portrait with mana pool at the bottom left), a docked side panel (log, chat, commander matrix, mechanics, tracker), a four-line "Last actions" box (newest first, names in bold, seat-coloured dots) and a combat damage ledger above your portrait (attacker, seat dots, commander total before → after, life before → after); arrows take the seat colour of their source (thin dashed arc, edge to edge); short mechanic chips (Ring N, Monarch, Initiative, Speed N, current dungeon room n/m, Blessing) and a one-scroll Mechanics panel (Ring levels, dungeon map, table state) | High / ~3 d | Done 2026-10-13, **on by default** (`Settings → Appearance → New table interface` goes back to `v1`; the name is still pending). Guards: `e2e/game-ui-v2.spec.ts`, `board/StackDeck.test.tsx`, `board/CombatArrowsOverlay.test.tsx`, `game/MechanicsOverview.test.tsx`, `game/PhaseDial.test.tsx`, `game/PlayerInfoBar.portrait.test.tsx`, `game/LogTicker.test.tsx`, `game/combatLedgerModel.test.ts`, `game/commanderChips.test.ts` |
| Game FX | Dynamic music: ambient layer that intensifies near lethal | Medium / ~1 d | Done 2026-09-23 |
| Game FX | Cinematic victory/defeat screen with match stats (key card, turns, life taken/lost, spells cast, creatures destroyed) | Medium / ~1 d | Done 2026-09-23 |
| Ease of use | "Your turn / response needed" browser notification + title/favicon badge when the tab is hidden | Very high / ~0.5 d | Done 2026-09-23 (toggle in Settings → Gameplay; permission asked on the first in-game click) |
| Ease of use | Explicit waiting state ("Waiting for X — thinking 0:23") | Medium / small | Done 2026-09-23 (action button names the actual priority holder, thinking clock + priority timer countdown, warn tint after 60 s) |
| Ease of use | Smart mana payment: opt-in exact solver taps the sources for the cost being paid and keeps colours open for instants in hand (public information only) | High / ~1 d | Done 2026-09-23 (toggle in Settings → Gameplay and the game menu, off by default; skips Treasure-style sacrifice, restricted mana and convoke; a multi-spell turn scheduler is not built; validated against the local server by `e2e/smart-mana-real.spec.ts`) |
| Game UI | Non-modal decision prompts: plain yes/no asks (pay life, optional costs, ward/cascade) answer from a dock bar; picks from your own hand (discards) resolve by clicking the highlighted hand with the grid as explicit fallback; any remaining dialog can be made transparent (Appearance) or peeked with Alt | High / ~1 d | Done 2026-09-29 (`feedbackModes/AskBar.tsx`, `game/handPick.ts`, `TargetBar` expand + `DialogShell`/`Modal` peek; `AskBar.test.tsx`, `handPick.test.ts`, `FeedbackDialog.test.tsx`, `selectors.test.ts`, `Modal.test.tsx`; fake e2e 281 passed, gallery entries `prompt:ask` / `prompt:discard-hand`) |
| Game UI | Trigger order, second pass: pick in resolution order with drag & drop, auto-chain the remaining one-at-a-time prompts, show the accumulated stack and the targets/related objects that distinguish duplicate triggers, decouple "pick" from "remember first/last" and manage saved rules per row | High / ~1-2 d | Done 2026-09-29 (`TriggerOrderDialog` + `triggerOrderPlan.ts`: drag/▲▼ resolution order, "Apply order" chains the bottom-up prompts, sent/next rows + "Sending n/N", manual pick kept, pins only remember, target/related labels, hover preview; `TriggerOrderDialog.test.tsx` 13, `trigger-order.spec.ts` 3 fake). Consciously out: non-modal dock and 1..9 shortcuts (Alt-peek already exists); per-row rule management is impossible server-side (only RESET_ALL and add) |
| Attract | Personal match history + per-deck stats (win rate by deck/format/opponent, IndexedDB) | Very high / ~2 d | Done 2026-09-23 ("My stats" sub-tab in the History tab; one record per finished game recorded on `GAME_OVER`, only when the player was seated and a winner is reported; deck name comes from the last equipped deck and format from the lobby table, so both can be missing; capped at 500 records) |
| Attract | Draft pick helper | High / ~2 d | Not started |

Dropped on purpose (2026-10-07, data does not reach the client): the response window, the blocked-action explainer and the layer / derived P-T inspector. Reopening any of them needs a fork change that puts the missing data on the wire (a per-player playable list, effect sources). Reasons: `docs/history/roadmap-resolved-2026-10.md` §4.2.

### 4.3b Board legibility

| Open item | Why it is not a toggle |
|---|---|
| See the rules text of every permanent in play without hovering | Legible text for 8+ permanents does not fit one screen. Options: bigger cards with band panning, a one-line rules strip under compact tiles, or a persistent inspector |
| Commander pod room (issue #23): what is left after BRD-1…BRD-13 | Shipped 2026-10-22 in the Arena and Table layouts (`docs/specs/board.md`): lands left and other non-creature permanents right, a planeswalker/saga/battle column, and focusing one opponent's board (`board/seatFocus.ts`); then the opt-in **main board** mode (BRD-6…BRD-13, `board/SpotlightBoard.tsx`): one board at full size, every other board as a scaled copy in a resizable side panel, piles as corner cards and the strip on top. Open: whether the main board mode becomes the default for pods once players have tried it (then BRD-3…BRD-5 retire); copies stop growing once their slot height binds, so the panel width only pays off in three-player games; an opponent card height is bound by the opponents' row (40% of the board), so focus only grows cards a crowded column had shrunk; at 1366x768 a non-focused opponent column still sits at the 38 px card floor, with mid-word name breaks on small faces |

### 4.3b2 Unified keyword glyphs and badges

One registry (`keyword id → glyph`, today `board/KeywordGlyph.tsx`) feeds every surface that draws a keyword: card badges, the hover preview (`FloatingCardPreview`) and the wiki glossary (`HelpWikiModal`). Glyphs come from Lucide (already a dependency, one table line per keyword); keywords without a clear pictogram get a 2-letter abbreviation, never a shared category icon or an emoji. Every phase ends with a contact sheet in `#/gallery` (all glyphs at real badge size), a guard test and a screenshot.

| Phase | Scope | Status |
|---|---|---|
| 1 | Card badges: combat / evasion / protection glyphs, server `ABILITY_*` merge, `BadgeTip`, mutate, responsive row with `+N` | Done 2026-10-21 |
| 2 | Move the glyph registry out of `CardSlot`; hover preview and wiki glossary use it (drops the emoji and the per-category Lucide icon); keyword-id → glyph guard test | Done 2026-10-21 |
| 3 | `combat` / `evasion` / `protection` leftovers + `counters` (11) + `cards` (7) + `graveyard` (14) + `mana` (19) mapped to Lucide; abbreviation fallback | Done 2026-10-21 (nine haiku batches in `board/glyphs/*.ts`, Lucide geometry copied as data) |
| 4 | `mechanic` (166, the long tail) plus the rest of the glossary: 218 keywords needed a glyph; 85 got a pictogram and 133 a 2-letter abbreviation (an honest sigla beats a loose metaphor); `glyphs.test.ts` fails on any keyword with neither; `scripts/glyph-check.mjs` rejects repeated shapes and siglas, `scripts/glyph-sheet.mjs` renders the contact sheet | Done 2026-10-21 |
| 5 | State badges on the card (sickness, transform, face-down type, the 10 designations + Room) move to `BadgeTip` and the shared style; the e2e specs that read `title` migrate | Done 2026-10-21 |
| 6 | Counters and number badges (P/T, loyalty, defense, damage) get a real tooltip, no new look; the designation row stops overlapping the keyword row | Done 2026-10-21 |

### 4.3c New table interface (v2): what is left

Shipped 2026-10-13 behind `settings.gameUi` (`v1` = the interface as it was; `v2` is the default, `e2e/fixtures.ts` pins `v1` for the older specs and the v2 specs choose it explicitly). Board layouts (Standard, Pod, Arena) are untouched: v2 only changes the chrome around them and the `PlayerInfoBar` skin. The two things that make it cheap to keep: `GameScreen` renders either set from the same state (`v2` flag), and every `data-testid` the e2e suite relies on (`phase-bar-step-*`, `stack-count`, `game-status`, `phase-name`) exists in both.

| Open item | Why |
|---|---|
| Name for v2 | Product decision; the setting is still called `gameUi` / "New table interface" |
| Real-mode run of `game-ui-v2.spec.ts` and a gallery entry per v2 state | The spec injects a `GameView` into the store (fake mode only); nothing yet proves v2 against the recorded frames or the visual-regression gallery |
| Opponent hand in v2 | A hand with known cards is opened from the hand badge on the avatar (eye icon, `known/total`, `PlayerInfoBar` `handView`); the face-down stack stays only while the hand is an effect target, because it carries the target highlight. Card-count changes of hand, library, graveyard and exile flash as `+N/-N` (`useCountFlash`). Other events (life, counters, mechanics) do not get their own cue yet |
| Hand column with the side panel open | The column hides while the panel is open and the fan returns (`BoardShell`); a slim thumbnail strip would keep the hand in place but needs its own card render |
| Stack tabs past the 7th and the arrow filter | Tabs beyond `STACK_DECK_MAX_TABS` are only reachable through the expanded view, and the target arrows are drawn only for the top object and the hovered one (`CombatArrowsOverlay` `stackFocusIds`); a long chain therefore hides arrows by design |
| Combat ledger source | Built from the parsed feed (`useFeedItems`): it only knows the damage the log reports, with no "dies" line and no first-strike split, because the parser has no such events |
| Target and attacker highlight on battlefield cards | The design rings a targeted card in red and drops an attacker 14 px with a red outline; both live on the battlefield card render, which v2 deliberately leaves alone |
| Stack tab hover preview | The deck reuses `FloatingCardPreview`, so the preview follows the global preview size instead of the design's 214x300 card and can cover the target arrow it is explaining |
| Dungeon map as a floating window | The mechanics tab shows it; the old info window on room change is not wired to v2 |
| Narrow windows | The top bar, dial and stack deck were only checked at 1600x900; below ~1200 px the stack deck reserves 284 px of board width |
| v2 board layout | v2 is the fourth board layout ("Table", next to Standard, Pod and Arena in both settings pickers; stored as `gameUi: 'v2'`, so choosing a classic layout switches back to the classic chrome). It renders the arena board (up to 4 players; 5+ still falls back to standard) whatever `boardLayout` holds. The own battlefield is kept between the portrait, last-actions box, combat ledger, phase dial and action button by measuring them (`useOverlayGutters`), not by a fixed budget. Open: the own lands row can still run under the fan hand when the battlefield is tall, and at 1280 px the opponent columns shrink card names to wrapping. The space the rival hand fan used to hold (about 200x110 px right of each opponent portrait) is not reused: putting the permanents band there left 35-60 px cards with clipped names, and doing it only when it fits would make the board jump as permanents are played. `useOverlayGutters` also caps the ledger and the last-actions box below the divider, and `game-ui-v2.spec.ts` "no overlap" asserts that no visible battlefield card touches a portrait, the log, the ledger, the stack deck or the dial |
| Commander damage, real partner pods | The v2 matrix (`CommanderSeatMatrix`) and the portrait chips group commanders by seat and print `X/Y` for partners, tones from 12 (amber) and 18 (red) as in the design; covered by unit tests with synthetic partners, but no recorded frame has a partner pair yet |

### 4.3d Keyword effects: known gaps

Shipped with the keyword auras and combat moments (`board/keywordAura.ts`, `board/keywordStrikeFx.ts`, `board/CardSlot.tsx`).

| Open item | Why |
|---|---|
| Morph or disguise turned face up pops every keyword | Every keyword counts as "gained". Decide whether that is intended, then pin it with a test |
| Stale callbacks after a relink can bypass the proxy's ordering | Needs the fork to fence callbacks per CallbackHandler (Mage.Proxy CallbackSequencer; reset during relink) |
| Double strike: the second hit is not scheduled for blocker keyword moments | A double-striking attacker's second hit is not scheduled separately, so the keyword moments of its blockers fire for the first hit only (`board/keywordStrikeFx.ts`) |

### 4.11 Lobby, invites and proxy restore

| Open item | Why |
|---|---|
| Invite links to another server connect with an empty password | An invite link to another server connects with an empty password instead of the saved one. Better: open the login screen prefilled with the target server and username |
| `RestoreIds` keys ignore the port | `mage-proxy` sets the keys without the port. Cross-port restore is pinned by `RestoreIdsTest`, which has to change with the fix |

### 4.12 Behaviour specs and usability checks

Design: `docs/plans/2026-10-22-behavior-specs-design.md`. Phase 1 shipped 2026-10-22: `docs/specs/` with one file per area and `web/src/specCoverage.test.ts` linking each rule to the tests named after it.

- Rules marked `Guard: none yet` need a test (`grep -n "none yet" docs/specs/*.md`).
- Areas without a spec are written the first time someone changes them (stack, log and chat, deck builder, draft, settings, spectating).
- Findings while writing the specs (not made rules). Confirmed in code:
  - `state/events/game.ts` clears an open `GAME_PLAY_MANA` prompt on any update whose stack is non-empty, and a spell being paid for is already on the stack. Whether the real server sends an update between mana asks needs a recorded frame.
  - `board/revealedCards.ts` `opponentRevealedCards` adds every revealed group to each opponent's known hand, whatever zone or player it came from (`handRevealFx.ts` filters by the group name).
  - To check: skip keys (F4–F11) fire with Settings/wiki/game menu open; F5/F11 are always prevented on the game screen; Ctrl/Shift-click to hold priority cannot reach `onPlayableClick` from the hand (`CardSlot.onClick` drops the event); the AskBar 1–9 digits need focus inside the bar; `__mageScene.targeting.source` is always null although `AGENTS.md` documents it; the combat ledger and the life-loss sound mute key off damage-step frames the real server rarely sends (the CMB-6 trap); combat `selectable` may outlive the declaration window; `resolveTargetSourceId` matches the arrow source by card name; `CardSlot.css` `sicknessFloat`/`enteredGlow` loop forever and two of them ignore `--fx-speed`; the wiki's Shortcuts tab has placeholder copy; unadvertised shortcuts (zoom, rewind arrows/Esc, Shift-click on stops, digits, Alt peek).
- Phase 2: a Playwright sweep of every gallery state with generic usability checks (nothing covers the top layer, decision context visible, a visible way out, controls fit, axe on game states), an `expectVisuallyHidden` helper, a static guard for hold-a-modifier keyup handling and a shortcut registry.
- Phase 3: an exploratory usability agent (per gallery state and per task, Playwright MCP + screenshots, report under `.run/ux-review/`), never gating CI; confirmed findings become spec rules.

### 4.4 Test-infrastructure risk

Shipped 2026-10-23 (branch `feat/test-robustez-tst`, PR #28): the **TST guard package**
(`docs/specs/testing.md`, rules held by rule-id-named tests, `specCoverage` also scans `scripts/*.mjs`):

- **TST-1/2** — game-state integrity invariants (no object id in two zones; zone counts match) run over every recorded frame in unit, no Java.
- **TST-3** — fuzz anomaly triage: a new livelock signature fails the fuzz run until it joins `scripts/fuzz-known-signatures.json` with a reason. The allowlist carries the confirmed 2026-10-19..23 triage (7× state-loop + 1× prompt-storm: server-side prompt loops; SimPlayer hardened with a repeatable-cost decline and a 20-identical-ask fail-safe; a directed `record.mjs` driver proved a human `false` decline closes the dialog).
- **TST-4** — the nightly integration/re-record/validate steps no longer run with `continue-on-error` (`workflows.test.mjs` forbids it).
- **TST-5** — `REAL_E2E_SPECS` is a drift-checked bijection with `@real` tags; the real-mode set grew 5 → 11 protocol-sensitive specs.
- **TST-6** — every guard has a verified fail mode (coverage gate, engine-view baseline versioning with `gapHash`/`sourceCommit`, invariants).
- Coverage **no-regression gate** (fails when a metric drops >1.0 pt vs `web/coverage-previous.json`) wired into `test.mjs`, `dashboard-ci.mjs` and push CI (`web-ci.yml`); baseline committed.
- **TST-7** — verify isolation: `--isolate-verify` (or `VERIFY_ISOLATE=1`) restarts the proxy before every verify script and waits for `/ready`, so each script starts on a fresh proxy with clean server-side session state; it refuses to mix with `self-test`/`human-test`/`fuzz` (those hold live sessions across a restart) and cleans tables for scripts with deterministic usernames (`multi-tenant-test.mjs`). Measured 2026-10-23 vs the non-isolated control (90.7 s, 10/10; fresh-stack baseline 83 s): isolated runs took 113.9 s / 118.1 s (~+28–35 s) and remain opt-in — default behaviour unchanged when isolation is off. Guard: `scripts/verify-isolate.test.mjs`.

Still open:

- Verify isolation's ready-poll race: `node scripts/ctl.mjs restart proxy` is async-detached, so the first `/ready` answer can come from the old proxy before it dies, and `verify-wizard-matrix.mjs` (no WS retry) crashes in the dead gap — the isolated layer ran 9/10 in both measured runs. Fix `restartProxyAndWait` to pin the new proxy PID from launch / require the restart to have taken effect, and/or give wizard-matrix a short bounded first-connect retry; expect 10/10 after.
- Mobile layout: the full board stays desktop-only on purpose. Since 2026-10-15 a phone-width window (≤ 600 px) has a compact spectator view (`game/MobileSpectator.tsx`: scoreboard, turn/phase, stack, feed and chat, "Full board" button), the lobby and chat already fit, and dialogs no longer overflow (`ui/DialogShell.css` caps the panel at the window minus the backdrop padding; the create-table wizard hides inactive step labels and stacks its type cards). Guard: `e2e/mobile.spec.ts` at 390 px (verified red with the dialog fix removed). The draft header fits since the same day (same guard, verified red without its CSS). Still open: playing a seat on a phone and the deck builder editor at 390 px.
- Replay files exist (§4.2); loading one in the GitHub Pages demo is still open.

### 4.5 Out of scope on purpose

Emblem cards in Create Table (experimental `.dck` feature of the desktop client; decided 2026-09-06).

### 4.6 Public proxy operations

- Compare the `commander_damage` / `commander_hidden` journal lines with what the web showed, in production.
- Measure the starter-deck funnel in the journal: users with `getGameTypes` that reach `createTable`, and logged-in users that reach `joinGame`.

### 4.9 Report pipeline

Design: `docs/plans/2026-10-09-report-pipeline-design.md`. Web path shipped.

| What | Why |
|---|---|
| Desktop cannot deliver a report to the maintainers | Desktop dials its own local proxy (`launcher/src-tauri/src/main.rs`), so a desktop report is stored on the player's machine (`%LOCALAPPDATA%\today.xmage.nexus`). Since 2026-10-15 the dialog says so ("Saved on this computer. Nobody has received it yet") and offers **Report on GitHub** (prefilled issue + full report copied to the clipboard; `system/report.ts` `githubIssueUrl`). Still open: the launcher-crash case (no proxy at all) and an automatic upload from the launcher (needs a receiver and abuse limits) |
| Reports reader needs the reports folder to show detail | Built 2026-10-15: `xmage-status` Reports tab groups the journal's `report` lines by fingerprint and lists what the proxy refused. Click-through detail needs `REPORTS_DIR` in the service environment (the proxy's `--reportsDir`), not set by the unit yet. The public proxy rate-limits to 1 report / 30 s, 5 / session and 1 / fingerprint / session; the dialog now explains each refusal in 9 languages |

### 4.10 Interactive demo on GitHub Pages

`site/demo/`: the real client on scripted scenarios (`vite build --mode demo`), guarded by `src/demo/*.test.ts` and `scripts/verify-demo.mjs`.

| What | Why |
|---|---|
| Tour copy internationalized to 9 locales | Built: `DemoTour.tsx`/`scenarios.ts` use typed `titleKey`/`blurbKey` into `TranslationSchema['demo']`; the 12 scenarios' 24 strings exist in all 9 locales, guarded by `scripts/i18n-coverage.mjs` and `src/i18n/i18n.coverage.test.ts` |
| EDHREC is frozen for one commander | `demoEdhrecPage` only answers `krenko-mob-boss`; card search and EDHREC resolution still call Scryfall live |
| Roster and tables are invented | `src/demo/data.ts`. The ranking carries a "sample data" note since 2026-10-15 (`leaderboard-demo-note`, checked by `verify-demo.mjs`); the lobby table list does not |
| Built: a demo layer on the status dashboard | `verify-demo.mjs` writes `web/.demo.json`; `gen-dashboard.mjs` renders it as the "Interactive demo (tour)" layer via `demoVerdict`; `pages.yml` regenerates `status.json` with the demo result and fails the run on a red demo layer |
| Not covered: replay viewer, spectate, chat bots | Needs a scenario that streams frames |
| Mobile layout unchecked | Verified at 1440×900 only (the client itself has a phone spectator view since 2026-10-15) |

---

## 5. Phase Plan (archived)

The original phase plan (2.5 to 5) and its effort matrix are all delivered; kept verbatim in `docs/history/roadmap-phases.md`.

---

## 6. Execution Guidelines

1. **Protocol-First Rule**: Never mutate client state optimistically without an authoritative server update. Player actions are intents sent to the proxy; the resulting `GameView` dictates the UI state.
2. **Schema Invariant**: Whenever proxy Java event models change, execute `node scripts/gen-types.mjs --validate` to keep TypeScript contract definitions strictly in sync.
3. **Dual-Testing Requirement**:
   - Fast UI/logic changes must pass `npm run test` (vitest) and `npm run test:e2e:fake` (Playwright against FixtureServer).
   - Core protocol/interaction changes must pass `node scripts/test.mjs` against the live stack with `SimPlayer` bots.
4. **Zero Flake Policy**: Avoid canvas byte-diff comparisons in E2E tests. Assert against deterministic scene state exposed on `window.__mageScene`.

---

## 7. Standardized Card Component Architecture

### 1. Special Card Morphology (MDFCs, Transform, Adventures, Sagas)

In modern card games, many cards are not static single-faced rectangles:

• Double-Faced Cards (MDFCs / Transform / Battles): e.g. Delver of Secrets, Valakut Awakening, Invasion of Zendikar.
• Adventures and Split Cards: e.g. Brazen Borrower // Petty Theft, Fire // Ice.
• Sagas and Classes: Have chapters (I, II, III) or levels that progress with counters.
• Tokens: Creatures, Treasures, Food, Clues, Maps, Blood.

```
  ┌──────────────────────────┐           ┌──────────────────────────┐
  │ [Delver of Secrets]  (U) │           │ [Insectile Aberration]   │
  │ 1/1 Creature - Wizard    │  ──(⟲)──▶ │ 3/2 Creature - Insect    │
  │ At the beginning of...   │   Flip    │ Flying                   │
  │                    [ ⟲ ] │           │                    [ ⟲ ] │
  └──────────────────────────┘           └──────────────────────────┘
```

#### How it is standardized (MultiFaceCard Pattern):
• In data: XMage already exposes `secondCardFace`, `isTransformed`, `isToken`, and `counters.LORE` in `CardView`.
• In UI:
  1. A floating flip button ⟲ (or keyboard shortcut / hover) on the card corner to preview the back face in hand and graveyard.
  2. On the battlefield, if `isTransformed === true`, automatically render the face-B texture (Scryfall indexes this as `card_faces[1]`).
  3. For Sagas and Classes, a badge on the card showing the current chapter (`ChapterBadge: [II]`).

──────
### 2. Attachment Hierarchy (Auras, Equipment, Mutate)

When playing an Aura or Equipment, they attach to a creature. In Mutate mechanics, multiple cards stack under/over the host creature.

```
  ┌──────────────────────────────┐
  │  ┌───────────────────────┐   │  (Equipment)
  │  │ ┌───────────────────┐ │   │
  │  │ │                   │ │   │
  │  │ │ Host Creature (5/6)│ │  │
  │  │ │                   │ │   │
  │  │ └───────────────────┘ │   │
  │  └───────────────────────┘   │
  └──────────────────────────────┘
```

#### How it is standardized (AttachmentAnchor Pattern):
• In data: XMage sends `attachedTo: UUID` or `attachments: UUID[]` on each permanent.
• In UI:
  1. Rather than occupying independent slots on the battlefield, attachments render cascaded behind the host creature (offset 10px up/right).
  2. If the host creature taps or attacks, all its attachments move along with it as a single unit.

──────
### 3. Global State Indicators and Player Counters

In addition to life and mana, the game engine tracks persistent global states and counters:

• Player counters: Poison (Poison ≥ 10 = defeat), Energy, Experience, Radiation (Rad counters).
• Global designation states:
  • The Monarch (👑).
  • The Initiative / Dungeons (🏰).
  • Day / Night (☀️ / 🌙).
  • City's Blessing.
• Planeswalker Emblems: Permanent passive abilities.

#### How it is standardized (PlayerBadgeStrip & EmblemTray Pattern):
• In data: `PlayerView` includes `counters.POISON`, `isMonarch`, `hasCitysBlessing`, and `GameView.emblems`.
• In UI: A compact pill bar beside player life:
  `[ 💖 20 ] [ 💀 3 ] [ ⚡ 4 ] [ 👑 Monarch ] [ ☀️ Day ]`
  Hovering over an emblem opens the enlarged card preview.

──────
### 4. Keyword Ability Badges

In a match with many creatures on the board, reading card text to check for Flying, Deathtouch, or Trample creates cognitive load.

```
  ┌────────────────────────┐
  │  Questing Beast   4/4  │
  │                        │
  │   [🪽] [⚡] [☠️] [🛡️]  │  ◄── Visual badges on the frame
  └────────────────────────┘
```

#### How it is standardized (KeywordBadgeSet Pattern):
• In data: `CardView.rules` and `CardView.abilities` contain parsed keywords.
• In UI: A set of micro SVG icons on the lower-left corner of the permanent:
  • 🪽 Flying / Reach
  • ⚡ Haste / First Strike
  • ☠️ Deathtouch
  • 🦏 Trample
  • 🛡️ Vigilance / Hexproof / Ward
  • 💖 Lifelink

──────
### 5. Revealed Information / Known Cards (Known Information Tray)

When an effect reveals an opponent's hand, those cards remain public knowledge until played or discarded.

```
  ┌────────────────────────────────────────────────────────┐
  │  Opponent's Hand:   [ 🂠 ] [ 🂠 ] [ 🂠 ]                 │  (3 hidden cards)
  │  Known Cards:       [ Bolt ] [ Push ]                  │  (Previously revealed)
  └────────────────────────────────────────────────────────┘
```

#### How it is standardized (KnownHandTracker Pattern):
• In data: XMage tracks shown cards in `PlayerView.revealedHand`.
• In UI: A miniature tray directly above the opponent's hidden hand displaying verified known cards face up.

──────
### Summary of Component Architecture

| Standard Component | Solves | Implementation Complexity |
|---|---|---|
| `MultiFaceCard` | MDFCs, Transform, Werewolves, Sagas, Adventures | 🟢 Low (Flip button + alternate texture) |
| `AttachmentAnchor` | Auras, Equipment, and Mutate grouped visually | 🟢 Low (CSS / relative offsets) |
| `PlayerBadgeStrip` | Poison, Energy, Monarch, Day/Night, Emblems | 🟢 Low (Status icon badges) |
| `KeywordBadges` | Flying, Deathtouch, Trample, Haste, etc. | 🟢 Low (SVG icons on card sprite) |
| `KnownHandTracker` | Revealed cards after discard / look effects | 🟢 Low (Mini-tray of known cards) |

All of these connect directly to fields already sent by `GameView` from Java without requiring server changes.