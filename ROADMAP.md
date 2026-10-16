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
| | VFX & Animations (Spell cast arcs, screen shake, damage) | ❌ No | ✅ Yes (donut color pie, bars, shake, floating damage, spell-weight slam, hit sparks, destroy/exile/token deaths, low-life vignette, foil + tilt preview, playmats, cinematic end screen) | Completed (Surpasses Swing) |
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

Dropped on purpose (2026-10-07, data does not reach the client): the response window, the blocked-action explainer and the layer / derived P-T inspector. Reopening any of them needs a fork change that puts the missing data on the wire (a per-player playable list, effect sources). Reasons: `docs/history/roadmap-resolved-2026-10.md` §4.2.

### 4.3b Board legibility

| Open item | Why it is not a toggle |
|---|---|
| See the rules text of every permanent in play without hovering | Legible text for 8+ permanents does not fit one screen. Options: bigger cards with band panning, a one-line rules strip under compact tiles, or a persistent inspector |

### 4.4 Test-infrastructure risk

- The nightly real-mode job covers 5 of 312 specs plus the `verify` layer; a ~15-spec protocol-sensitive set would shrink drift risk.
- `verify` scripts are order-sensitive (`verify-player-leave` is the most sensitive and runs second); isolating each with a fresh proxy would remove that class of flake.
- Replay files exist (§4.2); loading one in the GitHub Pages demo is still open.
- Mobile layout: the full board stays desktop-only on purpose. Since 2026-10-15 a phone-width window (≤ 600 px) has a compact spectator view (`game/MobileSpectator.tsx`: scoreboard, turn/phase, stack, feed and chat, "Full board" button), the lobby and chat already fit, and dialogs no longer overflow (`ui/DialogShell.css` caps the panel at the window minus the backdrop padding; the create-table wizard hides inactive step labels and stacks its type cards). Guard: `e2e/mobile.spec.ts` at 390 px (verified red with the dialog fix removed). The draft header fits since the same day (same guard, verified red without its CSS). Still open: playing a seat on a phone and the deck builder editor at 390 px.

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
| Tour copy is English only | `DemoTour.tsx` hard-codes its strings; the rest of the client has 9 locales |
| EDHREC is frozen for one commander | `demoEdhrecPage` only answers `krenko-mob-boss`; card search and EDHREC resolution still call Scryfall live |
| Roster and tables are invented | `src/demo/data.ts`. The ranking carries a "sample data" note since 2026-10-15 (`leaderboard-demo-note`, checked by `verify-demo.mjs`); the lobby table list does not |
| Not a layer on the status dashboard | `verify-demo.mjs` fails the Pages run but `status.json` has no row for it |
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