# Project Roadmap: XMage Nexus

> **A Modern, Web-Based Digital Card Game Client for XMage**  
> *Last updated: 2026-10-06*

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
| **Quality & QA Foundation** | 1,900+ unit tests (vitest, ~13 s), Java→TS JSON Schema codegen (`gen-types.mjs`), dual-mode Playwright E2E (deterministic FakeServer + Real XMage Stack with `SimPlayer` bots). | ✅ **Completed** | Zero-flake local iteration loop + continuous anti-drift contract testing (3 guards: `callbackCoverage`, `mechanicsCoverage` server→client, `engineViewCoverage` engine→view). |
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
| | VFX & Animations (Spell cast arcs, screen shake, damage) | ❌ No | ✅ Yes (donut color pie, bars, shake, floating damage, spell-weight slam, hit sparks, destroy/exile/token deaths, low-life vignette, foil + tilt preview, playmats, cinematic end screen) | Completed (Surpasses Swing) |
| **Distribution** | Desktop & Web Deployment | ❌ Heavy JRE required | ✅ Web + Tauri launcher (v0.2.3, updater firmado y componentes desacoplados) | Completed |
| **Advanced Formats** | 4-Player Commander / EDH (Command zone, tax, damage) | ✅ Yes | ✅ Yes (PodBoard 2×2 clamp 4; server FFA 3-10) | Completed |
| | Booster Draft & Sealed Tournaments (Pick timer, packs) | ✅ Yes | ✅ Yes (8P DraftScreen/ConstructScreen) | Completed |

---

## 4. Pending Work (single live list)

> Everything that is not done, in one place. Supersedes the open-items table of `docs/history/plan7.md` §4 and the per-idea status of `docs/enhancements.md`. Verified against the code on 2026-09-21.

### 4.2 Product ideas not built yet

Full spec and rationale per idea: `docs/enhancements.md`. Already built from that catalog: deck tracker (1.1), invite links (2.1), London-mulligan evaluator (1.4), sample-hand simulator (part of 4.3), the printing selector in the deck editor (part of 5.2; since 2026-09-30 the choice is a local per-player preference — each side sees their own art and it no longer travels in the game state), custom card images (part of 5.2, 2026-10-05: "Mi imagen" in the printings modal and the in-game card inspector uploads a per-card image stored locally in IndexedDB that overrides Scryfall art for that player only) and selectable playmats (5.1, 2026-09-23) and EDHREC suggestions (4.1, 2026-09-24).

| Idea | Impact / effort | State |
|---|---|---|
| EDHREC suggestions in the deck builder | High / ~1-2 d | Done 2026-09-24 ("Suggestions" tab next to Search in the deck editor; EDHREC public JSON for the designated commander, cached, cards resolved via Scryfall collection, synergy badges, click/drag to add). 2026-09-29: DFC commanders use the front-face slug (Slicer), the panel consumes the whole EDHREC page (~277 cards for Slicer, parallel 75-name batches, per-name cache in memory + IndexedDB), and got the Arena filter bar (client-side matching of chips + Scryfall-syntax text), per-section sort and the shared card size |

Ideas added 2026-09-23 (client review focused on `beta.xmage.today`):

| Area | Idea | Impact / effort | State |
|---|---|---|---|
| Game UI | Opponent-turn recap: highlight new/changed/died permanents when priority returns + one-line summary ("played X, attacked with Y, you lost 4") | Very high / ~1-2 d | Done 2026-09-23 (non-blocking strip at my turn start: summary + departed-card chips by destination; NEW/CHANGED marks on the board) |
| Game UI | Smart stops (Arena-style): only stop when the server reports something playable | High / ~1 d | Done 2026-09-23 (opt-in toggle, off by default; ignores mana-only `canPlayObjects`; answers each `GAME_SELECT` once; validated against the local server by `e2e/smart-stops-real.spec.ts`) |
| Game UI | P/T tinted vs base (green up / red down), summoning-sickness marker, "entered this turn" glow | Medium / ~1 d | Done 2026-09-23 (per-component tint vs printed value with base in the tooltip; client-tracked entered-this-turn glow; sickness badge already existed) |
| Game FX | Spell weight impact: high-CMC / mythic spells darken the board, shake and flash in the card's colours | High / ~1 d | Done 2026-09-23 (2026-09-25: fires when the spell resolves, not when it is cast; countered permanents and cancelled casts never slam) |
| Game FX | Sequential combat strikes: when combat damage resolves, attackers lunge one after another at their blocker or at the player/planeswalker/battle they attack, each landing with the hit sound, sparks and a shake; dying combatants stay on screen until the sequence ends and damage/life numbers pop on each impact | High / small | Done 2026-09-25 (first-strike and regular damage steps animate separately; declaring attackers only shows the existing nudge) |
| Game FX | Physical combat: impact particles on damage, distinct deaths (destroy = burn, exile = beam of light, token = pop/puff); the attacker lunge already existed | High / ~2 d | Done 2026-09-23 |
| Game FX | Low-life tension: red vignette + heartbeat at ≤ 5 life | Medium / small | Done 2026-09-23 |
| Game FX | Foil shimmer + 3D tilt on the enlarged card preview | Medium / small | Done 2026-09-23 |
| Game FX | Selectable playmats, including animated mats tinted by colour identity (Phase 3 leftover; 7 static + 2 animated mats) | Medium / ~1 d | Done 2026-09-23 |
| Game UI | Compact (Arena-style) battlefield cards: art-crop tiles with name, type and mana-source pips; Settings → Board → Card style (Classic / Compact) and Tapped cards (Sideways 90° / Tilted 45°) | High / ~1 d | Done 2026-09-25 (battlefield only; hand, stack and dialogs keep full cards; tapped cards are scaled so the rotated box fits the row) |
| Game FX | Dynamic music: ambient layer that intensifies near lethal | Medium / ~1 d | Done 2026-09-23 |
| Game FX | Cinematic victory/defeat screen with match stats (key card, turns, life taken/lost, spells cast, creatures destroyed) | Medium / ~1 d | Done 2026-09-23 |
| Ease of use | "Your turn / response needed" browser notification + title/favicon badge when the tab is hidden | Very high / ~0.5 d | Done 2026-09-23 (toggle in Settings → Gameplay; permission asked on the first in-game click) |
| Ease of use | Explicit waiting state ("Waiting for X — thinking 0:23") | Medium / small | Done 2026-09-23 (action button names the actual priority holder, thinking clock + priority timer countdown, warn tint after 60 s) |
| Ease of use | Smart mana payment: opt-in exact solver taps the sources for the cost being paid and keeps colours open for instants in hand (public information only) | High / ~1 d | Done 2026-09-23 (toggle in Settings → Gameplay and the game menu, off by default; skips Treasure-style sacrifice, restricted mana and convoke; a multi-spell turn scheduler is not built; validated against the local server by `e2e/smart-mana-real.spec.ts`) |
| Game UI | Non-modal decision prompts: plain yes/no asks (pay life, optional costs, ward/cascade) answer from a dock bar; picks from your own hand (discards) resolve by clicking the highlighted hand with the grid as explicit fallback; any remaining dialog can be made transparent (Appearance) or peeked with Alt | High / ~1 d | Done 2026-09-29 (`feedbackModes/AskBar.tsx`, `game/handPick.ts`, `TargetBar` expand + `DialogShell`/`Modal` peek; `AskBar.test.tsx`, `handPick.test.ts`, `FeedbackDialog.test.tsx`, `selectors.test.ts`, `Modal.test.tsx`; fake e2e 281 passed, gallery entries `prompt:ask` / `prompt:discard-hand`) |
| Game UI | Trigger order, second pass: pick in resolution order with drag & drop, auto-chain the remaining one-at-a-time prompts, show the accumulated stack and the targets/related objects that distinguish duplicate triggers, decouple "pick" from "remember first/last" and manage saved rules per row | High / ~1-2 d | Done 2026-09-29 (`TriggerOrderDialog` + `triggerOrderPlan.ts`: drag/▲▼ resolution order, "Apply order" chains the bottom-up prompts, sent/next rows + "Sending n/N", manual pick kept, pins only remember, target/related labels, hover preview; `TriggerOrderDialog.test.tsx` 13, `trigger-order.spec.ts` 3 fake). Consciously out: non-modal dock and 1..9 shortcuts (Alt-peek already exists); per-row rule management is impossible server-side (only RESET_ALL and add) |
| Attract | Personal match history + per-deck stats (win rate by deck/format/opponent, IndexedDB) | Very high / ~2 d | Done 2026-09-23 ("My stats" sub-tab in the History tab; one record per finished game recorded on `GAME_OVER`, only when the player was seated and a winner is reported; deck name comes from the last equipped deck and format from the lobby table, so both can be missing; capped at 500 records) |
| Attract | Draft pick helper using public 17lands ratings | High / ~2 d | Not started |

Ideas added 2026-10-06 — **state-reading assistants**, full spec in `docs/enhancements.md` §6. All four are client-only (they read views the server already sends). Two constraints gate the whole set, spelled out in that section: **public information only and visibly on** (opt-in setting, no decision automation against a human, "unknown" instead of a guess), and **no optimistic state** (§6 rule 1).

| Area | Idea | Impact / effort | State |
|---|---|---|---|
| Game UI | Response window: hovering a stack object shows who can answer right now — which of my cards could legally go on top, which answers are visible on the other side, what closes when this resolves | Very high / ~1-2 d | Not started. Sources already on the wire: `stack`, `canPlayObjects`, `totalEffectsCount`, `gameCycle`, `priorityPlayerName` and `CardView.playableStats`, which reaches the client and is used nowhere in `web/src`. Read-only annotation, no best-play hint; complements `game/smartStops.ts` (which decides whether to stop, not what responds) |
| Game UI | Blocked-action explainer ("why can't I?"): one line naming why a card that looks playable is locked — missing colour, no legal target, rule restriction, ability already used this turn, loyalty limit, no priority | Very high / ~1 d | Not started. Sources: `CardView.playableStats`, `targets`, `canAttack`/`canBlock`, `PlayerView.manaPool`, `cardIcons` (restriction markers such as goad already arrive as `OTHER_HAS_RESTRICTIONS`), `data/mtgKeywords.ts`. Reason *kind* kept separate from wording so all 9 locales translate it; must not contradict the smart-mana solver |
| Game UI | Layer / derived P-T inspector: "why is this 2/2 a 5/5 right now" — the chain of aura / equipment / counters / copy / mutate layers applying to it, in attachment order | High / ~2 d | Not started. Sources: `attachedTo`/`attachedToPermanent`/`attachments`/`copy`/`mutateView`/`damage`/`counters`, `rules`, `originalPower`/`originalToughness`. `board/ptTrend.ts` already shows that P/T differs from printed; this adds what makes it differ. `web/ENGINE_VIEW_TRIAGE.md` records that the engine's `abilities`/`info` do not travel in the DTO, so an unresolvable link stays "unknown" |
| Game UI | Board rewind: opt-in capture of the views a game sent + scrub to any earlier turn to read the board as it was (review a line, screenshot a moment), also the substrate for a future replay file | High / ~2-3 d | Not started. `net/frameBuffer.ts` is the hook but is bounded for diagnostics (60 frames, whole frames up to 8 KB shipped / 64 KB dev) while a `GAME_UPDATE` is 200-800 KB, so it needs its own capture (per-turn snapshot or delta). Must be a read mode over recorded views with its own slice, never a mutated live store; the server's own replay stays off (`saveGameActivated="false"`, "not working correctly yet" upstream), which is why a client-side recording is the only replay that can actually be tested |

### 4.3 UI polish debt

RESOLVED 2026-10-06 (the list from the 2026-09-21 audit):

- **Spacing literals**: 815 → 19 in `padding`/`margin`/`gap`. Exact scale values became `--sp-*` with no pixel change (712), the off-scale ones snapped to the nearest step (84; ties up, as in `921a9e4`) and the scale gained `--sp-3h: 14px`, which saves 40 sites from moving. The 19 left are layout measures on purpose (icon insets of 34–42 px, `--card-w` fallbacks, hero paddings). Gallery visual suite regenerated at 1920 after checking every diff (1-px shifts in badges, pills and the phase bar).
- **Inline `style={{}}`**: 102 → 65, all of them data-driven (positions, widths, per-player colours, CSS variables). The static ones (cursors, flex rows, wizard hint boxes with literal colours, deck inspector titles) are classes on tokens.
- **Raw `<button>`**: the ~90 left are bespoke controls (cards, piles, phase pills, mana orbs, nav items) that no primitive fits without overriding all of it; the 8 without `type` got `type="button"`; `ui/rawButtons.test.ts` now checks that every raw button declares its type, besides its count ratchet (91 → 90).
- **`Field` / `Input` primitives** (`ui/Field.tsx`, `ui/Input.tsx`): label above, optional hint (muted or warn) and announced error outside the `<label>` and linked with `aria-describedby`, `group` mode for chip/radio sets. Create Table (all tabs), Login, Setup wizard and Import deck use them; their per-form label rules are gone, and the duplicated global `.import-name-input` (two sheets, last one won) is resolved.
- **Lobby list density**: compact rows toggle next to the filters (`tables_density` in localStorage), one line per table at desktop widths, wraps on narrow screens (`e2e/lobby-density.spec.ts`).
- **Construct pool sorting**: colour (WUBRG, gold, colourless, lands) / mana value (lands last) / type / name, `game/poolSort.ts` + tests.
- **Backup labels in Decks**: they said "Export deck (N)" / "Import deck (JSON)" for backing up all decks and restoring a backup (and were English in ja/zhs); now they say what they do in the 9 languages, with tooltips and a restore count message.

The style ratchet (`ui/styleTokens.test.ts`) keeps the counts from regressing.

### 4.4 Test-infrastructure risk

RESOLVED 2026-09-30: the two real-mode failures flagged here earlier (`skips.spec.ts`,
`priority-stop-real.spec.ts`) were a mis-targeting artifact, not a code bug. `E2E_BACKEND=real`
without `E2E_SERVER_HOST` logs into **beta.xmage.today** (documented in `docs/lessons.md:98`), not
the local stack, and the public server's engine did not honor the mid-game `UserSkipPrioritySteps`
updates (correct `updatePreferences` payloads verified on the wire; the patched local 1.4.62-V1
honors them). With `E2E_SERVER_HOST=127.0.0.1` (what `integration-report.mjs` uses) both specs pass
against localhost. Hardened while investigating: the `mage_e2e` MCP tool forces
`E2E_SERVER_HOST=127.0.0.1` for `backend=real` (it is documented as the local stack), and
`e2e/support/start-game.ts` (`waitTableReady`/`startMatch`) now polls both staging and lobby paths
instead of committing to one at 500 ms — under beta's latency the app's late `JOINED_TABLE` jump
left the lobby row stale and the old wait hung.


RESOLVED 2026-09-28: `verify-player-leave.mjs` failed **deterministically** when it ran right after `multi-tenant-test.mjs` (all three retries, "partida congelada tras el CONCEDE (sin vistas)"), while passing 13/13 alone — reproduced with the pre-`RestoreIds` proxy build, so it was a pre-existing ordering sensitivity, not a regression. It now runs **first** in the layer, before any other script touches the proxy, and the layer is 9/9 (it still needs its own retry every so often: 82 s / attempt 2). What `multi-tenant-test` leaves behind is still unknown; the script remains the most sensitive one.

RESOLVED 2026-09-28: the 10 anti-drift scripts (`multi-tenant-test`, nine `verify-*`) plus the fuzzer
were not referenced by `test.mjs`, `web-ci.yml`, `pages.yml` or `dashboard-ci.mjs`, so ~2 900 lines of
regression tests only ran when someone remembered. They are now the `verify` layer (~100 s, in the
integration CI job), `verify-restart` (its own layer; it replaces the proxy process) and `fuzz`
(nightly). Wiring them up immediately found two real problems: the scripts never logged out, so a run
left 21 sessions and 458 threads behind and the sensitive one failed on the degraded server (fixed
with a `disconnect` per script: `created=21 disposed=0` → `created=47 disposed=46`), and the layer only
checked the port instead of `/ready`, so it could start while the proxy was still building its card
database.

### 4.5 Out of scope on purpose

Emblem cards in Create Table (experimental `.dck` feature of the desktop client; decided 2026-09-06).

### 4.6 Public proxy operations

Since 2026-09-26 a proxy restart no longer ends the games in progress: the proxy does not disconnect its sessions on shutdown, the server sees a lost connection and keeps the tables for 3 minutes, and a re-login through the new proxy restores the game with its pending prompt; the SIM seats of that account are logged in again from the on-disk roster (`--simRoster`) and keep playing (`scripts/verify-reconnect.mjs`, restart and SIM phases). Limit: the players must log in again within those 3 minutes (the web reconnects on its own while the tab is open).

Since 2026-09-27 the host runs `xmage-status` (`ops/status/`, LAN-only on `:8790`, no tunnel): players online, history, statistics, proxy/playit logs, host metrics and restarts, built from the journal and the playit log without touching the proxy. Findings from its first run:

| What | Why |
|---|---|
| RESOLVED 2026-09-28 — every failed login leaked 2-5 non-daemon threads. `Gateway.handleConnect` builds a `ProxyClient` per `connect` and its constructor schedules `lobbyTimer` (2 s) and `keepAliveTimer` (20 s) immediately, but the failed-login branch only did `unregisterSession`; the grace timer is never armed for a client that is not connected, and the process shutdown hook walks `byAccount`, where the client had already been removed — so nothing could ever release it. With the 172-retry login loop above that is ~1000-3000 threads per user, and non-daemon ones also keep the JVM from exiting | Fixed by `ProxyClient.dispose()` (the 6 `shutdownNow()` that `shutdown()` and `expireGrace()` duplicated), called from the failed-login branch and from `Gateway.onClose` when `isDisposable()` (no session, no relink, **no pending grace timer**, which runs on the timer we would be killing). Guarded by `ProxyClientFailedLoginTest`; the thread-count test reported 75 extra threads over 25 failed logins before the fix and 0 after |
| RESOLVED 2026-10-07 — 48 `Server error` / `Card not found - <card> - <set> - <number>` on join in three days | Imported decks with printings the server does not know still reached `joinTable`. Now an entry without a printing gets the XMage importer's printing at the proxy edge (`DeckJson.resolvePrinting`), imports take their printings from XMage (`resolvePrintings`), and the printings modal and the card search mark what the server's release lacks (`cardPrintings`). Confirmed on the host's journal (2026-09-23 → 2026-10-06): 2 `Card not found` in the whole window, none after 2026-09-27 |
| NEW 2026-10-07 — how a game ended was not recorded | The journal had `joinGame` and `quitMatch` but no game end, so finished games could not be told from games left behind by a disconnect or an expired session. `GameActivity` now writes `game_start` (`role=player\|watcher`) and `game_end` (`result=won\|lost\|draw\|quit\|conceded\|watched\|unfinished`, `reason`, `turns`, `duration_s`, `players`, `cause` from `GameEndView`: timeout / idle / quit, own or an opponent's); `xmage-status` shows it as "How games end". A game still open when the proxy process restarts has a `game_start` and no `game_end`. Guarded by `GameActivityTest` |
| NEW 2026-10-07 — 60 % of the players who logged in never sat down | 105 of 174 never created or joined a table; 28 opened Create Table and left. Outside DEV a new player has no deck at all (`bundledDecks()` is empty), so the seat step and Join Table had nothing to offer. Create Table and Join Table now offer two starter decks (Mono Red Burn, Mono White Humans, both validated as Modern by XMage) with one click; the bot seat gets the other one. Measure it in the journal: share of users with `getGameTypes` that reach `createTable`, and of logged-in users that reach `joinGame`. Still open: the catalog's three Commander lists are illegal (53-84 cards) so there is no starter for Commander tables |
| RESOLVED 2026-09-28 — login success is ~34 %: most failures are `User already connected or your IP address changed` retry loops (one user: 172). The server hands a session to any login that presents its id as `restoreSessionId` (even from another address), but the proxy only kept that id inside the live `ProxyClient`: after a dispose or a restart it sent nothing and every retry was refused until the server expired the old session. The proxy now keeps the id per `host\|username` in memory and on disk (`RestoreIds`, `--restoreIds`, 10-min TTL like the SIM roster) and presents it on the next login; a `disconnect` (logout) drops it. Verified live: after a proxy restart the re-login logs `connected to server with restored session`. The web also counts the wait down on the connecting splash and, when it still fails (the account is open elsewhere), replaces the raw server text with an actionable message instead of looping silently |

### 4.6b Proxy hardening (2026-09-28, same pass as the thread leak)

All verified against the local stack; `175` Maven tests, `self-test`, `human-test`, `multi-tenant-test` and five
`verify-*` scripts green.

| What | Why |
|---|---|
| RESOLVED — `catch (Exception)` in `processCallback` and `handleCommand` | Both run on single-thread executors, so an `Error` killed the thread for good (`ThreadPoolExecutor` never replaces a dead one) and the session went deaf with nothing in the log. Now `catch (Throwable)` |
| RESOLVED — `SessionProbe` resolved `SessionImpl.server` by reflection on every probe and swallowed the failure | A field renamed in the fork would make every probe report a dead link and put every session in a permanent relink loop: a self-inflicted outage, silently. The field is resolved once (a broken one logs `SEVERE` at startup) and an unaskable probe now answers "alive", never "lost" — relinking on a false alarm kicks the healthy session and freezes the game thread |
| RESOLVED — `pollDetailedMessage` was a `Thread.sleep(60)` loop on `commandExecutor` | The session's only server-facing thread, blocked 1.6 s per rejected action (4.5 s on a failed login, 0.9 s covering an error); a burst serialised into tens of seconds of dead queue. Now a leaf lock + condition that returns the moment the message is captured |
| RESOLVED — the sequencer's 400 ms gap timer shared `pingTimer` with `expireGrace` | `expireGrace` holds the client monitor across a server round-trip, so while it ran the gap budget was silently overrun. The sequencer has its own timer |
| RESOLVED — `fetchOnlineDeck` blocked the command thread for up to 8 s | A single deck import froze every other action of that session, and it ran on a shared multi-tenant proxy. Now a bounded daemon pool (2-4 threads, queue 16) that answers "too many in flight" instead of growing an unbounded backlog of sockets |
| RESOLVED — `JsonUtil` re-walked `getDeclaredFields()` per object per event | The filter only depends on the class, so the writable-field array is now resolved once per class; a `GAME_UPDATE` walks a thousand views. Control characters use a hex table instead of `String.format` per char |
| RESOLVED — `OutboundLog.withSeq` copied the whole frame on every broadcast | `"{\"seq\":" + seq + "," + json.substring(1)` allocated a full 200-800 KB copy and grew a default-16 StringBuilder through it. Now one exactly-sized buffer. Building the `seq` at the source would be cheaper but unsafe: it has to be assigned under the `authorized` lock in broadcast order |
| RESOLVED — `Config.parse` took a flag as the previous flag's value | `--host --port 17171` set `host="--port"` and dropped the port, so a typo in a systemd unit started the proxy against host `--port` with nothing in the log. It now refuses to start |
| RESOLVED — `Gateway.onError` printed the exception text only, unthrottled, on stderr | A client that desyncs raised it per frame, and stderr has no rotation. Now one stack, then one line per minute, like the lobby throttle |
| RESOLVED — no `/health` nor `/ready`; the HTTP server had no executor | `HttpServer.create(addr, 0)` without `setExecutor` uses the single-threaded JDK dispatcher, so one slow `/admin/status` (500 serialised events) blocked every static file and would have blocked the health checks. Both endpoints now exist: `/health` is liveness, `/ready` is `503` until the card database is `READY` (a proxy with a failed card DB still accepted logins, the usual cause of a confusing "login failed" during a deploy) |
| RESOLVED — the admin token was accepted in the query string, compared with `String.equals`; the static server sent no security or cache headers | The token landed in access logs, browser history and every proxy in between. Header-only `Bearer`, `GET` only, plus `nosniff`/`DENY`/`Referrer-Policy`/CSP and immutable caching for fingerprinted `assets/*`. No consumer used the query-string form (`ops/status` reads the journal) |
| NEW — watchdog | A line per minute with `threads`, `clientsAlive` (`created - disposed`), `openConns`, `accounts`, `wsErrors` and the card-DB state, plus the same under `/admin/status` `runtime`, and per-connection detail under `sessions`. The leak above ran for weeks with no counter that would have shown it. `clientsAlive` climbing while `openConns`/`accounts` do not turns into a `WARNING` |
| RESOLVED — the replay cache kept the last `GameUpdate` of every game a session ever played | 200-800 KB per game, for as long as the user stayed logged in. A finished game now moves to a single slot, so a client that re-attaches right after `GAME_OVER` still gets the final board and nothing accumulates |
| RESOLVED — the outdated-guard map was a plain `HashMap` written from the command thread and read/written from the callback thread | Concurrent mutation of a `HashMap` can lose entries or spin on a resize; it also boxed a `Stream` over every entry on every callback. Now a `ConcurrentHashMap` plus a maintained high-water mark |
| RESOLVED — the grace period that expired with the XMage link already down returned early | It left the account registered and the user listed in `Activity` forever. It now releases the local session (the server round trip is still skipped, there is nothing to disconnect) |
| RESOLVED — the per-session game allowlist only ever grew | One UUID per game for a session that plays for months. Trimmed past 256, and only ever dropping ids that are not in a game still in progress |
| RESOLVED — the E2E suite had 5 failures nobody could reproduce | Root cause found and fixed: the `mechanics`/`pod` fixtures publish a `revealed` group with **no `name`**, which the contract requires, and the info-window viewer renders a nameless group as `undefined` in the dialog title. Because those viewers latch open over the board, the modal swallowed the hovers four specs were about. Fixed at the source (3 new `*_window_plain` keys in all 9 locales, `infoWindowTitle()`), the fixtures now name their group, and the hover specs dismiss it through a new `dismissInfoWindows()` helper. `mechanics.spec.ts` went from a 120 s timeout to 8.7 s |

### 4.6c Web client payload (2026-09-28)

| What | Why |
|---|---|
| RESOLVED — the nine locales were statically imported | 1.15 MB of source, about half the bundle, for a player who reads one of them. English stays eager (it is the `t()` fallback, so the app is never without strings); the other eight are their own ~35 KB gzip chunks, fetched on demand and re-rendered when they land. Entry chunk **2.36 MB → 1.43 MB raw, 682 KB → 395 KB gzip (-42 %)**. `setLanguage` paints the new language immediately and the chunk follows, so a test has to await: `useLanguage()` switches and resolves once the strings are in |
| RESOLVED — the coverage gate listed two files that do not exist and left `src/board/` out | It measured 721 instrumented lines of ~80 000 and reported "87 % lines" on the dashboard. The scope is now `net`, `state`, `board`, `cards/cardImages`, `game/feedback` and `infoWindowState`: **4 952 lines** at 85 % / 75 % branches, with thresholds lowered to match reality rather than propped up |
| RESOLVED — three unused `@dnd-kit` production dependencies | 2.2 MB of `npm install` and CI cache for a library nothing imports |
| RESOLVED — the frame buffer kept up to 3.8 MB of whole frames in production | `recordFrame` is **not** a dev tool: it feeds the "Export diagnostics" bundle players send with bug reports, so it was bounded rather than gated — 8 KB per frame in a shipped build (the prompts and results are what a report needs), 64 KB in dev |

### 4.6d The other proxy thread leak: one pool per session (2026-09-28)

Found while chasing a flaky `verify-player-leave`, and independent from it. jboss-remoting 2.5.4
creates a oneway thread pool per remoting connection and never stops it: `Client.disconnect()`,
`ServerInvoker.stop()` and `ServerInvoker.destroy()` do not touch it, and the pool is orphaned
anyway because `Client.getOnewayThreadPool()` asks for 10 threads on an executor built `4/4` and
`BasicThreadPool.setMaximumPoolSize` sets the core size before the maximum (`IllegalArgumentException`
before the pool is stored). The proxy makes it visible because it creates one `SessionImpl` per
browser session **and one per SIM seat**: 12 pools / 48 threads after a single four-player game,
105 pools / 420 parked threads after ~100 sessions, which is what made long-lived stacks slow enough
for games to stop producing views.

| What | Why |
|---|---|
| RESOLVED — the pool is no longer per session | **One file, additive**: the fork's `CustomThreadPool` (the class jboss instantiates from the `onewayThreadPool` locator parameter, used by the callback server's `ServerInvoker`) now delegates every instance to one shared pool. Measured 48 -> 0 leaked threads, proxy total 143 -> 61. Nothing else in the fork depends on it, so an upstream merge that fixes the leak just drops this file's diff |
| RESOLVED — `Client.getOnewayThreadPool()` also leaked, before it was ever reached | An earlier attempt stopped the *client's* pool on disconnect, which required asking for a size `BasicThreadPool` accepts (`setMaximumPoolSize` sets the core size before the max, so 10 on a 4/4 executor throws). Reverting `SessionImpl` and keeping only the shared `CustomThreadPool` measured the same 0 threads and no `IllegalArgumentException`, so the patch stayed at one file |
| RESOLVED — `dev.mjs restart` started the new proxy while the old still held the port | A fixed 1.5 s sleep instead of waiting: the new WebSocket server failed to bind (`BindException`) but the process stayed up answering HTTP and reporting `/ready`, so every script failed differently. It now waits for the ports to go down, and a bind failure is fatal in `Gateway.onError` instead of a half-alive proxy |
| RESOLVED — `verify-player-leave` was flaky (still is a *sensitive* script, but no longer red) | Two separate causes: it logged no `disconnect` (fixed: every verify script logs out, `created=21 disposed=0` -> `created=47 disposed=46`), and its "no views in 20 s" watchdog called a healthy game frozen in a four-player lands-only FFA where the engine legitimately pushes nothing when the board does not change (the server itself only warns at 30 s). The pre-concede liveness precondition is gone and the script now runs **second** in the `verify` layer, before the scripts that hammer the server |

### 4.7 Connection resilience follow-ups

The 2026-09-26 freeze/reconnect work is done: short drops, proxy restarts, out-of-order callbacks, the login race, the WebSocket deadlock, the proxy re-logging in by itself after losing the XMage server (`serverLink` banner instead of the login screen), a visible retry of the automatic re-login, the restore id on re-login, the resumable `seq` stream, the prompt cache kept until the answer, SIM seats across restarts, the short grace period for a closed tab (`leaving`, 45 s), the slower lobby poll during a game and the cheaper `recordFrame` (guarded by `scripts/verify-reconnect.mjs`, `OutboundLogTest`, `ReplayCacheTest`, `SimRosterTest`, `ProxyClientStreamTest`, `CallbackSequencerTest`, `GatewayCompressionTest`, `gateway-resilience.test.ts`). What is left:

| What | Why |
|---|---|
| RESOLVED 2026-10-06 — persist the resume token (`streamId`, `seq`) across a page reload | `pagehide` saves it per tab in `sessionStorage` (same proxy + account, 10 min max), the re-login after the reload presents it once and the proxy replays the frames of the gap; the page still rejoins for the board + prompt it lost. Logout forgets it. Guarded by `persistence.test.ts`, `gateway-connect.test.ts`, `Gateway.test.ts` and `e2e/reconnect-real.spec.ts` (reload mid-game → `resumed: true`) |
| RESOLVED 2026-09-28 — the restore id survives a proxy restart only for the same address (in memory) | `RestoreIds` now persists the per-account session id (`--restoreIds`, default `<tmpdir>/mage-proxy-restore-<wsPort>.json`, ignored after 10 min); a re-login after an IP change **and** a restart presents it and the server hands the old session over |

### 4.8 View fields the UI reads but the server never sends (2026-10-06)

Found while removing `any` from the web client: the contract schema (`web/schema/contract.schema.json`) is the authority on what a view carries, and these reads went through casts.

| What | Why |
|---|---|
| RESOLVED 2026-10-06 — commander tax was always +0 in a real game | `CommandZone` / `CommanderDamageMatrix` read `castCount`, which is in no view. No view field or proxy change was needed: the engine's `CommanderInfoWatcher` already writes the count into the commander's `rules` (`<b>Commander</b> 2 times played from the command zone.`, omitted at zero), upstream code, so beta sends it too. `commanderPlaysCount` parses it; fixtures and tests now carry that rule (`commanderInfoRule`) instead of the invented field, and `commanders.test.ts` checks the recorded `commander-zone` / `commander-4` frames (2 and 1 plays) |
| RESOLVED 2026-10-06 — copies on the stack were only recognised by name | The `[Copia N]` / `[Copy` names only ever existed in fixtures; the server sends the card's own name. For a spell, `CardView.originalIsCopy` is `Spell.isCopy()` (`setOriginalValues` runs on `SpellAbility.getCharacteristics`, which returns the stack `Spell` itself; upstream code, not a fork patch), so `isCopyCard` reads it and the storm fixture marks its copies that way |
| RESOLVED — two views of different games were diffed into animations | `useGameTransitions` compared `GameView.gameId`/`matchId`, which a `GameView` does not carry, so the guard never fired; it now takes the store's `gameId`, recorded with the view it came with (`START_GAME` switches the id before the new game's first view) |

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