# One game layout: Arena — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Every game is drawn on the Arena board with the v1 chrome; Standard, Table/v2 and the deck tracker are deleted; chat and log move to a floating left panel.

**Architecture:** `GameScreen` stops resolving a layout: it always renders `ArenaBoard`, or `SpotlightBoard` when the main-board mode is on (or forced at 5+ players). The v2 chrome branches are deleted, `LogTicker` and `CombatLedger` render under the v1 chrome, and a new `ChatLogPanel` replaces the drawer's Log/Chat tabs. Settings drop `gameUi`, `boardLayout`, `boardLayoutManual`.

**Tech Stack:** React 19 + TypeScript + Vite, vitest, Playwright (fake backend).

**Spec:** `docs/plans/2026-11-23-arena-only-design.md`

## Global Constraints

- All code, comments, test names, docs in English (AGENTS.md). No code comments unless requested.
- A behaviour change edits its `docs/specs/*.md` rule (and `Why:`) in the same task; retired rule ids lose their tests in the same task so `src/specCoverage.test.ts` stays green.
- Do not commit unless the user asked for commits in this session; "Commit" steps mean "stage and stop" otherwise.
- No pixel budgets in tests: assert contracts ("board not narrower when the panel opens"), not numbers.
- Per task: `npx vitest run <touched tests>` + `npx tsc -b --noEmit` from `web/`. End of plan: `node scripts/test.mjs unit typecheck build i18n e2e`, then CI `ci-ok`.

## Review Focus

1. A duel with the main-board switch **off** (never shipped: duels went to Standard) — one opponent column must fill the top half and the own Arena board (BRD-32) must render, at 1920, 1366 and 390 px. → Task 1 test + Task 5 e2e.
2. 5–6 player games (Standard was their only board) — must force the main-board mode, panel scrolls, nobody missing; also as a spectator. → Task 1 tests.
3. Stored settings from users on `gameUi: 'v2'` / `boardLayout: 'standard'` load without error and land on Arena with their `boardSpotlight` untouched. → Task 4 test.
4. Chat/log panel open while the side panel (main-board mode) is on: the main board must not shrink, the panel must not cover the action button or hand. → Task 3 test.
5. Most fake e2e duel specs ran on Standard (`e2e/fixtures.ts` seeds `gameUi: 'v1'`, default `boardLayout: 'standard'`); they now run on Arena and some selectors will break. → Task 5.

---

### Task 1: Every game is Arena (delete the Standard board)

**Files:**
- Modify: `web/src/board/spotlight.ts:14-21`, `web/src/game/GameScreen.tsx:355-410,533-541`
- Delete: `web/src/board/GameBoard.tsx`, `web/src/board/OpponentSwitcherBar.{tsx,css,test.tsx}`, `web/src/board/boardLayout.ts` (+ its test), `e2e/switcher-order.spec.ts`
- Modify: `web/src/board/BoardShell.tsx` (drop the `'standard'` value of its `layout` prop; keep `BoardLayoutProvider`'s internal fallback engine untouched)
- Test: `web/src/board/spotlight.test.ts`, `web/src/game/GameScreen.test.tsx`, `web/src/board/ArenaBoard.test.tsx`
- Docs: `docs/specs/board.md` intro, BRD-6 (no layout preference; 5+ forces the mode), drop "Standard" mentions in BRD-1…BRD-6

**Interfaces:**
- Produces: `spotlightActive({ enabled, isSpectator, liveOppCount, totalPlayers }: { enabled: boolean; isSpectator: boolean; liveOppCount: number; totalPlayers: number }): boolean` — `arenaLayout` param removed.

- [ ] **Step 1: Failing tests** in `spotlight.test.ts`:
  - `BRD-6 forces the main board at five players even with the switch off`: `spotlightActive({ enabled: false, isSpectator: false, liveOppCount: 4, totalPlayers: 5 })` → `true`.
  - `BRD-6 a duel with the switch off stays in columns`: `({ enabled: false, isSpectator: false, liveOppCount: 1, totalPlayers: 2 })` → `false`.
  - `BRD-6 a spectator of six needs two live players`: `({ enabled: false, isSpectator: true, liveOppCount: 1, totalPlayers: 6 })` → `false`; with `liveOppCount: 2` → `true`.
  - In `GameScreen.test.tsx`: `BRD-6 a duel renders the Arena board` — a 2-player game with default settings renders `.arena-board` and no `[data-testid="game-board"]`.
  - In `ArenaBoard.test.tsx`: `BRD-3 a duel draws its one opponent across the whole row` — one `arena-opp-cell-*`, no focus button.
- [ ] **Step 2:** `npx vitest run src/board/spotlight.test.ts src/game/GameScreen.test.tsx src/board/ArenaBoard.test.tsx` → FAIL.
- [ ] **Step 3:** Implement: `spotlightActive` returns `(enabled || totalPlayers > MAX_BOARD_PLAYERS) && liveOppCount >= (isSpectator ? 2 : 1)`. In `GameScreen`: delete `arenaDuel`, `effectiveLayout`, `isArenaLayout` (treat as always true), `currentOpp`/`selectedOppId`, the `OpponentSwitcherBar` branch of `stripCenter`, and the `GameBoard` branch. `seatPillsClickable = !isSpectator && seatLiveIds.length >= 2` unchanged otherwise. Delete the files listed. Update rule text in `board.md`.
- [ ] **Step 4:** Same vitest command → PASS; `npx tsc -b --noEmit` → clean.
- [ ] **Step 5:** Commit `Every game is drawn on the Arena board`.

### Task 2: One chrome (delete v2 / "Table")

**Files:**
- Modify: `web/src/game/GameScreen.tsx` (remove `v2`, `topBar`, `dockAction` dial branch, `SidePanel`, `chromeLeft/Right`, `--chrome-*` style, `data-ui`, `game--v2`, `useOverlayGutters` call; render `<LogTicker />` and `<CombatLedger />` unconditionally; `ActionButton variant="bar"`, `CombatArrowsOverlay variant="v1"`)
- Modify: `web/src/board/BoardZone.tsx:148`, `TurnOrderRing.tsx:40`, `SpotlightBoard.tsx:269,381`, `game/PlayerInfoBar.tsx:265`, `game/GameDrawer.tsx` (`DrawerBody`: always `CommanderDamageMatrix` and `MechanicsTray`)
- Delete: `game/GameTopBar.*`, `game/PhaseDial.*`, `game/SidePanel.*`, `game/useOverlayGutters.ts`, `game/CommanderSeatMatrix.*`, `game/MechanicsOverview.*`, `board/PortraitBoard.css`, `chromeActions.ts` if unused after; v2-only CSS (`game--v2`, `[data-ui='v2']`) in `GameScreen.css`, `ArenaBoard.css`; `e2e/game-ui-v2.spec.ts`, `e2e/game-ui-v2-flow.spec.ts`, `e2e/zone-icons-v2.spec.ts`; v2 gallery entries in `dev/galleryFixtures.ts` and the `gameUi` override in `GalleryScreen.tsx:173`
- Docs: `board.md` — drop "with the v1 chrome" from BRD-32…40, retire BRD-15; `hand.md` HND-7 drop the side-panel sentence; `panel.md` intro (no v2 panel)

**Interfaces:**
- Consumes: Task 1 (`spotlightActive` without `arenaLayout`).
- Produces: `GameScreen` renders `LogTicker` regardless of settings; Task 3 adds a `hidden` condition.

- [ ] **Step 1: Failing test** in `GameScreen.test.tsx`: `BRD-32 the game screen has one chrome` — with `appearance.gameUi: 'v2'` in stored settings the screen renders `.game-top` (strip) and no `.game--v2`, `[data-testid="side-panel"]`, `.phase-dial`; `LogTicker` and the v1 `ActionButton` are present.
- [ ] **Step 2:** Run it → FAIL.
- [ ] **Step 3:** Delete and simplify as listed; any test that only covered v2 goes with its component; tests that set `gameUi: 'v1'` drop that line.
- [ ] **Step 4:** `npx vitest run` (whole unit suite, the branches are spread) → PASS; `npx tsc -b --noEmit` → clean; `rg "gameUi === 'v2'|game--v2|data-ui" src e2e` → only `persistence.ts`/settings (Task 4).
- [ ] **Step 5:** Commit `The game screen has one chrome`.

### Task 3: Chat and log float over the left edge; the deck tracker goes

**Files:**
- Create: `web/src/game/ChatLogPanel.tsx`, `ChatLogPanel.css`, `ChatLogPanel.test.tsx`
- Modify: `web/src/game/GameDrawer.tsx` (`DrawerTab = 'commander' | 'mechanics'`; new `ChatLogTab = 'log' | 'chat'`; `useDrawerTabs` loses log/chat/tracker), `GameScreen.tsx` (state `chatLogTab: ChatLogTab | null`; strip `right` = chat/log toggles + `DrawerToggles` + `GameMenu`; `<ChatLogPanel>` inside `.board-wrap`; `LogTicker` hidden while `chatLogTab === 'log'`)
- Delete: `game/DeckTrackerPanel.{tsx,css}` + tests, `game/useDeckCardMeta.ts` (keep `deckTracker.ts`: `mulliganEvaluator.ts` uses it), tracker i18n keys
- Test: `e2e/chat.spec.ts`, `e2e/feed-log.spec.ts`, `e2e/chat-overlap.spec.ts` (switch to new test ids)
- Docs: `panel.md` — retire PNL-5, PNL-6; new rule **PNL-10 · Chat and log float over the left edge of the board** (closed by default; opening never resizes the board; two strip buttons; Esc/toggle closes; chat unread dot; Why: the v2 panel took 372 px and squeezed the board against the side panel; MTGA keeps the table clear). `web/INTERACTION_COVERAGE.md` if it lists the tracker.

**Interfaces:**
- Produces: `export type ChatLogTab = 'log' | 'chat'` (GameDrawer.tsx); `ChatLogToggles({ active, onToggle }: { active: ChatLogTab | null; onToggle: (tab: ChatLogTab) => void })` with buttons `data-testid="chatlog-toggle-log|chat"` and the unread badge `data-testid="chat-unread"`; `ChatLogPanel({ tab, onTabChange, onClose }: { tab: ChatLogTab; onTabChange: (t: ChatLogTab) => void; onClose: () => void })`, root `<aside data-testid="chatlog-panel" data-tab>` with `role="tablist"` tabs and bodies `ActionFeed` / `GameChat`.

- [ ] **Step 1: Failing tests** in `ChatLogPanel.test.tsx`:
  - `PNL-10 the panel shows the log or the chat` — `tab="log"` renders the ActionFeed; clicking the Chat tab calls `onTabChange('chat')`.
  - `PNL-10 Escape closes the panel` — keydown Escape calls `onClose` once.
  - `PNL-10 the chat toggle counts unread messages while closed` — via `ChatLogToggles`, adding a chat log entry with `active=null` shows `chat-unread` = `1`; with `active='chat'` it is absent.
  - In `GameScreen.test.tsx`: `PNL-10 opening the panel never resizes the board` — the `.board-wrap` inline style / class set is identical before and after clicking `chatlog-toggle-log`; the ticker is gone while the log tab is open; no `drawer-tab-tracker` exists.
- [ ] **Step 2:** Run → FAIL.
- [ ] **Step 3:** Implement. Panel is `position: absolute` inside `.board-wrap`, left edge, top below the strip, bottom above the hand reserve (`--hand-reserve` / dock offset already measured by `useDockOffset`), width = the old drawer width token, `z-index` below dialogs and above the board, like `StackZone`.
- [ ] **Step 4:** vitest on the touched files → PASS; `npx tsc -b --noEmit`; `npx playwright test e2e/chat.spec.ts e2e/feed-log.spec.ts e2e/chat-overlap.spec.ts` (fake) → PASS. Screenshot one game with the panel open and the side panel on, and look at it (Review Focus 4).
- [ ] **Step 5:** Commit `Chat and log float over the board's left edge`.

### Task 4: Settings lose the layout and the interface

**Files:**
- Modify: `web/src/state/persistence.ts:878-933` (drop `BoardLayoutPref`, `VALID_LAYOUTS`, `RETIRED_LAYOUTS`, `boardLayout`, `boardLayoutManual`, `gameUi`; `applyAppearanceToDocument` loses `boardLayout`), `state/slices/settings.ts:10,64,98`, `state/actions.ts:432-440`, `App.tsx:128-129`, `system/diagnostics.ts`, `settings/sections.tsx` (delete `LAYOUTS`, the picker at ~272 and the `LayoutDemo` group at ~496; the main-board switch hint mentions 5+ players), `settings/SettingsModal.tsx:9,34`, `settings/settingsIndex.ts` (layout entries)
- Delete: `settings/boardLayoutChoice.ts`, `settings/LayoutDemo.{tsx,css}` + tests, `game/gameUi.ts`; i18n keys `board_standard*`, `board_arena*`, `board_table*` in every locale
- Modify: `web/e2e/fixtures.ts:27` (stop seeding `gameUi`), `dev/galleryFixtures.ts` (`gameUi` field and type)
- Test: `web/src/state/persistence.test.ts`
- Docs: `settings.md` SET-7 (preview no longer shows a layout picker)

**Interfaces:**
- Consumes: nothing reads `settings.gameUi` / `settings.boardLayout` after Tasks 1–2.

- [ ] **Step 1: Failing test** `BRD-6 stored layout and interface choices are dropped on load`: `localStorage['mage-web-appearance'] = {"gameUi":"v2","boardLayout":"standard","boardLayoutManual":true,"boardSpotlight":true}` → loaded settings have no `gameUi`/`boardLayout`/`boardLayoutManual` keys and `boardSpotlight === true`; a second case with `boardSpotlight` absent → `false`.
- [ ] **Step 2:** Run → FAIL.
- [ ] **Step 3:** Remove the fields and their consumers listed above.
- [ ] **Step 4:** `npx vitest run` → PASS; `npx tsc -b --noEmit`; `node ../scripts/test.mjs i18n` → PASS; `rg "gameUi|boardLayout" src e2e` → no hits outside `solveBoardLayout`/`BoardLayoutProvider` internals.
- [ ] **Step 5:** Commit `Settings no longer pick a layout or an interface`.

### Task 5: The fake e2e suite and the docs run on Arena

**Files:**
- Modify: every spec under `web/e2e/` that broke because a duel is now Arena (expected: `commander-turn-mark`, `turn-lane`, `recorded`, `board-item-model`, `land-fan`, `kind-bands`, `action-bar-waiting`, `zoom`, `cjk`, `mobile-layout`, `game-chrome-phone`, `phone-fit`, `seat-focus`, `spotlight`, `e2e/support/board-geometry.ts`)
- Create: `web/e2e/arena-duel.spec.ts`
- Docs: `site/content.json` (feature matrix: one layout), `ROADMAP.md` §4 (remove 4.3c and Standard/v2 items; add steps 2–3 of the design as pending), `web/INTERACTION_COVERAGE.md`, `docs/lessons.md` only if a durable lesson came up

- [ ] **Step 1:** `arena-duel.spec.ts`, tagged `@board`, `quickStartGame` duel, switch off, at viewports 1920×1080, 1366×768, 390×844: `BRD-6 a duel with the switch off is the Arena board` — `.arena-board` visible, exactly one `[data-testid^="arena-opp-cell-"]`, the own hand and the action button visible, no `pageErrors`, no visible card clipped by the viewport (contract, no pixel numbers).
- [ ] **Step 2:** `node ../scripts/test.mjs e2e` (from repo root: `node scripts/test.mjs e2e`) → note failures.
- [ ] **Step 3:** Fix each failing spec by moving it to Arena selectors (`arena-opp-cell-*`, turn-order pills instead of the switcher). A failure that shows a real Arena bug is fixed in product code with a unit test, not by loosening the spec. Read each failure screenshot first (AGENTS.md: latched viewers cause unrelated-looking timeouts).
- [ ] **Step 4:** `node scripts/test.mjs unit typecheck build i18n e2e` → all green; screenshots of a duel and a 4-player pod in both modes, looked at.
- [ ] **Step 5:** Commit `The e2e suite runs on the Arena board`; after push, `gh run list -R Adamychen/xmage-nexus -L 5` → `ci-ok` green.
