# Project Roadmap: XMage Nexus

> **A Modern, Web-Based Digital Card Game Client for XMage**  
> *Last updated: 2026-09-23*

---

## 1. Vision & Architectural Philosophy

The goal of **XMage Nexus** is to deliver a fast, modern, and beautiful web client with an **Arena-grade aesthetic** (hardware-accelerated DOM/CSS animations, animated targeting, sound, smooth interaction) while leveraging the battle-tested, 10-year **XMage Java server** (`Mage.Server`) as the authoritative rules engine, card database (+25,000 cards), and multiplayer matchmaking backend.

### The 3-Tier Architecture
```
┌─────────────────────────┐          WebSocket JSON          ┌──────────────────────────┐      JBoss / TCP      ┌─────────────────────────┐
│  XMage Nexus Web Client │ ◄──────────────────────────────► │        Mage.Proxy        │ ◄───────────────────► │      XMage Server       │
│  (React 19 + Vite)      │   (Type-safe protocol schema)    │  (Java 17 / MageClient)  │   (Native protocol)   │  (1.4.61-V1 / Official) │
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
| **Phase 0: Proxy Bridge** | Java 17 proxy (`Mage.Proxy`), WebSocket gateway, cycle-safe JSON serializer. | ✅ **Completed** | Connect + real game flow works against `beta.xmage.today:17171` AND local `localhost:17171` (same 1.4.61-V1 fork). NOTE (corrected 2026-09-20): beta's anonymous login is **stable** (17/17 measured). The former "intermittently fatal handshake" was a misdiagnosis — `Can't receive server state before other data` is logged on *any* failed login (the client fetches the server state only after login succeeds), and the real cause was generated usernames exceeding `maxUserNameLength` (**14**). CI's real-protocol oracle stays the local server for determinism. The proxy is now **multi-tenant** (one process serves many independent users), which already enables zero-install server-side play today (see `AGENTS.md`). |
| **Phase 1: Web Foundation** | React 19 + TS + Vite. Lobby, room chat, real-time tables/users, Scryfall HD card cache (IndexedDB), full 1v1 board rendering & spectator mode. | ✅ **Completed** | 100% typecheck clean, live AI vs AI spectator matches working end-to-end. |
| **Phase 2: Interaction Engine** | London mulligan, priority loops (`GAME_SELECT`), visual targeting (animated dotted lines & pulsing glows), mana tapping & pool payment (`sendPlayerManaType`), floating non-blocking combat UI (attack/block & alpha strike), advanced spell interactions (X-costs, multi-target, modal choices, +1/+1 counters). | ✅ **Completed** | Validated via `human-test.mjs` (83 checks PASS) and Playwright E2E suites (*Blaze*, *Arc Trail*, *Boros Charm*, *Walking Ballista*). |
| **Quality & QA Foundation** | 1,900+ unit tests (vitest, ~13 s), Java→TS JSON Schema codegen (`gen-types.mjs`), dual-mode Playwright E2E (deterministic FakeServer + Real XMage Stack with `SimPlayer` bots). | ✅ **Completed** | Zero-flake local iteration loop + continuous anti-drift contract testing (3 guards: `callbackCoverage`, `mechanicsCoverage` server→client, `engineViewCoverage` engine→view). |
| **Phase 2.5: 1v1 Competitive Parity** | Match Chess Clocks (+buffer `F4`/`F9`), DFC/MDFC back-face + Saga `lore`, HD `CardGrid` para selección de cartas (tutores, scry/surveil, reveal de mano), **descarte interactivo desde reveal de mano** (Thoughtseize: `GAME_CHOOSE_CARDS`/`GAME_SELECT_TARGETS` con la mano ajena como `cardsView1` → `CardGrid` → `sendPlayerUUID`), **sideboard Bo3/Bo5** (`SIDEBOARD` → `SideboardScreen`) y **orden de asignación multi-bloqueador** (`GAME_GET_MULTI_AMOUNT`). Phase stops F4/F9 (ya completados en F2). | ✅ **Completed** | `e2e/reveal.spec.ts` (`@reveal`), `best-of-3.spec.ts`/`best-of-5.spec.ts`, `combat-multiblock.spec.ts`, `FeedbackDialog.test.tsx`, `PlayerInfoBar.test.tsx`, `INTERACTION_COVERAGE.md` actualizado. |
| **Phase 3: Visual Polish, Audio & Deck Builder** | Web Audio engine (15 sfx, 3 buses), VFX (floating damage, shake, mana donut), in-app deck builder (Scryfall full syntax, curve, sample hand, Arena/DCK/Plain import/export), card sleeves and avatars, design system (tokens, primitives, style ratchet). | ✅ **Completed** (selectable playmats delivered 2026-09-23) | Visual-regression gallery (`#/gallery`, 3 resolutions × chromium + webkit) and the gallery/recorded E2E specs. |
| **Phase 4: Desktop Packaging (Tauri)** | Tauri launcher with embedded proxy + trimmed JRE, signed auto-updater. | ✅ **Published** (v0.1.0 2026-09-10, v0.2.0 2026-09-19, v0.2.1 2026-09-22, v0.2.2 2026-09-22, v0.2.3 2026-09-22) | `release.yml`, signed bundles + `latest.json`. Clean-machine validation still open (§4.1 V7). |
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
| | Text / Arena / Standard Deck Import & Export | ✅ Yes | ✅ Yes (Arena/DCK/Plain + clipboard, file drop, 9-lang normalization) | Completed |
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

### 4.1 Needs people or clean machines (not automatable)

| # | Source | What | Note |
|---|---|---|---|
| V5 | `docs/history/plan5.md` / `plan4.md` §5.2 | Third live heuristic evaluator (keyboard + opponent view) | 2 of 3 done |
| V6 | `plan5.md` / `plan4.md` §5.3, §5.5, §5.6 | 5-second test, rounds with real players, dogfooding | — |
| V7 | `plan5.md` / `plan4.md` §6 | Install on clean Win / macOS / Ubuntu (SmartScreen / Gatekeeper) and end-to-end updater | The blockers noted earlier no longer apply: v0.2.0 ships `darwin-aarch64` and signed `.sig` bundles with `latest.json` |

### 4.2 Product ideas not built yet

Full spec and rationale per idea: `docs/enhancements.md`. Already built from that catalog: deck tracker (1.1), invite links (2.1), London-mulligan evaluator (1.4), sample-hand simulator (part of 4.3), the printing selector in the deck editor (part of 5.2) and selectable playmats (5.1, 2026-09-23).

| Idea | Impact / effort | State |
|---|---|---|
| Tactical pings on the board (Commander / 4P) | Very high / ~2 d | Not started |
| EDHREC suggestions in the deck builder | High / ~1-2 d | Not started (only the Scryfall `edhrec` sort exists) |
| Touch gestures / iPad ergonomics | Very high / ~4-5 d | Not started (only an audio unlock on `touchstart`) |
| PWA (manifest + service worker) | High / small | Not started |
| Lethal calculator and life-history graph | Medium / 1-2 d each | Not started (`CommanderDamageMatrix` is a different feature; see the combat-preview and life-history rows below) |
| Streaming overlay, match-recap image, price estimator, extended goldfish, alt-art in game | Lower | Not started |

Ideas added 2026-09-23 (client review focused on `beta.xmage.today`):

| Area | Idea | Impact / effort | State |
|---|---|---|---|
| Game UI | Opponent-turn recap: highlight new/changed/died permanents when priority returns + one-line summary ("played X, attacked with Y, you lost 4") | Very high / ~1-2 d | Done 2026-09-23 (non-blocking strip at my turn start: summary + departed-card chips by destination; NEW/CHANGED marks on the board) |
| Game UI | Smart stops (Arena-style): only stop when the server reports something playable | High / ~1 d | Done 2026-09-23 (opt-in toggle, off by default; ignores mana-only `canPlayObjects`; answers each `GAME_SELECT` once; validated against the local server by `e2e/smart-stops-real.spec.ts`) |
| Game UI | Combat preview / lethal warning while declaring attackers (subsumes the lethal calculator above) | High / ~1-2 d | Not started |
| Game UI | P/T tinted vs base (green up / red down), summoning-sickness marker, "entered this turn" glow | Medium / ~1 d | Done 2026-09-23 (per-component tint vs printed value with base in the tooltip; client-tracked entered-this-turn glow; sickness badge already existed) |
| Game UI | Life-history graph inside `ActionFeed`; hovering an entry highlights the card on the board | Medium / ~1-2 d | Not started |
| Game FX | Spell weight impact: high-CMC / mythic spells darken the board, shake and flash in the card's colours | High / ~1 d | Done 2026-09-23 |
| Game FX | Physical combat: impact particles on damage, distinct deaths (destroy = burn, exile = beam of light, token = pop/puff); the attacker lunge already existed | High / ~2 d | Done 2026-09-23 |
| Game FX | Low-life tension: red vignette + heartbeat at ≤ 5 life | Medium / small | Done 2026-09-23 |
| Game FX | Foil shimmer + 3D tilt on the enlarged card preview | Medium / small | Done 2026-09-23 |
| Game FX | Selectable playmats, including animated mats tinted by colour identity (Phase 3 leftover; 7 static + 2 animated mats) | Medium / ~1 d | Done 2026-09-23 |
| Game FX | Dynamic music: ambient layer that intensifies near lethal | Medium / ~1 d | Done 2026-09-23 |
| Game FX | Cinematic victory/defeat screen with match stats (key card, turns, life taken/lost, spells cast, creatures destroyed) | Medium / ~1 d | Done 2026-09-23 |
| Ease of use | "Your turn / response needed" browser notification + title/favicon badge when the tab is hidden | Very high / ~0.5 d | Done 2026-09-23 (toggle in Settings → Gameplay; permission asked on the first in-game click) |
| Ease of use | Highlight lobby tables joinable with one of your legal decks | Medium / ~1 d | Not started |
| Ease of use | First-game onboarding overlay (4-5 steps) + `?` shortcut cheat-sheet | Medium / ~1 d | Not started |
| Ease of use | Explicit waiting state ("Waiting for X — thinking 0:23") | Medium / small | Done 2026-09-23 (action button names the actual priority holder, thinking clock + priority timer countdown, warn tint after 60 s) |
| Ease of use | Smart mana payment: opt-in exact solver taps the sources for the cost being paid and keeps colours open for instants in hand (public information only) | High / ~1 d | Done 2026-09-23 (toggle in Settings → Gameplay and the game menu, off by default; skips Treasure-style sacrifice, restricted mana and convoke; a multi-spell turn scheduler is not built; validated against the local server by `e2e/smart-mana-real.spec.ts`) |
| Attract | Personal match history + per-deck stats (win rate by deck/format/opponent, IndexedDB) | Very high / ~2 d | Done 2026-09-23 ("My stats" sub-tab in the History tab; one record per finished game recorded on `GAME_OVER`, only when the player was seated and a winner is reported; deck name comes from the last equipped deck and format from the lobby table, so both can be missing; capped at 500 records) |
| Attract | Draft pick helper using public 17lands ratings | High / ~2 d | Not started |
| Attract | Featured live games in the lobby (top-ELO games on beta, one-click watch) | Medium / ~1 d | Not started |

### 4.3 UI polish debt

From the 2026-09-21 audit (see the Work Log): spacing literals still to tokenize in `game/` + `board/` (~770, in-game UI), `system/`, `i18n/` and `styles.css` (~45); ~102 inline `style={{}}`; ~91 loose `<button>`; no `Field`/`Input` primitive; lobby list density mode; Construct pool sorting; translated backup labels in Decks. The style ratchet (`ui/styleTokens.test.ts`) keeps the migrated folders from regressing.

### 4.4 Test-infrastructure risk

Remote CI has `retries: 0` and two runs in a row failed on different `e2e-fake` draft tests and on `self-test` `WATCHGAME` (timing under load, cleared by re-running the failed jobs). Open decision: `retries: 1` for CI only in `web/playwright.config.ts`. There is also an occasional unit flake in `store.test.ts` (GAME_OVER autosave, `getLatest` picking another test's log).

### 4.5 Out of scope on purpose

Emblem cards in Create Table (experimental `.dck` feature of the desktop client; decided 2026-09-06).

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