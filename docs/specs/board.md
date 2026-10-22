# The board

Prefix: `BRD`

How the battlefields of every seat are laid out: which band a permanent sits in, and how a
multiplayer board makes room for one opponent. Each seat is a `BoardZone.tsx` (own side
`PlayerZone`, opponents `OpponentZone`); the multiplayer layouts are `ArenaBoard.tsx` (the Arena
layout, and the Table layout, which renders the same board under the v2 chrome) and
`PodBoard.tsx`. The guiding principle: **in a Commander pod every board must stay readable as the
game grows** — space goes to the board the player is looking at, and the same kind of permanent is
always in the same place, on every board. Hands are `docs/specs/hand.md`, targets on the board
`docs/specs/targeting.md`, combat arrows `docs/specs/combat.md`.

Rules BRD-1 and BRD-2 apply to the Arena and Table layouts; Standard and Pod keep their bands.

### BRD-1 · Lands on the left, other non-creature permanents on the right
The row that does not hold creatures is split in two bands side by side: lands on the left (grouped
by name as before) and every other non-creature permanent on the right (artifacts, enchantments,
mana rocks, Treasures, Clues and other tokens). The split follows what each side holds, measured at
run time, never a fixed half: a side with nothing yields its whole width to the other, and a side
with more cards gets more width. Every board uses the same left/right order; opponents' boards are
mirrored only vertically. A land that is also a creature (Dryad Arbor, an animated Mutavault) stays
with the creatures, as before.

- Why: one mixed band made it hard to find a mana rock among lands as boards grew, and four or more
  copies of a land overlapped the rocks next to them (issue #14); issue #23 asked for the MTG Arena
  arrangement so each kind sits in the same place on every board.
- Guard: `src/board/BoardZone.kindColumns.test.tsx` · `e2e/kind-bands.spec.ts`

### BRD-2 · Planeswalkers, sagas and battles get their own column at the right edge
Non-creature planeswalkers, sagas and battles leave the creature row and form a column at the right
edge of their seat, spanning both rows. They never stack with each other, each shows its own
loyalty, lore or defense, and a seat without any has no column, so the rows keep the full width.

- Why: at the end of the creature row the dock took width from the creatures, the row a player
  reads most; a column spanning both rows uses height the rows leave free (issue #23, part 3).
- Guard: `src/board/BoardZone.kindColumns.test.tsx` · `src/board/bandWeights.test.ts` · `e2e/kind-bands.spec.ts`

### BRD-3 · One opponent's board can take the whole opponents' row
In the Arena and Table layouts with two or more opponents still in the game, each opponent's
status row has a focus button, and a click on an opponent's pill in the turn-order ring does the
same. Focusing an opponent gives their board the whole opponents' row: cards that a crowded column had
shrunk to fit its width grow back to the size the seat's height allows, and the focused seat's
status row lays out flatter to give the battlefield more height, never past the size of your own
board's cards. The others shrink to their status strip (portrait, full name, life, hand and pile
counts) beside it. The focus button of the focused
seat, or an "All boards" button, brings back the equal columns; focusing a shrunk seat moves the
focus to it. Your own board and hand never move or shrink. Focus is local to this client, is not
saved, and is dropped when the focused player leaves or loses. Focusing changes only sizes, never
what is visible: a hidden card stays hidden on a focused board. A click on the portrait itself
still targets the player (TGT-8) and never changes the focus.

- Why: in a four-player Commander game every opponent column is a third of the screen and cards
  shrink until they are unreadable; issue #23 (part 2) asked for one board on the whole screen.
  The own board stays because a full point-of-view switch hides the blockers, targets and triggers
  the player must answer.
- Guard: `src/board/ArenaBoard.test.tsx` · `src/board/TurnOrderRing.test.tsx` · `src/board/seatFocus.test.ts` · `src/board/ownCardCap.test.ts` · `e2e/seat-focus.spec.ts`

### BRD-4 · A shrunk seat still tells you when it matters
While another seat is focused, a shrunk seat pulses once whenever a permanent enters or leaves its
battlefield, and rings like a target zone while the current prompt can target the player or any
card on their board. Clicking a shrunk seat focuses it; an open prompt stays open, so the target can
be picked on the board that just grew. The pulse obeys the effects and reduced-motion settings.

- Why: a board the player cannot see must not swallow what happens on it; issue #23 asked for
  portraits that flash and target prompts that survive switching boards.
- Guard: `src/board/ArenaBoard.test.tsx`

### BRD-5 · Combat brings the attacker's board into view
While a seat is focused, if an opponent declares attackers and their seat is shrunk, the focus
moves to the attacking opponent for that combat; when combat ends it returns to the seat the player
had chosen, unless the player picked another seat during combat.

- Why: blocks are declared by clicking the attackers, which live on the attacking player's board
  (CMB-1); a shrunk attacker's board would leave nothing to click.
- Guard: `src/board/seatFocus.test.ts`
