# Arena phase ladder above the action button — design

## Intent
The user wants the turn/phase selector to look and feel like MTG Arena's (north star: one Arena layout,
game UI as close to Arena as possible): a row of SVG icons sitting right above the action/priority button
in the bottom-right corner, the current step lit, stops shown and toggled on the icons. The text strip in
the top bar (`PhaseBar`: `UP DR M1 BC AT BL EC M2 ET CL`, plus the `PhaseName` label) goes away: Arena
has a single phase tracker. A gallery entry lets the user click through a turn and watch it before and
after it reaches the board.

## Goals
- One phase ladder, above the action button, on every Arena board (own seat and spectator).
- It shows the step being played and the stops of the turn being played; it edits the same `phaseStops`
  setting as Settings (SET-11), so the server push is unchanged.
- An interactive gallery stage: the real ladder + the real action button, with controls to advance the
  step, switch whose turn it is, and see the stops light up.

## Non-goals
- No change to how stops reach the server, to smart stops, to the ⋯ pass menu or to Settings' grid.
- No new stop keys: the seven stoppable steps stay `upkeep, draw, main1, beginCombat, endCombat, main2,
  endStep`.

## Anti-goals
- A second phase indicator anywhere (the strip must be gone, not hidden).
- Text codes on the board (`M1`, `BC`): the ladder is icons; names live in tooltips / aria labels.

## Approaches (chosen: A)
- **A — Arena behaviour (chosen).** One row showing the turn in progress, tinted with that player's
  seat colour. A click toggles that step's stop **for the turn being shown** (opponent's turn → opponent
  stop; your turn → your stop); a right click toggles the other turn's stop. A lit notch under an icon
  = stop in the shown turn; a faint dot = stop only in the other turn. Picked: it is what Arena does and
  the row always speaks about the turn on screen.
- B — two fixed rows (your turn / opponent turn). Rejected: double height over the hand, less Arena.
- C — today's semantics (left = you, right = opponent, two dots per icon). Rejected: no Arena feel and
  two dots on a small icon read poorly.

## Design
- **Steps on the ladder** (left → right), big icon = phase, small icon = step:
  beginning (upkeep · draw, small), **main 1** (big), combat (begin · attackers · blockers · damage ·
  end, small, grouped under one combat bracket), **main 2** (big), end (end step · cleanup, small).
  The two damage steps light the damage icon. Steps with no stop key (attackers, blockers, damage,
  cleanup) light up but do not take a click.
- **Icons**: our own inline SVGs in `game/PhaseGlyph.tsx` (no Arena art copied; `ui/Icon` only wraps
  lucide, so the ladder's glyphs live beside the ladder): a sunrise for upkeep, a card for
  draw, a gem/diamond for the mains, swords for attackers, a shield for blockers, a burst for damage,
  crossed swords for begin/end combat, a moon for the end step.
- **States**: past steps dimmed, current step lit with the seat colour and a short sweep when it
  changes, future steps neutral; stop notch as above.
- **Placement**: a new component (`game/PhaseLadder.tsx`) rendered with the action button, so it sits
  above it in the bottom-right corner and moves with it. `PhaseBar` leaves the top strip and is
  deleted; `PhaseName` (still used by `MobileSpectator` and `RewindBar`) moves to its own file and
  leaves the strip too.
- **Gallery**: a `phase-ladder` entry showing the real game screen (ladder + action button) with one
  control, "Next step", that walks the turn step by step and, past cleanup, hands the turn to the other
  player (the gallery takes one action per entry); stops edit the real `phaseStops` setting.
- **Specs**: a new BRD rule for the ladder (placement, the A semantics, no text strip), SET-11's
  "the phase bar, the phase dial and the ⋯ menu" becomes "the phase ladder and the ⋯ menu". The rule's
  tests: a unit test of the ladder component and the existing `e2e/phase-stops.spec.ts` moved to the
  ladder's test ids.

## Left to the builder
- Exact icon drawings, sizes and the sweep animation (tokens from `ui/tokens.css`, no literals: the
  style-token ratchet guards it).
- Phone width (≤600 px): the ladder keeps only the five big phase icons with the current step's small
  icon beside them, if the full row does not fit above the button. (My call; adjust after seeing it.)
- Keyboard: each clickable icon is a button with an aria label "<step> — stop on <turn>: yes/no".
