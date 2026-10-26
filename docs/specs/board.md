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
In those two layouts a multiplayer game is drawn in one of two modes, picked by the **main board**
setting (BRD-6): off, the opponents share a row above the own board and one of them can be focused
(BRD-3…BRD-5); on, one board fills the main area and every other board sits in a side panel as a
scaled-down copy (BRD-6…BRD-13).

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
In the Arena and Table layouts with the main board setting off (BRD-6) and two or more opponents
still in the game, each opponent's
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
  the player must answer; the main board mode (BRD-6) is the point-of-view switch that keeps every
  other board on screen.
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

### BRD-6 · The main board setting: one board at full size, the others in a side panel
Settings → Board has a **Main board with side panel** switch (`boardSpotlight`, off by default).
With it on, in the Arena and Table layouts, a player (not a spectator) with two or more opponents
still in the game sees one board at full size in the main area — their own when the game starts —
and every other seat in a panel on the right edge of the board, one copy per seat, top to bottom
in turn order starting after the player. A copy is the whole board of that seat (status row,
battlefield bands, command zone, piles) laid out at the size of the main area and scaled down as
one piece, so it keeps the main area's proportions and its cards never wrap or clip differently
from the same board in the main area. Every board, main or copy, is laid out the way the own board
is (status row at the bottom, creatures above lands), so each kind of permanent sits in the same
place on every board. An opponent's hand, in the main area or a copy, is a stack of backs with its
count beside their portrait (a click opens the known cards), so it never sits under the own hand. A
seat that has left or lost keeps its place in the panel as a defeated seat.
A spectator gets the same mode when three or more players are still in the game: the main area
starts on the seat the column view draws at the bottom for a spectator (the last in turn order),
the panel holds every other seat in turn order after it, and a seat whose hand the spectator may
see shows it in the main area as the column view does. With the switch off, in Standard or Pod, or
with fewer than three players left (a player with fewer than two opponents),
the board is drawn as BRD-3…BRD-5 describe; turning the switch on or off mid-game takes effect at
once and never drops an open prompt.

- Why: issue #23 asked for one board on the whole screen; a full point-of-view switch was held back
  (BRD-3) because it hid the blockers, targets and triggers the player must answer. With every other
  board still on screen as a copy, nothing is hidden, only smaller (the EDHPlay layout the issue
  author played on). Scaling the whole board keeps its proportions, so the 35-60 px clipped cards
  of squeezing permanents into a narrow column do not come back. It is a single switch, not one per
  part, because the layouts already multiply with the interfaces. Spectators were left out at first
  and asked for it at once: watching a pod has the same crowded columns, and nothing to answer.
- Guard: `src/board/ScaledCopy.test.tsx` · `src/board/SpotlightBoard.test.tsx` · `src/board/cardOverlays.test.ts` · `src/board/spotlight.test.ts` · `src/board/useZoneScale.test.tsx` · `src/game/GameScreen.test.tsx` · `src/state/persistence.test.ts` · `e2e/spotlight.spec.ts`

### BRD-7 · A click on a copy brings that board to the main area
Clicking a copy — anywhere that is not something the current prompt can pick (BRD-8) — swaps it:
that seat's board fills the main area and the board that was there takes its place in the panel.
Clicking the own copy brings the own board back. The turn-order ring pills do the same, the own
pill included, and the pill of the seat in the main area is marked as pressed. The choice is local
to this client, is not saved, starts on the own board in every new game, and falls back to the own
board when the chosen player leaves or loses (for a spectator: on and back to the starting seat of
BRD-6; a spectator has no own copy or own pill, and every pill is clickable). An open prompt stays open across a swap. A swap
changes only where a board is drawn, never what is visible: a hidden card stays hidden in the main
area and in a copy. The own hand stays at the bottom of the screen whatever board is in the main
area, and the focus buttons of BRD-3 are not shown (the copy is the button).

- Why: the issue asked to click a scaled-down board to see it at full size and to click oneself to
  come back; the hand must stay reachable to respond while looking at another board.
- Guard: `src/board/SpotlightBoard.test.tsx` · `src/board/TurnOrderRing.test.tsx` · `src/board/spotlight.test.ts` · `e2e/spotlight.spec.ts`

### BRD-8 · What the prompt can pick can be picked on a copy
Hovering a card in a copy shows the same floating preview as on the main board. A card or player in
a copy that the current prompt can pick (a target, a playable card, a creature the combat
declaration lists) is highlighted as on the main board, and clicking it acts on it exactly as on
the main board (TGT-5, CMB-1) without swapping. A copy whose seat holds something the prompt can
target rings like a target zone, and a copy pulses once when a permanent enters or leaves its
battlefield; the pulse obeys the effects and reduced-motion settings (FX-1, FX-2) and has a gallery
entry (FX-12).

- Why: the copies are an overview, not for reading (the issue: "the hover preview covers the text
  and a click brings the board to full size"), but a board on screen must never be one the player
  has to swap in just to answer a prompt.
- Guard: `src/board/SpotlightBoard.test.tsx` · `e2e/animations-play.spec.ts` · `e2e/spotlight.spec.ts`

### BRD-9 · Declaring attackers or blockers brings the own board to the main area
When the server opens an attackers or blockers declaration for the player and another board is in
the main area, the own board takes the main area for that declaration — the creatures to click are
there — and the board the player had chosen comes back when the declaration ends, unless the player
swapped during it. The attacking player's board stays in the panel, where its attackers and the
arrows to them stay visible.

- Why: the issue asked for an automatic switch to the own board for declaring blockers; the
  declared creatures are always the player's own (CMB-1), and the attackers are still on screen in
  their copy.
- Guard: `src/board/spotlight.test.ts`

### BRD-10 · Arrows reach the copies
Every arrow the board draws — attackers and blockers (CMB-4) and what a spell or ability points at
(TGT-9) — whose end is a card or player shown in a copy starts or ends on that card or that copy's
player portrait, at its scaled-down position, so what each attack, spell or ability points at is
readable without swapping.

- Why: the issue pointed at EDHPlay, where players draw such arrows by hand, and noted that Nexus
  already knows targets and attackers.
- Guard: `src/board/CombatArrowsOverlay.test.tsx`

### BRD-11 · The phase strip sits on top of the board
In the main board mode the turn and phase strip is drawn at the top of the board area instead of
between the opponents and the own board; the main area takes the full height below it and the panel
runs from the strip to the bottom edge.

- Why: with one board in the main area there is no row between boards to put the strip in, and the
  issue asked for the strip on top so the main board gets the full height.
- Guard: `src/board/SpotlightBoard.test.tsx` · `e2e/spotlight.spec.ts`

### BRD-12 · Library, graveyard and exile are cards in the corner of each board
In the main board mode each board, main and copies, shows its library, graveyard and exile as
card-shaped piles in its bottom-right corner, flush with the board's bottom edge beside the status
row (never stacked above it, the status row leaves them the room), instead of chips on the portrait: the library as a
face-down back with its count (its top card face up while that card is revealed, as on the chip), the graveyard and exile with their top card face up and a count, and
an empty pile as an outlined slot. A click opens the same viewer the chips open, and a pile glows in
the same cases the chip does: a card in it the player can play (flashback, play from exile, the
revealed top of the library) or a card in it the current prompt can target.

- Why: players coming from MTG Arena, EDHPlay or paper look for the piles next to the board (issue
  #23); the chips stay in the column mode, where the Table layout chose them.
- Guard: `src/board/BoardZone.pileCards.test.tsx` · `src/board/SpotlightBoard.test.tsx` · `src/game/ResourceBar.test.tsx` · `e2e/spotlight.spec.ts`

### BRD-13 · The panel can be resized
The panel's left edge can be dragged to change its width between 15% and 35% of the board width
(22% by default). The width is a player setting (`boardSpotlightPanel`), kept across games, and the
copies rescale while dragging: a wider panel never makes a copy smaller, and a copy grows until it
fills its slot's height — with three copies stacked that happens a little past the default width, so
more width only adds room around them, which matters more in a three-player game (two copies). A
copy never scrolls sideways.

- Why: in a pod the squeeze is horizontal, and how much room the overview deserves depends on the
  screen; the issue asked for a resizable panel.
- Guard: `src/board/SpotlightBoard.test.tsx` · `src/board/cardOverlays.test.ts` · `src/state/persistence.test.ts` · `e2e/spotlight.spec.ts`


### BRD-14 · The phase dial's centre is big enough for what it says
The round button at the centre of the phase dial (v2 chrome) is large enough to hold its longest
everyday text — "Waiting for <name>" with a 14-character name, and the clock line under it
("Thinking 0:00 · 07:13 left") — without spilling past the circle's edge. Text inside it wraps only
between words, never inside one ("BLACKMAGI / C", "THINKIN / G" are bugs); a name that still does
not fit is cut with an ellipsis and the full text stays in the button's tooltip. The phase pips
move out with the bigger centre, so no pip overlaps it and the pips keep their spacing, and the
whole dial still fits the dock corner it sits in without covering the hand or the side panel. The
fit is measured against the rendered text, not a fixed pixel budget, so a wider font (injected
`--font-ui`) still fits.

- Why: a 112 px centre broke "Waiting for BlackMagic" into "BLACKMAGI / C", "Thinking" into
  "THINKIN / G" and clipped "07:13 left" at the edge (user report with screenshot, 2026-10-24).
- Guard: `src/game/PhaseDial.test.tsx` · `e2e/game-ui-v2.spec.ts`

### BRD-15 · The own command zone sits in the left column, above the last actions
On the v2 board the own command zone (commander, companion, emblems) is not part of the
creatures row: it docks in the bottom-left column, left-aligned with it and right above the
highest overlay stacked there (the "Last actions" box, the combat ledger, or the portrait when
both are hidden). Its position is measured from those overlays, so it moves up when the log grows
and drops onto the portrait when the log collapses or closes. Its cards are as large as that space
allows: they fill the room between the divider and that overlay, as wide as the column, and may
be larger than the board's own cards. When not even a card of `min(board card, 56px)` fits there
(a small window, or the log expanded, BRD-17), the zone falls back to the start of the creatures
row, clear of the column.

- Why: the column above the log was empty while the commander sat offset to the right of it,
  taking room from the battlefield (user report with screenshot, 2026-10-24).
- Guard: `e2e/game-ui-v2.spec.ts`

### BRD-16 · The resting hand never covers the own battlefield
On the arena board (the one v2 always uses) the fanned hand still floats over the bottom edge of
the board, but the own zone reserves room for it: its bottom padding is the height the resting
fan shows above the board edge (the visible part of each sunk card, plus its arc rise, the
playable lift and the lift of its rotated top corner) plus a gap of 1.5% of the viewport height,
between 6 and 16 px. The reserve is computed by `HandBar` from the card size it actually renders
and follows it on every resize. The lands row sits above the reserve, and when the zone has no
room left its cards shrink instead of sliding under the hand. Hovering a hand card lifts it with
a transform only: it is drawn above the battlefield, and the battlefield does not move.

- Why: the resting fan sat on top of the lands row, and a hovered card covered it even more
  (user report with screenshot, 2026-10-24).
- Guard: `src/board/handSizing.test.ts` · `e2e/game-ui-v2.spec.ts`

### BRD-17 · The last actions box is one line until the player expands it
On the v2 board the "Last actions" box shows only the newest action, on one line cut with an
ellipsis, so the column above it is free for the command zone (BRD-15). A +/− button on the box
expands it to the header and the last four actions, and back; the choice is remembered across
games and reloads (`mage-web-log-ticker-expanded`), collapsed by default. A click anywhere else on
the box still opens the log panel; the button does not.

- Why: the four-line box took the room the commander needed; the user asked for one line that
  the player can expand, with the freed space going to the commander (2026-10-24).
- Guard: `src/game/LogTicker.test.tsx` · `e2e/game-ui-v2.spec.ts`

### BRD-18 · A commander that changes object is one column, not two
The commander damage matrix has one column per commander. A commander cast from the command zone
(or converted) can change object id; the remembered entry with the same owner and name and another
id is the same commander, so the roster drops it and keeps the live one with its damage.

- Why: the seat showed the damage next to a stale 0 (`3/0`), because the roster kept the command-zone
  entry for the whole game. A player has one copy of each commander, so an owner and a name identify it.
- Guard: `src/board/commanders.test.ts` · `src/game/CommanderSeatMatrix.test.tsx`

### BRD-19 · A life total stays inside its seat at phone width
On a phone an opponent's seat (the v2 board, the default) is about 100 px wide, so its name takes the top row and the avatar sits
under it beside the life total. No life total is cut off by its seat or the screen edge, and the stats row
wraps inside the seat instead of losing its counts. From 601 px up the seat keeps the full-size life total.

- Why: at 390 px the opponents' 20 life was drawn as a single "2" at the seat's edge, the rest of the number
  cut off by the screen (review of 2026-10-26). The life total is the number a player needs at a glance.
- Guard: `e2e/phone-fit.spec.ts`
