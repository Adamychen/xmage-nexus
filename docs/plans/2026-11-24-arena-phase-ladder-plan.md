# Arena phase ladder Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the top-strip phase bar with an MTG Arena-style ladder of SVG icons above the action button, and add a gallery entry to click through a turn.

**Architecture:** A pure model (`game/phaseLadder.ts`) lists the ladder's steps and decides which one is lit and which turn's stops the row shows. `game/PhaseLadder.tsx` draws it with inline glyphs (`game/PhaseGlyph.tsx`) and edits the shared `phaseStops` setting through `setSetting`. `GameScreen` passes ladder + action button together to `GameDock`; `PhaseBar` is deleted.

**Tech Stack:** React 19 + TypeScript, vitest + Testing Library, Playwright (fake mode).

**Spec:** `docs/plans/2026-11-24-arena-phase-ladder-design.md`

## Global Constraints

- English only in code, tests, docs; translations only in `web/src/i18n/locales/*`.
- No code comments.
- CSS uses tokens from `web/src/ui/tokens.css` (colors, `--r-*`, `--fs-*`, `--sp-*`); `src/ui/styleTokens.test.ts` must not gain new literals.
- Stops are the one `phaseStops` setting (SET-11); the seven stop keys stay `upkeep, draw, main1, beginCombat, endCombat, main2, endStep`.
- Click = toggle the stop of the turn shown; right click = toggle the other turn's stop.
- No text codes (`M1`, `BC`) on the board; names go in `title` / `aria-label`.
- Do not commit unless the user asks.

## Review Focus

- A spectator (no `controlled` player): the ladder shows the step but every icon is inert; clicks change nothing. → Task 2 test.
- A step not on the ladder (`UNTAP`, `''`): nothing lit, no crash. → Task 1 test.
- `FIRST_COMBAT_DAMAGE` and `COMBAT_DAMAGE` both light the damage icon. → Task 1 test.
- A step with no stop key (attackers, blockers, damage, cleanup) lights up but a click sends nothing. → Task 2 test.
- Multiplayer: any opponent's turn shows and edits `opponentTurn` (XMage has one opponent set). → Task 1 test.

---

### Task 1: Ladder model

**Files:**
- Create: `web/src/game/phaseLadder.ts`
- Test: `web/src/game/phaseLadder.test.ts`

**Interfaces:**
- Produces:
  - `type LadderGlyph = 'upkeep' | 'draw' | 'main' | 'beginCombat' | 'attackers' | 'blockers' | 'damage' | 'endCombat' | 'endStep' | 'cleanup'`
  - `interface LadderStep { key: string; glyph: LadderGlyph; big: boolean; group: 'beginning' | 'main1' | 'combat' | 'main2' | 'end'; nameKey: keyof TranslationSchema['game']; stopKey?: string }`
  - `const LADDER: LadderStep[]` — in order: `UPKEEP`(upkeep), `DRAW`(draw), `PRECOMBAT_MAIN`(main, big, `step_main1`), `BEGIN_COMBAT`(beginCombat), `DECLARE_ATTACKERS`(attackers), `DECLARE_BLOCKERS`(blockers), `COMBAT_DAMAGE`(damage, `combat_damage_title`), `END_COMBAT`(endCombat), `POSTCOMBAT_MAIN`(main, big, `step_main2`), `END_TURN`(endStep), `CLEANUP`(cleanup). `nameKey`/`stopKey` copied from `STEPS` in `phaseSteps.ts`.
  - `ladderIndex(step: string | null | undefined): number` — `-1` when not on the ladder; `FIRST_COMBAT_DAMAGE` → index of `COMBAT_DAMAGE`.
  - `shownTurn(game: GameView | null): PhaseTurn | null` — `null` when no player is `controlled` (spectator) or no game; `'yourTurn'` when `activePlayerId` is the controlled player's id, else `'opponentTurn'`.

- [ ] **Step 1: Write the failing tests** — `BRD-62:`-titled tests:
  - `ladderIndex('UNTAP')` and `ladderIndex('')` are `-1`; `ladderIndex('PRECOMBAT_MAIN')` is `2`.
  - `ladderIndex('FIRST_COMBAT_DAMAGE') === ladderIndex('COMBAT_DAMAGE')` and equals `LADDER.findIndex(s => s.glyph === 'damage')`.
  - `LADDER.filter(s => s.stopKey).map(s => s.stopKey)` equals `PHASES.map(p => p.key)` from `phaseStops.ts`.
  - `LADDER.filter(s => s.big).map(s => s.key)` equals `['PRECOMBAT_MAIN', 'POSTCOMBAT_MAIN']`.
  - `shownTurn`: own turn → `'yourTurn'`; a 3-player game where the second opponent is active → `'opponentTurn'`; no controlled player → `null`; `null` game → `null`.
- [ ] **Step 2: Run** `npx --prefix web vitest run src/game/phaseLadder.test.ts` — Expected: FAIL (module not found).
- [ ] **Step 3: Implement** `web/src/game/phaseLadder.ts` per the Interfaces block.
- [ ] **Step 4: Run** the same command — Expected: PASS.

### Task 2: PhaseLadder component, glyphs, rule BRD-62

**Files:**
- Create: `web/src/game/PhaseGlyph.tsx`, `web/src/game/PhaseLadder.tsx`, `web/src/game/PhaseLadder.css`
- Test: `web/src/game/PhaseLadder.test.tsx`
- Modify: `docs/specs/board.md` (new `### BRD-62` after BRD-61)

**Interfaces:**
- Consumes: Task 1 (`LADDER`, `ladderIndex`, `shownTurn`); `togglePhaseStop(stops, turn, key)` from `phaseStops.ts`; `setSetting`, `useStore` from `state/store`; `useSeatColor(playerId)` from `board/seatColor.ts`; `useChangeFlag(step)` from `game/useChangeFlag`.
- Produces: `export default function PhaseLadder({ game }: { game: GameView | null })`; `export function PhaseGlyph({ glyph, size }: { glyph: LadderGlyph; size: number })`.
  DOM contract used by later tasks and e2e: root `div.phase-ladder` with `data-testid="phase-ladder"`, `data-shown-turn="yourTurn|opponentTurn"` (absent for a spectator), CSS var `--ladder-tint` = active player's seat colour; one `button.ladder-step` per step with `data-testid="phase-ladder-step-<KEY>"`, classes `is-past` / `is-current` (+ `is-sweeping` until `animationend`, as `PhaseBar`'s wipe) / `is-big`; `span.ladder-stop-notch` when the shown turn has that stop; `span.ladder-stop-dot` when only the other turn has it; groups wrapped in `span.ladder-group[data-group]`; the combat group draws a bracket.

- [ ] **Step 1: Write the failing tests** (`BRD-62:` titles), rendering with `setState` from `state/state` to seed `settings.phaseStops` as `store.test.ts` does:
  - On the own turn at `BEGIN_COMBAT`: the `BEGIN_COMBAT` button has `is-current`, `UPKEEP` has `is-past`, `END_TURN` neither; root `data-shown-turn="yourTurn"`.
  - Click on `PRECOMBAT_MAIN` during the own turn flips `settings.phaseStops.yourTurn.main1` only; right click flips `opponentTurn.main1` only.
  - During an opponent's turn, a click flips `opponentTurn.main1`; notch/dot follow: with `opponentTurn.main1 = true, yourTurn.main1 = false` the icon has `.ladder-stop-notch`, with the reverse it has `.ladder-stop-dot`.
  - Click on `DECLARE_ATTACKERS` leaves `phaseStops` unchanged (no stop key).
  - Spectator game (no `controlled`): no `data-shown-turn`, every button `disabled`, click leaves `phaseStops` unchanged.
  - Step `UNTAP`: no button has `is-current`.
  - Each button's `aria-label` contains the translated step name; no button's text content contains `M1`.
- [ ] **Step 2: Run** `npx --prefix web vitest run src/game/PhaseLadder.test.tsx` — Expected: FAIL.
- [ ] **Step 3: Implement** `PhaseGlyph.tsx`: one 24×24 `viewBox` inline SVG per glyph, `currentColor`, `aria-hidden`: sunrise (upkeep), card (draw), faceted gem (main), crossed swords (beginCombat/endCombat; endCombat with a closing bar), single sword (attackers), shield (blockers), burst (damage), crescent moon (endStep), sweep/broom arc (cleanup).
- [ ] **Step 4: Implement** `PhaseLadder.tsx` + `PhaseLadder.css`: big icons ~1.6× small, row right-aligned to the action button's width, `--ladder-tint` on the current icon's glow and the notch, past steps dimmed, a sweep keyframe on `is-current.is-sweeping`. `title`/`aria-label`: `"<step name> — <stop on: you|opponent>"` using existing `game` keys (`you`, `opponent`, `common.yes/no`). At ≤600 px hide non-big, non-current small steps.
- [ ] **Step 5: Write BRD-62** in `docs/specs/board.md`: "The phase ladder sits above the action button" — placement, icons only, current step lit in the active seat's colour, click = shown turn's stop, right click = other turn, notch vs dot, spectator inert, no phase strip in the top bar. `Why:` user request 24-nov-2026 (Arena north star). `Guard:` `src/game/phaseLadder.test.ts` · `src/game/PhaseLadder.test.tsx` · `e2e/phase-stops.spec.ts`.
- [ ] **Step 6: Run** `npx --prefix web vitest run src/game/PhaseLadder.test.tsx src/game/phaseLadder.test.ts src/ui/styleTokens.test.ts` — Expected: ladder tests PASS; styleTokens fails only with its pre-existing `CardSlot.css` / `handCommander.css` entries, nothing for `PhaseLadder.css`.

### Task 3: Ladder on the board, strip removed

**Files:**
- Modify: `web/src/game/GameScreen.tsx:367-378` (strip), `:406-416` (action), `web/src/game/GameDock.css`
- Create: `web/src/game/PhaseName.tsx` (moved verbatim from `PhaseBar.tsx`)
- Modify: `web/src/game/MobileSpectator.tsx:12`, `web/src/game/RewindBar.tsx:6` (import from `./PhaseName`)
- Delete: `web/src/game/PhaseBar.tsx`, `PhaseBar.css`, `PhaseBar.test.tsx`; `usePhaseStopToggles` and `STEP_GROUPS` from `phaseSteps.ts` if no importer is left (grep)
- Modify: `web/src/board/CombatArrowsOverlay.test.tsx:333` (drop `../game/PhaseBar.css`, add `../game/PhaseLadder.css` if the list is of chrome stylesheets)
- Modify: `web/e2e/phase-stops.spec.ts`, `web/e2e/priority-stop-real.spec.ts`
- Modify: `docs/specs/settings.md` SET-11 ("the phase bar, the phase dial and the ⋯ menu" → "the phase ladder and the ⋯ menu")

**Interfaces:**
- Consumes: Task 2 `PhaseLadder` and its DOM contract.
- Produces: `GameDock`'s `action` is `<div className="game-dock-action" data-testid="game-dock-action"><PhaseLadder game={game} /><ActionButton …/></div>`; the strip's `left` keeps only the turn counter.

- [ ] **Step 1: Update e2e first.** `phase-stops.spec.ts` SET-11 test: use `phase-ladder-step-PRECOMBAT_MAIN`; the scenario starts on the own turn, so assert `data-shown-turn="yourTurn"` then replace `.stop-dot-you` with `.ladder-stop-notch`. Rejoin test: locator `[data-testid="phase-ladder"]`, stop count via `.ladder-stop-notch, .ladder-stop-dot`. Add test `BRD-62: the top strip has no phase bar and the ladder sits above the action button` — `.phase-bar` count 0, and the ladder's bounding box bottom ≤ the `.big-action-btn` top and horizontally overlaps it. `priority-stop-real.spec.ts`: read `data-shown-turn` once and click each `phase-ladder-step-<KEY>` with `button: 'left'` for the shown turn and `'right'` for the other, preserving the final stops it asserts.
- [ ] **Step 2: Run** `cd web && npx playwright test e2e/phase-stops.spec.ts` — Expected: FAIL (no ladder on the board).
- [ ] **Step 3: Implement** the GameScreen/GameDock changes, move `PhaseName`, delete `PhaseBar*`, update SET-11.
- [ ] **Step 4: Run** `npx --prefix web vitest run && npx --prefix web tsc -b --noEmit` — Expected: all pass except the pre-existing `styleTokens` failure; specCoverage green.
- [ ] **Step 5: Run** `cd web && npx playwright test e2e/phase-stops.spec.ts e2e/action-bar-waiting.spec.ts e2e/spotlight.spec.ts e2e/mechanics.spec.ts` — Expected: PASS (BRD-29's waiting pill keeps its geometry with the ladder above it).

### Task 4: Gallery walk-through

**Files:**
- Modify: `web/src/dev/galleryFixtures.ts` (new entry next to the board entries)
- Test: `web/src/dev/galleryFixtures.test.ts`

**Interfaces:**
- Consumes: `LADDER` (Task 1), `GalleryAction.apply(game) => game`.
- Produces: `export function nextLadderStep(game: GameView): GameView` in `galleryFixtures.ts` — moves `step` to the next `LADDER` key; from `CLEANUP` (or any off-ladder step) goes to `UPKEEP`, and from `CLEANUP` also hands `activePlayerId` to the next player in `players` and increments `turn`. Entry: `{ id: 'board:phase-ladder', group: 'Tablero', label: 'Phase ladder: walk a turn', description: 'BRD-62: …', phase: 'game', game: <playerGameView-based game at UPKEEP on the own turn>, gameId, action: { label: 'Next step', apply: nextLadderStep } }`.

- [ ] **Step 1: Write failing tests** (`BRD-62:` titles): `nextLadderStep` from `PRECOMBAT_MAIN` → `BEGIN_COMBAT`, same player and turn; from `CLEANUP` on turn 3 → `UPKEEP`, other player active, turn 4; eleven calls from `UPKEEP` return to `UPKEEP` on the other player; the entry `board:phase-ladder` exists with that action.
- [ ] **Step 2: Run** `npx --prefix web vitest run src/dev/galleryFixtures.test.ts` — Expected: FAIL.
- [ ] **Step 3: Implement** `nextLadderStep` and the entry (check the group name used by neighbouring board entries and reuse it).
- [ ] **Step 4: Run** the same command — Expected: PASS.
- [ ] **Step 5: Visual check.** `node scripts/ctl.mjs start vite`, open `http://localhost:5173/#/gallery`, pick the entry with the Playwright MCP, click "Next step" through a full turn and into the opponent's, toggling a stop with click and right click; screenshot each phase group and read the images (no overlap with the hand or the action pill, icons legible, tint switches with the turn).

### Task 5: Close-out

- [ ] **Step 1: Run** `node scripts/test.mjs unit typecheck` and `npm --prefix web run test:e2e:changed` — Expected: green except pre-existing `styleTokens`.
- [ ] **Step 2: Run** `node scripts/test.mjs e2e` (gallery fixtures and `e2e` specs changed) — Expected: green.
- [ ] **Step 3: Docs** — `web/INTERACTION_COVERAGE.md`: point phase-stop rows at the ladder; `ROADMAP.md` §4 only if something is left pending.
- [ ] **Step 4: Commit** only when the user asks.
