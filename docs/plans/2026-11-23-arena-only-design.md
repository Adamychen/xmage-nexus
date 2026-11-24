# One game layout: Arena (design)

## Intent

The game screen has grown three layouts (Standard, Arena, Table) on two chromes (v1, v2), each
multiplied by the main-board setting and three hand modes. Every board change has to be made and
tested several times, and the layouts drift (the BRD-32…40 Arena rules only hold "with the v1
chrome", so Arena and Table already look different). The user wants **one layout: Arena**, with
the **Main board with side panel** switch (`boardSpotlight`, BRD-6) as its only variant. Everything
else is removed, not hidden.

**North star (user, 2026-11-23): the game screen should be as close to MTG Arena as possible**,
mechanics included. Every later step, and every judgement call inside this one, leans toward what
MTGA does. Where MTGA has nothing to copy (it has no chat and no game log; XMage needs both), the
piece stays out of sight until asked for, which is why chat/log is a closed-by-default overlay.

This is step 1: one layout to iterate on. Later steps, each its own design, out of scope here:
2. Commander damage received as a dropdown under each player's life (user sketch: life, a chevron,
   then per opponent the player, the commander and the damage).
3. Mechanics as MTGA-style badges on the side of the board (designations, day/night, monarch,
   initiative, dungeon, emblems…), replacing the toolbar button.
4. Further MTGA alignment of the chrome (to be scoped after 1-3).

## Goals

- One board path: `ArenaBoard` (columns) or `SpotlightBoard` (main board + side panel), always.
- One chrome: the v1 Arena chrome (strip with the turn-order ring, action button bottom-right).
- Chat and log reachable in game without shrinking the board.
- Duels, pods and spectators all land on Arena.

## Non-goals

- Commander damage under the life total (step 2). Until then it stays where the v1 drawer has it.
- Mechanics badges (later). The mechanics stay a toolbar button with its dropdown.
- Redesigning the Arena board itself (BRD-32…40 stay as they are, minus their "v1 chrome" clause).

## Anti-goals

- A hidden v2 / Standard path kept "just in case": the point is one code path and one test set.
- A chat/log panel that pushes or squeezes the board (the v2 left panel took 372 px, and with the
  side panel on the right the main board was squeezed from both sides).

## Approaches

1. **Delete Standard and v2 (chosen by the user).** Remove `gameUi`, `boardLayout`,
   `boardLayoutManual`, `GameBoard`, `OpponentSwitcherBar`, the v2 top bar / dial / left side panel
   and every `v2` branch (29 files incl. CSS and e2e). Stored settings migrate on load.
2. Keep v2 and Standard off but in the code. Rejected: every Arena change would still have to
   respect branches nobody sees.

## Decisions

### Removed
- **Standard layout**: `board/GameBoard.tsx`, `board/OpponentSwitcherBar.*`, `board/boardLayout.ts`
  (`resolveBoardLayout`/`effectiveBoardLayout`), the layout picker in Settings → Board → Layout and
  `settings/boardLayoutChoice.ts`.
- **v2 chrome ("Table")**: `gameUi` setting and `game/gameUi.ts`, `GameTopBar`, `PhaseDial` (as the
  dock action), the left `SidePanel` and `--chrome-l`, `useOverlayGutters` for v2, the
  `game--v2` / `data-ui="v2"` CSS, `PortraitBoard.css` if only v2 uses it, the v2 branches in
  `BoardZone`, `SpotlightBoard`, `TurnOrderRing`, `PlayerInfoBar`, gallery fixtures.
- **Deck tracker tab** (`DeckTrackerPanel`, `deckTracker.ts`, `useDeckCardMeta` if unused after),
  and PNL-5/PNL-6.
- Settings: `gameUi`, `boardLayout`, `boardLayoutManual` are dropped from `AppearanceSettings`;
  stored values are ignored on load (`normalize*` drops them). Nothing else migrates: the user's
  `boardSpotlight` stays as it was.

### Kept from v2
- **LogTicker** (last action in one line) and **CombatLedger** (only during combat), now under the
  v1 chrome.

### Chat and log (builder's call, approved as proposal)
- A panel that floats over the left edge of the board (a layer, like the stack, STK-2), never
  resizing it. Tabs: Log, Chat. Opened from two strip buttons that replace the drawer's Log and
  Chat toggles; chat keeps its unread dot. Closes with its button, Esc, or the same toggle.
- While it is open the LogTicker hides (same as v2 with the log tab open).
- Commander and Mechanics stay as strip toggles with their current dropdown until steps 2/3.

### Layout resolution
- Every game uses Arena. A duel with the switch off draws one opponent column across the whole
  top half. This combination never shipped (`resolveBoardLayout` sent duels to Standard), so it
  needs its own check at 1920/1366/390 px and a test; with the switch on it already exists (BRD-6).
- **Five or more players**: Standard was the only board that seated them. Arena columns cap at
  `MAX_BOARD_PLAYERS` (4). Decision: at 5+ players the main-board mode is forced on (its panel
  scrolls vertically, BRD-6), whatever the switch says; the setting's hint says so.
- Spectators: same rules (BRD-6 spectator branch); `MobileSpectator` on phones is unchanged.
- Phone width (≤600 px): Arena's existing phone arrangement (BRD-32/33/34/36 phone clauses).

### Specs and docs
- `docs/specs/board.md`: drop "v1 chrome" / "Standard" / "Table" clauses; rewrite the intro and
  BRD-6 (no layout preference, 5+ forces the panel); delete rules that only describe Standard or
  v2 (BRD-15: the own emblems/planes/dungeons already sit in the Arena bottom row, BRD-39). BRD-29
  stays: the v1 action button is the one that survives. BRD-37's Standard history stays in its Why.
- `docs/specs/hand.md` HND-7: drop "while the side panel is open" (v2 panel). `panel.md`: drop
  PNL-5/6, describe the floating chat/log panel. `settings.md` SET-7 preview.
- `web/INTERACTION_COVERAGE.md`, `site/content.json`, `ROADMAP.md` §4 (remove 4.3c and any v2/Standard items).
- Specs whose tests are deleted: retire the rule ids so `specCoverage.test.ts` stays green.

## Left to the builder
- Whether HandRail (column) and HandRow still fit on the Arena board; they are kept. If one breaks
  the Arena bottom row (BRD-32), report it rather than silently dropping the mode.
- Exact pixel size of the floating chat/log panel (follow the old drawer width; measure, no fixed
  pixel budget in tests — AGENTS.md).
- Which e2e specs are deleted vs. rewritten: `game-ui-v2*.spec.ts`, `zone-icons-v2.spec.ts` are
  deleted where they only test v2; the rest (`spotlight`, `seat-focus`, `kind-bands`,
  `land-fan`, `phone-fit`, `mobile-layout`, `game-chrome-phone`, `action-bar-waiting`,
  `board-item-model`) drop their `gameUi` setup. `e2e/fixtures.ts` stops seeding `gameUi`.
- Done = unit + typecheck + build + full fake e2e green, then CI `ci-ok`.
