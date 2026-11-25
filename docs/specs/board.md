# The board

Prefix: `BRD`

How the battlefields of every seat are laid out: which band a permanent sits in, and how a
multiplayer board makes room for one opponent. Each seat is a `BoardZone.tsx` (own side
`PlayerZone`, opponents `OpponentZone`). There is one layout, the Arena one (`ArenaBoard.tsx`, and
`SpotlightBoard.tsx` for its main-board mode), in every game: duels, pods and spectators. The 2x2
pod was removed on 2026-11-21, and the Standard layout and the Table (v2) interface on 2026-11-23:
the user wanted one layout to iterate on, as close to MTG Arena as possible, instead of every
board change being made and tested several times. The guiding principle: **at a full table every
board must stay readable as the game grows** — space goes to the board the player is looking at,
and the same kind of permanent is always in the same place, on every board. Hands are
`docs/specs/hand.md`, targets on the board `docs/specs/targeting.md`, combat arrows
`docs/specs/combat.md`.

A game is drawn in one of two modes, picked by the **main board** setting (BRD-6): off, the
opponents share a row above the own board and one of them can be focused (BRD-3…BRD-5); on, one
board fills the main area and every other board sits in a side panel as a scaled-down copy
(BRD-6…BRD-13).

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

### BRD-2 · Planeswalkers, sagas and battles get their own zone in the creatures row
Non-creature planeswalkers, sagas and battles sit in their own band at the right end of the
creatures row, beside the creatures band, with no frame of its own (BRD-32). The row is split the
way BRD-1 splits the other row: the bands share one card size and each band's width follows what
its cards need at that size (BRD-26). The marquee band is never narrower than one of its cards and
never wider than its cards need (the width left over goes to the creatures): with no frame, that is
its cards plus its padding. The engine never reads a band's border as a frame, because the spare a
band in several lines keeps (BRD-35) is drawn as a transparent border. The sizes come from
the board's single layout function (BRD-25), so no band reads a size another band chose. They never stack with each other, each shows
its own loyalty, lore or defense, and a seat without any has no marquee band, so the creatures
band keeps the whole row. A seat with only marquee permanents (no creatures, no commander) still
has a creatures row: it is the row that holds them. The own board
gives this zone the right edge of both rows instead (BRD-33).

- Why: the column at the right edge (issue #23, part 3) copied the smallest card size of the
  bands beside it, and the bands measured their room after the column: each one resized the
  other every frame, so a board with one planeswalker kept resizing forever (user report,
  2026-10-29; reproduced at 1366×900 with 6 creatures and 7 lands: about 180 style changes per
  second). A band of its own in the creatures row has no such dependency, and the user chose it.
- Guard: `src/board/BoardZone.kindColumns.test.tsx` · `src/board/bandWeights.test.ts` · `src/board/layout/layoutEngine.test.ts` · `src/board/layout/solveRow.test.ts` · `src/board/marquee.test.ts` · `e2e/kind-bands.spec.ts`

### BRD-3 · One opponent's board can take the whole opponents' row
With the main board setting off (BRD-6) and two or more opponents
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
still targets the player (TGT-8) and never changes the focus. In these layouts no opponent's
cards, focused or not, are ever larger than the largest cards of your own board. On the Arena
layout no opponent's board draws that button: the seat's pill in the turn strip carries the icon
and takes the click (BRD-37), which leaves the status row for the chip, the hand, the commander and
the piles. The focused board still offers "All boards". A spectator keeps the button, because the
pills do nothing for them.

- Why: in a four-player Commander game every opponent column is a third of the screen and cards
  shrink until they are unreadable; issue #23 (part 2) asked for one board on the whole screen.
  The own board stays because a full point-of-view switch hides the blockers, targets and triggers
  the player must answer; the main board mode (BRD-6) is the point-of-view switch that keeps every
  other board on screen.
- Guard: `src/board/ArenaBoard.test.tsx` · `src/board/TurnOrderRing.test.tsx` · `src/board/seatFocus.test.ts` · `src/board/layout/solveBoardLayout.test.ts` · `e2e/seat-focus.spec.ts`

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
With it on, a player (not a spectator) with at least one opponent
still in the game — a duel, a game that started as one, or a pod down to two — sees one board at
full size in the main area — their own when the game starts —
and every other seat in a panel on the left edge of the board, one copy per seat, top to bottom
in turn order starting after the player. The panel takes the left edge because the stack rises on
the right one, and a panel there covered it. What belongs to the board being played on is laid out
over the main area rather than over the whole board: the own hand's fan takes the main area as its
band (so the panel is outside it instead of eating the fan's width) and the order line is centred
on it (PRM-18). A copy is the whole board of that seat (status row,
battlefield bands, command zone, piles) laid out at the size of the main area and scaled down as
one piece, so it keeps the main area's proportions and its cards never wrap or clip differently
from the same board in the main area. Every copy spans the panel's width and takes the main area's
proportions, its height following from that width, so its box never stretches past the board drawn
in it; when the copies do not fit the panel's height the panel scrolls vertically, never sideways. Every board, main or copy, is laid out the way the own board
is (status row at the bottom, creatures above lands), so each kind of permanent sits in the same
place on every board. An opponent's hand, in the main area or a copy, is a stack of backs with its
count beside their portrait (a click opens the known cards), so it never sits under the own hand. A
seat that has left or lost stays in the panel folded to its head (BRD-30).
A spectator gets the same mode when two or more players are still in the game: the main area
starts on the seat the column view draws at the bottom for a spectator (the last in turn order
still in the game, BRD-57),
the panel holds every other seat in turn order after it, and a seat whose hand the spectator may
see shows it in the main area as the column view does. The mode stays when a pod is down to two
and in games that start with two players. With the switch off the board is drawn as BRD-3…BRD-5
describe; a duel then has its one opponent across the whole opponents' row. A game of five or more
players is always drawn in this mode, whatever the switch says, since the opponents' row seats at
most three; the turn-order strip and the panel then hold every seat. Turning the switch on or off
mid-game takes effect at once and never drops an open prompt.

- Why: issue #23 asked for one board on the whole screen; a full point-of-view switch was held back
  (BRD-3) because it hid the blockers, targets and triggers the player must answer. With every other
  board still on screen as a copy, nothing is hidden, only smaller (the EDHPlay layout the issue
  author played on). Scaling the whole board keeps its proportions, so the 35-60 px clipped cards
  of squeezing permanents into a narrow column do not come back. It is a single switch, not one per
  part, because the layouts already multiply with the interfaces. Spectators were left out at first
  and asked for it at once: watching a pod has the same crowded columns, and nothing to answer.
  The mode used to switch off below two live opponents, so a Commander game that came down to two
  jumped mid-game to the split duel view, which looked like a broken table (user report,
  2026-11-11); the player who turned the switch on wants the same view to the end and in duels.
  The panel opened on the right edge and moved to the left one on 24-nov-2026: the stack is drawn
  at the right of the board, so the panel sat on top of the very thing a player reads while a spell
  is waiting.
  With one copy in a duel its box used to stretch to the panel's whole height around a much smaller
  board; the user asked for each box to keep the table's proportions at the panel's width, and for
  the panel to scroll when the copies do not fit (user report, 2026-11-12).
  A duel with the switch off used to fall back to a separate Standard board, and five or more
  players could only be seated there; with Standard gone (2026-11-23) a duel is one Arena column and
  a big table takes the panel, which already scrolls.
- Guard: `e2e/arena-duel.spec.ts` · `e2e/spotlight.spec.ts` · `src/board/ScaledCopy.test.tsx` · `src/board/SpotlightBoard.test.tsx` · `src/board/cardOverlays.test.ts` · `src/board/spotlight.test.ts` · `src/game/GameScreen.test.tsx` · `src/state/persistence.test.ts`

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
the main board (TGT-5, CMB-1) without swapping. While the prompt asks for a player and that
player's seat is a copy (choosing whom an attacker attacks, CMB-10), a click anywhere on that copy
or on its head (BRD-31) picks the player, not only on their portrait, and does not swap. A copy whose seat holds something the prompt can
target rings like a target zone, and a copy pulses once when a permanent enters or leaves its
battlefield; the pulse obeys the effects and reduced-motion settings (FX-1, FX-2) and has a gallery
entry (FX-12).

- Why: the copies are an overview, not for reading (the issue: "the hover preview covers the text
  and a click brings the board to full size"), but a board on screen must never be one the player
  has to swap in just to answer a prompt. Choosing a defender by clicking the opponent's copy only
  swapped it into the main area and left the prompt open, and the swapped-in player's portrait sat
  under the own hand, so a player could not pick or change whom they attacked (2026-11-12).
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

### BRD-11 · The control strip sits in its own top bar above every board
The turn counter, the phase ladder (BRD-62), the turn-order ring and the right-hand controls
(log/chat, drawers, menu) sit in their own top row (`.board-shell-top-strip`) above every board —
both Arena and Spotlight — as floating glass pills over a subtle top bar with a bottom separator
line dividing it from the board below. The horizontal divider between opponents and the own board
stays a slim decorative line.

- Why: the user asked for the divider controls to move to the top of the board (24-nov-2026),
  unifying Arena and Spotlight, then asked for the phase ladder to sit beside the turn counter and
  for a visual separator along the bottom of that top row so the opponent's tucked hand peeks cleanly
  from beneath it (same day).
- Guard: `src/game/GameStrip.test.tsx` · `src/board/SpotlightBoard.test.tsx` · `e2e/spotlight.spec.ts`

### BRD-12 · Library, graveyard and exile are cards in the corner of each board
In the main board mode each board, main and copies, shows its library, graveyard and exile as
card-shaped piles in its bottom-right corner, flush with the board's bottom edge beside the status
row (never stacked above it, the status row leaves them the room), instead of chips on the portrait: the library as a
face-down back with its count (its top card face up while that card is revealed, as on the chip), the graveyard and exile with their top card face up and a count, and
an empty pile as an outlined slot. A click opens the same viewer the chips open, and a pile glows in
the same cases the chip does: a card in it the player can play (flashback, play from exile, the
revealed top of the library) or a card in it the current prompt can target. The own board of the
Arena layout draws its piles at the bottom-left with a caption instead (BRD-32), and an opponent's
column draws them at the right of its status row (BRD-36).

- Why: players coming from MTG Arena, EDHPlay or paper look for the piles next to the board (issue
  #23); the chips stay where a narrow column has no room for piles.
- Guard: `src/board/BoardZone.pileCards.test.tsx` · `src/board/SpotlightBoard.test.tsx` · `src/game/ResourceBar.test.tsx` · `e2e/spotlight.spec.ts`

### BRD-13 · The panel can be resized
The panel's inner edge, which with the panel on the left edge (BRD-6) is its right one, can be
dragged to change its width between 15% and 35% of the board width (22% by default); the arrow keys
on it do the same by one percent, the right one widening the panel and the left one narrowing it. The width is a player setting (`boardSpotlightPanel`), kept across games, and the
copies rescale while dragging: a copy spans the panel's width (BRD-6), so a wider panel makes every
copy larger, and the panel scrolls vertically once they no longer fit its height. A copy never
scrolls sideways.

- Why: in a pod the squeeze is horizontal, and how much room the overview deserves depends on the
  screen; the issue asked for a resizable panel.
- Guard: `src/board/SpotlightBoard.test.tsx` · `src/board/cardOverlays.test.ts` · `src/state/persistence.test.ts` · `e2e/spotlight.spec.ts`


### BRD-14 · The phase dial's centre is big enough for what it says
Retired 2026-11-23: the Table (v2) interface was removed when every game moved to the one Arena layout; the action button is the Arena one in the bottom-right corner (BRD-29, BRD-32), and the phase dial is gone.

- Guard: none yet (retired)

### BRD-15 · The own command zone sits in the left column, above the last actions
Retired 2026-11-23: the Table (v2) interface was removed when every game moved to the one Arena layout; the own emblems, planes and dungeons sit in the Arena board's bottom row (BRD-39).

- Guard: none yet (retired)

### BRD-16 · The resting hand never covers the own battlefield
The fanned hand floats over the bottom edge of
the board, but the own zone reserves room for it: its bottom padding is the height the resting
fan shows above the board edge (the visible part of each sunk card, plus its arc rise, the
playable lift and the lift of its rotated top corner) plus a gap of 1.5% of the viewport height,
between 6 and 16 px. The reserve is computed by `HandBar` from the card size it actually renders
and follows it on every resize. The lands row sits above the reserve, and when the zone has no
room left its cards shrink instead of sliding under the hand. Hovering a hand card lifts it with
a transform only: it is drawn above the battlefield, and the battlefield does not move. The own
board, with or without the side panel, reserves the same height as its bottom row (BRD-32).

- Why: the resting fan sat on top of the lands row, and a hovered card covered it even more
  (user report with screenshot, 2026-10-24).
- Guard: `src/board/handSizing.test.ts` · `e2e/arena-chrome.spec.ts`

### BRD-17 · The last actions box is one line until the player expands it
Retired 2026-11-23: the "Last actions" box and the combat ledger floated over the own lands once the Table (v2) interface's measured gutter was gone, and MTG Arena, the layout's model, has neither; the log is one click away in the chat and log panel (PNL-10).

- Guard: none yet (retired)

### BRD-18 · A commander that changes object is one column, not two
The commander damage matrix has one column per commander. A commander cast from the command zone
(or converted) can change object id; the remembered entry with the same owner and name and another
id is the same commander, so the roster drops it and keeps the live one with its damage.

- Why: the seat showed the damage next to a stale 0 (`3/0`), because the roster kept the command-zone
  entry for the whole game. A player has one copy of each commander, so an owner and a name identify it.
- Guard: `src/board/commanders.test.ts`

### BRD-19 · A life total stays inside its seat at phone width
Retired 2026-11-23: the phone layout is no longer a target (user decision with the one Arena layout); its guard checked the Table (v2) seat at phone width.

- Guard: none yet (retired)

### BRD-20 · One pile per identical permanent; token piles open after a second of hover
Three or more identical permanents pile up (two lands are enough on the own board of the Arena layout, as
in MTG Arena, BRD-32), and the pile holds every copy there is: fifty Soldiers are one pile of fifty, not
ten piles of five. A pile is drawn as its top card with each other copy a dim edge just behind it, and the
count badge in the corner, which is where the number is read; it shows at most five of those edges, so a
pile of fifty takes the width of a pile of five instead of growing one edge per card.
With a mouse, a token pile fans out only after the pointer has rested on it for one second, and only that
pile; a touch fans it out at once. While a token pile is fanned out the large hover preview is hidden, so
it never covers the fanned cards. A land pile fans out as soon as the pointer enters. A fanned pile closes as
soon as the pointer moves over anything outside it, even when the browser never reports that the pointer left.
A pile of more than twelve does not fan at all: a fan compressed into the row would be a smear rather than a
row of cards, and a copy the game is asking the player to pick leaves the pile and stands on its own anyway.

- Why: a board of tokens (dozens of Treasures or Soldiers) spread each pile across the row, and passing the
  pointer over a pile fanned it out and pushed its neighbours aside. A pile that holds still and opens on a
  deliberate hover keeps the board readable while every token stays selectable (2026-10-26).
  A land pile stayed open while the pointer rested on the mana rock it had pushed aside (CI, 2026-10-31):
  when the card under the pointer is redrawn as the pointer leaves, React reports no leave for the pile, so
  the pile also watches pointer moves while it is open.
  Cutting a group into piles of five only moved the problem: a board of 254 Doppelganger tokens was 51 piles
  of "×5" filling three rows, and the player asked why identical creatures did not stack further (user
  report, 25-nov-2026). What the five-card limit was really protecting is the pile's footprint, so the limit
  now caps the edges drawn, not the copies held.
- Guard: `src/board/stackGroups.test.ts` · `src/board/StackPile.test.tsx` · `src/board/BoardZone.css.test.ts` · `e2e/stack-groups.spec.ts`

### BRD-21 · A board settles: no card size keeps changing for ever
Once a board has been drawn and nothing changes (no new game view, no window resize, no hover),
no band, marquee or zone changes its card size or its number of lines again: the sizes are written
once per change of input and then stay. This holds for a board drawn at a window size and for a
board already on screen whose window is then resized, with the browser's scrollbars visible. A
compact hand in a status row (an opponent's hand) takes no height of its own: the row's height
comes from the rest of the row, the hand stretches to it and sizes its cards from it in one step.
The room the own creatures leave beside the player chip (BRD-32) is decided only from a settled
board drawn without it, and kept while the zone, the chip and the number of cards stay the same, so
a board resized away and back draws the same sizes it had. The guard sweeps the Arena board, with and without the side panel, with 2 and 4 seats, boards of
several sizes with planeswalkers, sagas, commanders, tokens and attachments, both card styles and
several window sizes, both drawn fresh and reached by resizing a drawn board, and allows no size
change at all after the board has settled.

- Why: the planeswalker column of BRD-2 made a board resize every frame without end (user
  report, 2026-10-29; the user then set the bar: a slow transition does not matter, a loop does), and no test watched a board after it was drawn; the size of a card was
  checked once, so an oscillation passed every spec. The first run of the guard found the
  opponent's hand in the Standard layout shrinking from 160 px to 65 px in 3 px steps for about a
  second, relaying out the whole board at every step. The 2-pixel hysteresis that fix added only
  moved the fixed points: on 2026-11-01 a Table board with 4 seats and compact cards, resized from
  1600 to 1000 px with scrollbars visible, flipped its lands and other permanents bands between
  47 and 110 px 120-180 times a second, while the guard (fresh draws only, scrollbars hidden,
  2 changes tolerated) stayed green. The board is now sized by one pure function (BRD-25). The
  chip reserve was decided from the board drawn with it on (smaller cards sit lower) plus half a
  chip of margin, so once a 1000 px window turned it on it stayed on at 1600 px and the own board
  drew 118 px cards instead of 130 px; its first fix measured too early, while the cards were still
  the 1000 px ones on two lines, and locked it on again (24-nov-2026; never caught while the guard
  ran on the Table interface).
- Guard: `src/board/HandZone.test.tsx` · `src/board/chipReserve.test.ts` · `e2e/board-settle.spec.ts` · `e2e/board-spotlight-settle.spec.ts`

### BRD-22 · The phase dial shows the steps of combat
Retired 2026-11-23: the Table (v2) interface was removed when every game moved to the one Arena layout; the phase dial is gone and the phase strip names the combat steps.

- Guard: none yet (retired)

### BRD-23 · A fanned pile never covers the permanents beside it
A pile fanned out on hover spreads to the right of its own first card and pushes the permanents after it
aside. It may use the empty part of its row: rightwards up to the next band, and leftwards when the right
leaves no room, into the empty space before it, never past the last permanent before it. Only when the
row has no free room either does the fan compress. A band that already scrolls its own overflow keeps
the fan inside it; any other band lets the fan show outside its box while it is open.

- Why: the fan slid left to stay inside the band when the pile sat near the right edge, so it covered the
  tapped lands in front of it (reported 2026-10-30). The rule already written in `StackPile` ("a mana rock
  beside a land pile is never covered") was not enforced. On the Arena board the others band is pushed to
  the right edge, so a Treasure pile had no room inside it and compressed while half the row stood empty;
  opening into that room first drew the fan clipped by the band, and the hidden cards could not be
  clicked (24-nov-2026).
- Guard: `src/board/stackSpread.test.ts` · `src/board/StackPile.test.tsx` · `e2e/land-fan.spec.ts` · `e2e/stack-groups.spec.ts`

### BRD-24 · A zone viewer is a fan of cards on an arc, slid along it with a thumb
The viewers of a graveyard, an exile, a library, a known hand, the revealed and looked-at windows,
the cards playable from other zones and the whole stack (STK-11) are one full-screen viewer, laid out like MTG Arena's: the board
dims behind it, the zone's name and card count sit on top, the cards are fanned like a hand of cards
held up, each turned `FAN_STEP_DEG` further than the one before around a pivot below the row, so the
outer cards lean out and sit lower, and one Done button closes it. Neighbouring cards overlap by the
same slice, 44 % of a card (`FAN_SLICE`), whatever the count: the fan shows as many cards as fit at
that overlap and never squeezes them. A longer pile slides its cards along the arc, from its first
card, with the mouse wheel, by dragging the pill-shaped thumb on the thin line under the fan, by
clicking that line, or with the arrow keys on the thumb; the line is hidden when every card fits.
The cards past either end of the fan are not hidden: up to `PILE_DEPTH` of them gather at that side
in a tight, dimmed pile, each turned only `PILE_STEP_DEG` past the one before, so the pile shows
there are more and on which side; the fan leaves room for both piles when it does not hold every
card. A click on a piled card slides the fan one card toward it and never plays that card, and
pointing at it lifts nothing.
Pointing at a card lifts it in front of its neighbours, larger, but what lifts is a copy that takes
no pointer: the cards underneath never move, so the card under the pointer is always the one whose
slice it is on, and sweeping along the fan lifts every card in order without skipping the ones the
lifted card covers. That lift is the only look at the card: pointing at or focusing a card in any of
these viewers, the known hand included, opens no side preview panel.

- Why: the user asked for the viewer to be MTG Arena's, fan and scroll included (23-nov-2026). The
  rule it replaces wrapped the cards into rows because one fixed 760 px row of full cards spread ten
  of them over 2 300 px and the player had to slide sideways to see them all (reported 2026-10-30);
  the fan shows seven or so at once and the thumb makes the slide a deliberate gesture. A first
  version grew the pointed card in place, so it covered the next card's slice and a sweep to the
  right jumped over it (user report, same day); the sweep guard fails with that version restored.
  The cards out of the window first vanished, so nothing said a longer pile went on; the user
  asked for Arena's small heap at each side (same day). The side preview panel that also opened on
  hover was dropped at the user's request (24-nov-2026): the lifted copy already shows the card
  large, and the panel beside it was a second, redundant copy. The same day the user extended it to
  every Arena-style viewer, the known hand too: the lifted card is large enough to read.
- Guard: `src/board/zoneFan.test.ts` · `src/board/HandViewer.test.tsx` · `src/board/PileOverlay.test.tsx` · `e2e/cross-zone-layout.spec.ts`

### BRD-25 · The same board in the same window always looks the same
Every card size, band width and number of lines on the board is a function of the game view, the
window (the board's box) and the settings, and of nothing else: not of the sizes chosen a moment
earlier, not of the path the window took to reach its size, not of whether a scrollbar happened
to be showing. A board resized from 1600 to 1000 px and back to 1600 px is identical, pixel for
pixel, to the same board drawn at 1600 px; drawn at 1000 px it is identical to the one resized
into 1000 px. All sizes come from a single pure function for the whole board,
`solveBoardLayout` (`web/src/board/layout/`): it reads the board's measured boxes once (each
seat's box and its status row, which the function never writes), computes every seat, row and
band in one pass, and the result is written in one frame. No band, seat or hand measures a size
that another part of the board wrote. Rules that span seats (an opponent's cards are never larger
than your own, BRD-3; the focused seat's cap) are comparisons inside that function, never a seat
reading another seat's applied size.

- Why: seven independent fitters (a scale hook per seat, five band fitters per seat, the own-card
  cap, the hand) each measured DOM the others wrote, and every loop found so far was patched with
  memory (a growth hysteresis, an overflow ceiling, a pinned status height for the gallery). With
  memory the same window gave different boards: measured 2026-11-01, a 4-seat Arena board resized
  1600 → 1000 → 1600 px came back with bands at 106 px where the fresh draw had 101, and a band at
  its full size where the fresh draw had shrunk it.
- Guard: `src/board/layout/layoutEngine.test.ts` · `src/board/layout/solveBoardLayout.test.ts` · `e2e/board-resize.spec.ts`

### BRD-26 · Bands that share a row share it by what they hold
The bands of one row (creatures, marquee and commander in the creatures row; lands and other
permanents in the other row) use one card size: the largest, up to
the seat's cap, at which every band of the row fits its cards inside the row's width and height,
going no deeper than three lines of classic cards would. How deep a band may go is that height, not
a count of lines, so the compact tile (0.75 of its width against the printed card's 1.4) opens the
lines that height holds: five of them, not three. Each band is then as wide as its cards need at that size, and the width
left over is shared in proportion to that need, unless a band takes fewer lines than the row is
tall for and grows its own cards into the room it leaves (BRD-50). So a band never shrinks to the floor or scrolls
while a band beside it in the same row keeps room it does not use. Only when not even the floor
size fits does the row stay at the floor and the bands that overflow scroll (BRD-27). Rows of the
same seat may use different sizes.

- Why: measured 2026-11-01 on a 4-seat Table board at 1000 px, the creatures band of the own seat
  was 38 px wide (the floor) for seven creatures, scrolling 294 px of content, while the marquee
  band beside it kept 122 px for one planeswalker: each band fitted itself inside a width that
  flex had already handed out. The depth was a count of lines, which is the same number for two
  card shapes of very different height: measured on the showcase at 1024 px, the own lands band
  drew its twelve piles in three lines of 52 px tiles, 108 px of a band 305 px tall, and could not
  make them wider because a fourth line was not allowed (user report, 23-nov-2026). As a height it
  is four lines of 74 px there, and the classic board is untouched.
- Guard: `src/board/layout/layoutEngine.test.ts` · `src/board/layout/solveBoardLayout.test.ts` · `src/board/layout/solveRow.test.ts` · `e2e/board-resize.spec.ts` · `e2e/board-fill.spec.ts`

### BRD-27 · A band that scrolls takes no room for its scrollbar
A band that cannot fit its cards even at the floor size scrolls sideways (wheel, drag, keyboard
focus) without a visible scrollbar: the scrollbar never takes height from the cards, and a soft
fade at the clipped edge shows there is more. Showing or hiding the scroll never changes any size
on the board.

- Why: the horizontal scrollbar took about 10 px of a band's height, so a band that overflowed
  measured less room, chose smaller wrapped cards, stopped overflowing, measured more room and
  grew back: the 2-cycle behind both the "vibrating compact board" (`docs/lessons.md`) and the
  2026-11-01 resize loop. Headless Chromium hides scrollbars, so no spec saw it.
- Guard: `e2e/board-resize.spec.ts`

### BRD-28 · The board's size model matches what the browser draws
`solveBoardLayout` predicts each item's width from the card size (a card, a tapped card, a pile of
lands or tokens, tapped or not, a permanent with attachments, both card styles, upright or tilted
tapped cards) without measuring it. Those predictions match the width Chromium lays out for the
same item at two card sizes within one pixel, so a CSS change to a card's margins or a pile's
overlap that the model does not follow fails a test instead of overflowing a band. The command zone
is modelled slot by slot (commanders and companions, planes, and one slot for all emblems). A
permanent that carries an attachment (an aura, an equipment) or is mutated is never part of a pile:
it is not identical to the others (BRD-20) and stays a single card with its attachments beside it.

- Why: a model that drifts from the CSS silently overflows or wastes room; measuring each item
  instead would bring back the measure-what-you-wrote loop of BRD-25.
- Guard: `src/board/layout/itemModel.test.ts` · `src/board/stackGroups.test.ts` · `e2e/board-item-model.spec.ts`

### BRD-29 · The classic bar's waiting pill keeps its text, clock and arrow aligned
The action button shows "Waiting for <name>" while another player
holds priority. Its text sits on one line, or on two when it does not fit, breaking only between
words ("ESPERANDO / A" is a bug); a name that still does not fit its line is cut with an ellipsis,
never clipped at the pill's edge, and stays whole in the button's tooltip. The hourglass sits in its
own column, centred on the whole text block, and the clock line ("thinking 0:13", plus the time left
when the match has a timer) starts at the same x as the text above it. When the clock line is too
narrow, the time left moves under "thinking" as a whole. The arrow box beside the pill is as tall as
the pill, starts at the same y, and its arrow is centred in it. This holds for a 14-character name
(the server's maximum) in the nine languages, on desktop and on a 390 px phone. The other modes of
the button (pass, resolve, combat) use the same columns: the icon centred on the label and the line
under it aligned with the label.

- Why: the label was a flex row, so its translated prefix became a shrinking flex item that split
  ("ESPERANDO / A"), the name had no room to shrink and was clipped, and the clock started under the
  hourglass instead of under the text (user report with a production screenshot, 2026-11-11).
- Guard: `e2e/action-bar-waiting.spec.ts`

### BRD-30 · A seat out of the game folds to its head in the side panel
In the main board mode (BRD-6) an opponent who is out of the game (`hasLeft` in the current game
view: they conceded, lost on life, poison or an effect, or quit the match) keeps its turn-order place
in the panel folded to its head (BRD-31): the seat colour, the name and why they are out, greyed
out, with no copy of their board under it. The reason comes from the game log, since the view only
says `hasLeft`: a skull and "has died" for a loss (0 life, poison, an effect), a white flag and "has
conceded" for a concession, and a door and "has left the game" for a player who quit the match or ran
out of time. A concession or a quit is logged next to the loss it causes, so the more specific
reason wins, and a player already out keeps the reason they had (a dead player who then closes the
table stays dead). Without a log line (the game was opened after they left), 0 life reads as a death
and anything else as leaving. It folds as soon as a game view marks the player out. The folded head is not a
button: it never brings the seat to the main area. The copies of the players still in the game keep
the size they had (it follows the panel's width). The player's own seat is never folded. A player
who only lost the connection is still in the game for the server until it drops them
(`PlayerView` carries no connection state), so the seat stays a copy until then.

- Why: the panel drew an out seat as a full-size copy holding the board's narrow strip scaled down
  to a few pixels, so a player who had conceded, died or quit looked like a player with an empty
  board still in the game (user report, 2026-11-11; reproduced in a four-player game against a
  local server, where the out seat kept the same 178 px slot as the live copies and stayed
  clickable). Removing the seat altogether lost track of who had been at the table, so the user
  asked for it to stay folded, saying whether they died, conceded or left (2026-11-12). There is
  nothing to unfold: when a player leaves, the
  server empties their hand, library and graveyard and removes what they own from the battlefield
  (CR 800.4a).
- Guard: `src/board/SpotlightBoard.test.tsx` · `src/board/outReason.test.ts`

### BRD-31 · Each copy in the side panel shows its player's name and life
In the main board mode (BRD-6) every copy in the panel has a head above it, drawn at full size and
not scaled with the board: the player's name (cut with an ellipsis when it does not fit) and their
life with a heart, updated with every game view. No bar of the seat colour beside the name: the
board under the head already carries that colour, and a second copy of it only drew a line. The head of the player whose turn
it is carries a turn badge and a gold edge. A click on the head brings that seat to the main area,
as a click on the copy does (BRD-7). The board in the main area has no head: its own status row is
already readable.

- Why: a scaled copy is a few hundred pixels wide, so its own status row is too small to tell whose
  board it is or how much life they have; the user asked for the name and life on each box, as
  EDHPlay shows them (user report, 2026-11-12). The look follows the panel, not EDHPlay's.
- Guard: `src/board/SpotlightBoard.test.tsx`

### BRD-32 · The board at the bottom is framed around the hand
The board drawn at the bottom, with or without the side panel (BRD-6), keeps the battlefield clear
of everything around it. It is the frame of the seat in that place, not a reward for owning it: a
spectator, and a second window watching a game of your own (which carries no controlled seat), get
the same frame around the seat they are watching. The player chip sits at the top-left corner
with no frame: the photo, the name and a large life total. The creatures only leave it room when
they would actually reach it in height. The bottom row is as tall as the resting hand (BRD-16) and
holds, from left to right, the library, graveyard and exile and, when the player can play
something from another zone, a fourth "Playable" pile. Each pile is drawn as the top half of a
card the size of the board's cards (three quarters of it on screens up to 1500 px wide, so the
hand keeps more room), under a caption with its name and count, and opens the same
viewer as before. Next comes the floating mana: its symbols with their counts, no box, right
under the lands and only while there is mana. The hand fans between them. The action button sits
in the bottom-right corner. The chip, the piles and the button stay 20 px inside the board's gold
edge. Nothing draws a line between the creatures and the other permanents. Lands start at the
bottom-left and two identical lands already pile up, the other non-creature permanents sit flush
with the right edge, and the two zones keep 48 px between them. The creatures stay on one line
while that keeps their cards at least 75% of the size more lines would give, and only then wrap
to two or three. The chip has no turn bar or tint (the strip and the board frame mark the turn).
Its counters (poison, experience, energy) fill a column beside the photo and the life, three high,
and only then open a column to the side (in an opponent's column they stay on one line, so every
seat's status row is the same height); the priority clock sits on its own line under the photo
and the life. On the same layout every opponent's chip also has no frame. At phone width
(600 px or less) the own board keeps the previous arrangement, and so do BRD-33 and BRD-34: the
bottom row and the planeswalker zone do not fit there.

- Why: the user's rework of the Arena layout (2026-11-12), after comparing it with MTG Arena and
  EDHPlay. Before, the action button covered enchantments, the chips sat in boxes, the hand covered
  the bottom of the board with the side panel open (its reserve did not reach `.spotlight-seat`) and
  hid the floating mana there.
- Guard: `src/board/BoardZone.arenaOwn.test.tsx` · `src/board/chipReserve.test.ts` · `src/board/layout/solveRow.test.ts` · `src/board/stackGroups.test.ts` · `e2e/spotlight.spec.ts` · `src/game/GameScreen.test.tsx`

### BRD-33 · The own planeswalkers take the right edge of both rows, as in MTG Arena
On the own board of the Arena layout (BRD-32) planeswalkers, sagas and battles (BRD-2) take a zone
at the right edge that runs from the top of the creatures row down to the bottom of the lands row,
starting at the top, and the lands row leaves that width free. A zone of a single line stands in
the middle of that height instead, since a lone card hanging from the top reads as misplaced
beside a full creatures row. One card stands alone; two or more
take at least two lines, filled from left to right with the same count on each line. Among the
line counts the height holds with cards of at least 75% of the creatures' size, the zone takes the
one that needs the least width, so the room it frees goes to the lands and the other permanents:
without the side panel two stand one above the other, three or four make a 2×2 square and five or
six three columns of two; with the side panel's extra height four stand in one column. The zone's
cards are as large as that height allows for its lines, never larger than the creatures', and the
creatures keep their own size.

- Why: in the creatures row two stacked planeswalkers only had half its height, and making them
  larger shrank every creature to half (tried and dropped, 2026-11-12). The user looked up MTG Arena,
  whose screenshots show the same zone on the right of both rows growing sideways in two lines
  (three cards as 2 + 1, five as 3 + 2). With the side panel two lines left most of the height
  empty, and the user asked for the zone to use it (2026-11-12); a 2×2 square of four still left
  a column's width unused below it (2026-11-13).
- Guard: `src/board/layout/solveRow.test.ts` · `src/board/BoardZone.css.test.ts`

### BRD-34 · The uncast own commander is drawn with the hand
On the own board of the Arena layout (BRD-32) the commander and the companion in the command zone
are drawn with the hand, which is where their owner looks for something to cast: the last cards of
the fan, apart from it by a gap of 0.4 of a card and with a gold edge; under the hand column,
behind a line of its own; at the end of the hand row, past a gap. In the fan it is read the way the
piles beside it are (BRD-32): the top half of a card, on a card a third wider than the hand's, so
its art and its name carry at a glance without the fan giving up the room a whole card would take. They follow the hand in every
hand layout, because the question they answer is the same in all of them. A seat drawn
at full size that is not mine, the main area of the main-board mode (BRD-6), carries its hand the
same way: the backs of the cards it holds, with its uncast commander at the end of them, instead
of a command zone of its own. A card that is face down stays face down there, known or not
(BRD-7). Their cost bubbles (HND-6) already include the commander tax: the tax
is generic mana, so it adds to the cost's generic pip (`{2}{R}{R}` with a tax of 2 reads
`{4}{R}{R}`) or becomes one in front of the coloured pips (`{G}{W}{U}{B}` reads
`{2}{G}{W}{U}{B}`), after `{X}` when the cost has one, and it grows with every cast. A first cast
and a companion show the printed cost. A click casts them as a click on the command zone does. Emblems, planes and dungeons stay in the
command zone on the board, which is what a hand cannot hold. A phone keeps the commander there
too: the hand has no room to spare at that width.

- Why: in the middle of the board the uncast commander took room from the creatures; the user
  asked for MTG Arena's Brawl arrangement, the commander as a hand card set apart (2026-11-12). The
  tax drawn in the card's corner sat below the board edge in the hand, a "+" drawn next to a pip did
  not read against the gold edge, and a separate "+N" still had to be added up by eye. It was the
  fanned hand of the v1 chrome only until the user asked for it everywhere (2026-11-21): with the
  v2 chrome the commander sat in the left column and read as one more thing on the board.
- Guard: `src/board/HandBar.test.tsx` · `src/board/HandBar.css.test.ts` · `src/board/commanders.test.ts` · `src/board/BoardZone.arenaOwn.test.tsx` · `src/board/HandRail.test.tsx` · `src/board/HandRow.test.tsx` · `src/board/SpotlightBoard.test.tsx`

### BRD-35 · A band in several lines holds the same count on each line
A band that wraps into several lines puts the same number of items on each line, or fewer on the
last, on every board and in every layout: ten land piles in two lines are five and five, not eight
and two, and seven in two lines are four and three even when five would fit on the first. The
board's layout function (BRD-25) chooses the card size for those even lines, so when wide tapped
cards would not fit four to a line the cards shrink a little instead of breaking the count. The layout engine then
measures the items as drawn (a tapped card with its margins) and narrows the band's line to the
widest even line, so the browser breaks the lines there: the width the row gave the band over that
line is kept half on each side, or, on the own board of the Arena layout (BRD-32), on the side the
band is not aligned to. The lines are centred in that width, so the full lines stay in place and a
short last line sits in the middle: five land piles above and two centred below, not two at the left and three gaps.

- Why: lines filled to the edge and a short last one made the board look like a grid of leftovers;
  even lines read cleaner (user request, 2026-11-12). It held only on the own Arena board at first,
  so a rival's seven lands still broke five and two; the user asked for the even split wherever a
  band wraps (14-nov-2026).
- Guard: `src/board/layout/layoutEngine.test.ts` · `src/board/layout/solveRow.test.ts`

### BRD-36 · Each opponent column of the Arena layout shows its piles, mirrored
With no side panel, every opponent column keeps its place
facing the own board and shows its library, graveyard and exile as small piles at the right end of
its status row, instead of chips: each one half a card, smaller than the own piles, with a caption
with its name and count. The opponent's board is mirrored vertically, so the piles hang from the
top edge with the caption under them, and the cards are turned round: the half that shows is the
top of the card, upside down, as the rest of a mirrored board would be. The captions always use the
short names ("Lib", "GY"), because the same row also holds the chip, the hand and the commander
(BRD-40). That row never breaks into a second line: under it the battlefield starts straight away,
so a second line has nowhere to go but over the cards. What gives way when the column is narrow is
the chip, which spends height instead of width (its clock and its counters hang under the photo,
BRD-32 and BRD-54) and truncates its name last of all; the piles stay at the right end of the row
whatever it holds. A click opens the same viewer, and a pile glows in the same cases as the own
(BRD-12). At phone width the columns keep their chips.

- Why: the own board got its piles with captions (BRD-32); the user wanted the opponents to show
  theirs the same way, smaller, as long as they fit (2026-11-12, checked at 1920, 1366 and 390 px
  with three opponents). At 1366 a column with counters on the chip wrapped its status row and the
  piles landed on the lands, hence the short names and no wrapping. The column then forbade the
  chip a second line, which was right while the counters stacked beside the photo and wrong as soon
  as they moved under it (BRD-54, 23-nov-2026): the clock and the counters crowded one line, the
  name came out as a letter and the piles fell onto the battlefield anyway. Reported on a
  four-player Commander table (24-nov-2026): the cap belongs to the row, not to the chip.
- Guard: `src/board/BoardZone.arenaOwn.test.tsx` · `e2e/arena-board.spec.ts`

### BRD-37 · The Arena layout shows the same turn order strip with and without the side panel
The strip in the divider (or at the top of the board with the side
panel) always shows the turn order ring: every player in turn order, with arrows, the active one
marked and "Your turn" on the own pill. The pills carry no life: every board of the layout shows
it already. A click on an opponent's pill brings that board to the main area with the side panel
(BRD-7) and focuses it without (BRD-3).

Every pill whose click does something carries the board icon, dim at rest and lit when that pill is
pointed at, focused by the keyboard or already focused, where it turns into the icon that brings
all the boards back; its tooltip names the action after the player and the life. Pointing at a pill
lights its opponent's column, and pointing at that column lights the pill, so the strip reads as
the control of the boards above it. The pill is the only way in, for whoever is reading those boards:
a spectator gets the same pills and the same lit pair, and no board draws a focus button of its own.

- Why: without the side panel the strip was the opponent switcher of the Standard layout (with
  life and paging arrows) and with it the turn order ring, so the same layout read two ways; the
  user asked for one, without life (2026-11-13). A button on every column said what a click does
  but took the width the status row needed, while the pill said nothing at all, so the icon and the
  lit pair moved that offer to the strip, where there is room for it (2026-11-13). A spectator kept the button
  because their pills did nothing, which left one seat focused from two different controls and the
  button back on the boards for anyone watching (user report, 25-nov-2026): the pills answer for
  them too now, since focusing a board is reading it, not playing it.

The ring never clips a name. When the band gives the row less room than it needs it gives up, in
order, its spacing and the size of its type (nothing is lost), and then the names of the seats that
are not playing, which stay as their dot and their seat colour while the seat that is playing keeps
its name whole. Which of those fits is measured against hidden rulers (`useRingFit`), never decided
by a width.

- Why: four seats with the 14-character names the server allows need more than the band has at
  1366px, and the only thing that could shrink was the active seat's name, so the player's own name
  read "Youxxxxxxxxx…" while the row spilled over the phase badges on its left. It is the same
  promise the 1v1 walkway already makes, and for the same reason: the width a name needs is a
  property of the font the platform resolves, not of the layout.
- Guard: `src/board/TurnOrderRing.test.tsx` · `src/board/TurnOrderRing.css.test.ts` · `src/board/laneFit.test.ts` · `src/board/ArenaBoard.test.tsx` · `e2e/seat-focus.spec.ts`

### BRD-38 · Opponents' hands: tucked fan facing the player, full fan in the side panel mode
An opponent's hidden hand is one pile of backs with its
count, drawn as a small fan of up to ten backs, each turned a little, with the count on it.
Without the side panel the opponent faces the player, so the fan is turned round and tucked flush
under the top strip's bottom separator (`.board-shell-top-strip`), with its upper edge hidden behind
the bar and never bleeding into it, at the size of that seat's piles (a narrow column closes it to
almost one card). It never takes its size
from the status row's height, which grows with the chip's counters and would leave one seat's hand
much larger than another's.
With the side panel (BRD-6) the fan sits upright in the bottom row of that board (BRD-39), drawn
whole wherever that row is: the main area, the board at the bottom without the panel (BRD-32) and
every copy in the panel, which is a miniature of the main area and must read like one. Nothing
clips it. A known card still shows face up and the pile
still opens the hand viewer.

- Why: a whole card back took a column's height for a number, and a stacked pile read less like a
  hand than a fan (user request, 2026-11-13). The tuck was then a sliver of about a seventh of the
  card, which in the main area read as a cut, not as a hand (user report, 23-nov-2026). Once the top
  strip moved above the opponents' row (BRD-11), keeping `.arena-opp-row` flush with the top bar's
  separator lets the tucked fan emerge cleanly from beneath the bar without a mid-air gap (user
  report, 24-nov-2026). Tucking it on a panel copy read as a cut there too: measured at 1600×900 the
  copy's fan box was 19 px tall around cards 30 px tall, so each back lost 7 px at the waist (user
  report, 25-nov-2026). Whole, the box is 27 px and the backs are painted entire.
- Guard: `src/board/HandZone.test.tsx` · `src/board/ArenaBoard.css.test.ts`

### BRD-39 · With the side panel every board is drawn like the own Arena board
With the side panel on (BRD-6), every player's board, the one
in the main area and every copy in the panel, the own and the opponents', uses the arrangement of
the own Arena board: the frameless chip at the top-left (BRD-32), the bottom row with the piles
and their captions, the floating mana and the command zone, the planeswalker zone on the right
edge (BRD-33), lands from the bottom-left piling from two, no line across the board and even lines
(BRD-35). An opponent's bottom row also holds its hand as a fan (BRD-38). The own commander is
always the last card of the own hand (BRD-34), whichever board is in the main area.

- Why: the side panel looked like another layout, with framed chips and the old arrangement on the
  opponents' boards; the user asked for the panel to be the same as the own full view (2026-11-13).
- Guard: `src/board/BoardZone.arenaOwn.test.tsx` · `src/board/SpotlightBoard.test.tsx` · `e2e/spotlight.spec.ts`

### BRD-40 · An Arena opponent's uncast commander sits beside its hand, not on its board
With no side panel, an opponent's command zone is drawn in
its status row, right after its hand and before its piles, instead of in its creatures row, and
drawn like one more card of that hand (BRD-38): half a card hanging from the top edge, turned
round, with the crown and the commander tax on the half that shows, both of them turned back so
they read. It takes no more height than the hand beside it, and a click and a hover do what they do
anywhere else. A narrow column (520 px or less) shrinks it with the piles. The creatures row keeps
that slot for creatures. With the side panel every board already
holds its command zone in its bottom row (BRD-39), and the own board puts the commander in the hand
(BRD-34).

- Why: a commander waiting in the command zone took a full card slot of the opponent's creatures
  row all game, which in a four-player pod is board space for a card nobody can play yet; the user
  asked for it to be drawn like the own one, out of the battlefield (2026-11-13). Upright and whole
  in the status row it made the row taller and pushed the opponent's lands down, so it is drawn
  like the hand beside it.
- Guard: `src/board/BoardZone.arenaOwn.test.tsx`

### BRD-41 · An attached card shows itself, not a tab with its name
A permanent that carries auras or equipment keeps them behind it, each one
peeking 28 px to the right, which is what the row reserves for it (BRD-28).
What shows in that strip is the card: its edge, its mana cost and a slice of
its art, and nothing else, because the art of each card is what tells one
attachment from the next. Pointing at a strip slides that card a little further
out and opens the usual preview, which is where the name and the text are read;
a click still picks that card, not its host.

- Why: the strip used to be a dark tab with the name written sideways, which
  named the card but hid it, and made a board of equipped creatures a column of
  labels. The user asked to see the card instead and to leave the name to the
  preview, for four more pixels and no coloured edge around it: a drawn border
  between two cards says what the two arts already say (2026-11-13).
- Guard: `src/board/OpponentZone.test.tsx` · `e2e/mechanics.spec.ts`

### BRD-42 · A card on the battlefield never shows the same number twice
These are rules about the card itself, so they hold on every board, in the main area and in the
copies, with the side panel and without it, and in both card styles.

A planeswalker's loyalty, a battle's defense and a saga's chapter have their own badge, so the
counter the server sends for them ("loyalty 7", "defense 3", "lore 2") is left out of the counter
badges, whatever the card style is. Every other counter (+1/+1, charge, poison, oil, stun…) keeps
its badge.

- Why: the board drew "+7" beside the loyalty shield and "3" beside the defense, the same number
  twice, on a card that has little room for badges. The filter existed for the compact tiles only,
  so the full board, which is where the player looks, was the one place that showed the pair
  (13-nov-2026).
- Guard: `src/board/CardSlot.compact.test.tsx`

### BRD-43 · Loyalty and defense are printed on their own plates
Like BRD-42, this is the card and not the board: it holds in every layout and card style, and in the
preview that opens under the pointer, which draws the same plates over the same corner.

A planeswalker on the battlefield carries its loyalty on the shape the card prints it on, and a
battle its defense on its shield: a vector with a light rim and the number inside it, sized from the
card's width, instead of a rounded pill with an icon beside the number. The number is sized from the
plate and not from the card, so the two always scale together, and a longer number takes a smaller
size rather than a wider box: it never reaches the edge of the shape, at any card size, in any
layout and in either card style.

- Why: the badges were generic pills, a shield icon for loyalty and crossed swords for defense,
  which said "some stat" and not which one, and the user wants the counters drawn as the game draws
  them, one kind at a time (13-nov-2026). The number first scaled from the card width while the
  plate scaled from its own clamp, so at 1366 it reached past the plate's bottom point.
  The outline comes from the Mana icon set (font under SIL OFL 1.1, styles under MIT; the symbol
  itself is Wizards of the Coast's, like the mana symbols already served from `public/symbols`),
  drawn inline so the colours come from the theme and the plate can be animated with the number.
- Guard: `src/board/CardSlot.test.tsx` · `src/board/CardSlot.compact.test.tsx` · `src/board/FloatingCardPreview.test.tsx`

### BRD-44 · A saga shows its chapters, however many it has
A saga on the battlefield carries a row of hexagons along its bottom edge, one per chapter, each
with its roman numeral: the chapters already read and the one it is on are gold, the one it is on
brighter and ringed, and the ones to come stay in the dark of the board. The count comes from the
card, not from a constant: the highest numeral of its chapter rows, its reminder text ("Sacrifice
after IV") as a fallback, and three when the rules say nothing, so a saga of four or five chapters
gets four or five hexagons. The chapter it is on is its lore counter, which is therefore not drawn
again as a counter badge (BRD-42), on the board or in the preview under the pointer, which carries
the same track.

- Why: the chapter was a counter badge with a book icon and a number, which said how many counters
  were on it but not how far along the saga was or how much was left. The user asked for the
  hexagons of the card (13-nov-2026).
- Guard: `src/board/saga.test.ts` · `src/board/CardSlot.compact.test.tsx` · `src/board/FloatingCardPreview.test.tsx`

### BRD-45 · A commander carries the Commander symbol, in gold
The badge on a commander is the Commander symbol itself, in gold on the same dark plate the loyalty
and the defense use, instead of a generic crown on a gold disc. A companion keeps its star.

- Why: the crown was a lucide icon, the same glyph the monarch designation uses, so the badge read
  as "someone's crown" and not as "this is the commander"; and a gold disc with a dark glyph was
  the one badge of the board painted the other way round (13-nov-2026).
- Guard: `src/board/CommandZone.test.tsx`

### BRD-46 · The +1/+1 and the -1/-1 counters carry their own symbol
A card with +1/+1 or -1/-1 counters shows the count and then the symbol of that counter, the banner
with the sign cut into it, centred together on the dark plate the other badges of the card use: the
count in white, the symbol in gold for +1/+1 and in red for -1/-1, and the plate ringed in the same
colour. The number is the count alone, with no sign of its own, because the symbol already carries
it, and the power and toughness badge keeps showing what the creature ends up with. Wherever a
counter is named to the player, under the pointer on the board and in the preview, it is named the
way the cards print it: the wire's "P1P1" reads +1/+1, and any other counter keeps its word.

- Why: the badge was a solid green or red pill reading "+2", so two counters of three looked like a
  value of +2 and nothing said which counter it was; the user asked for the symbols of the game,
  one kind of counter at a time, starting with these two (13-nov-2026). The symbol is taken whole
  from the Mana icon set, sign included, so the number sits beside it instead of over it, and the
  user asked for the count first and for the gold of the rest of the badges. The tooltip still read
  the engine's id, "P1P1: 2", which is not what a card says (14-nov-2026).
- Guard: `src/board/CardSlot.compact.test.tsx` · `src/board/counterName.test.ts`
### BRD-47 · Keyword badges are drawn one way: the keyword's own symbol on a square
The keyword badges a card carries (`KeywordGlyph`) are drawn one way and one way only: the symbol
of that keyword, dark, on a square of the keyword's colour with the corner radius of the other
badges of the card and no border, centred in it and the same visual weight as every other symbol:
each file is framed on the ink it paints, not on its path's bounding box, and padded so the ink
covers the same share of the square (`node scripts/ability-symbols.mjs` reports it, `--write`
fixes it: it first widens a file's viewBox to hold its whole drawing, so a symbol whose art pokes
outside it is not measured on the part that happened to fit, then centres the frame on the ink's
own box and leaves a sliver of air, so a sharp tip never lands on the edge and reads as cut). The symbol is the published vector of the game wherever there is
one (`public/symbols/abilities`, the ids listed in `glyphs/abilityArt.ts`), painted through a mask
so the colour comes from the badge; a keyword with no published symbol keeps the glyph drawn in
`glyphs/`, and none is ever an emoji. The same badge is used everywhere a keyword is named: on the
board, in the preview under the pointer, in the card inspector and in the wiki's glossary. There is
no setting to pick between sets: a stored choice from the versions that had one (coins, outline,
emoji) is ignored, and the rest of the appearance blob is read as before.

- Why: the emoji set depended on the font the system happened to have, so the same board looked
  different on each machine (2026-11-13); the circles then went square with the rest of the card
  badges, and with one way of drawing them left there was nothing to choose, so the picker went
  too; the drawn glyphs then gave way to the published symbols, which are the ones a player already
  knows from the cards. They arrived with the framing of the set, each with its own margin, so one
  symbol filled its square while another floated in it; the script above measures both the centre
  and the weight from a real render, because a path's bounding box counts geometry the fill rule
  leaves invisible (13-nov-2026).
- Guard: `src/board/CardSlot.test.tsx` · `src/board/KeywordGlyph.test.tsx` · `src/state/persistence.test.ts` · `src/settings/BoardDemo.test.tsx` · `src/board/glyphs/abilityArt.test.ts`

### BRD-48 · The width a row has to spare buys fewer lines, not empty space
When the row's card size is settled (BRD-25) and the bands still leave width unused, a band takes
fewer lines instead of leaving that width empty: the cards keep the size already solved, so a band
only unwraps when the slack pays for its whole line, and the cheapest unwrap goes first so the
slack frees as many bands as it can. Thirteen lands in two lines and eight artifacts in one, all at
the same card size, is the answer when the row has room for the artifacts' line and not for the
lands'. What is still left over stays at the far side of the row: on the own board of the Arena
layout (BRD-32) the lands and the other permanents are each as wide as their own widest line
(BRD-35), so the two groups sit side by side and the slack ends up past them, instead of being
shared out between the bands and opening a hole in the middle of the board.

- Why: on a four-player Commander board the lands and the artifacts sat in two lines each with a
  third of the row empty, because the row's height caps the card size long before its width does;
  the leftover first opened a gap between the two groups, and then, once the bands were tied to
  their own lines, a gap before the planeswalker zone. Spending it on lines costs nothing, since
  the cards do not shrink (user request, 14-nov-2026).
- Guard: `src/board/layout/solveRow.test.ts` · `e2e/kind-bands.spec.ts`

### BRD-49 · A power or toughness that is not the printed one is coloured
The power and toughness badge of a creature colours each half on its own: the number is white while
it is what the card prints, green while it is above it and red while it is below, and the slash
between them stays white whatever happens, so a creature with a +1/+0 until end of turn shows a
green power beside a white toughness. The printed values are the ones the server sends with the
card (`originalPower`, `originalToughness`), not a count of its +1/+1 counters, so an anthem, an
aura or a pump spell colours the badge just as counters do, and the badge names the printed pair in
its tooltip. A card the server sends no printed value for is left white.

- Why: the badge showed what the creature ends up with and nothing said whether that was its own
  size, so a 5/5 Champion of Lambholt read like a printed 5/5; the user asked for the changed half
  to stand out and for the slash to stay out of it (14-nov-2026). The dev tables sent no printed
  value, which is why the colours never showed there.
- Guard: `src/board/ptTrend.test.tsx`

### BRD-50 · A band with fewer lines grows into the room it leaves
A band that ends up with fewer lines than the row's tallest band draws its own cards bigger, so the
air above a single line of artifacts becomes card instead of background: the row's height says how
big a card may be at that many lines, the width still free says how big it can afford to be, the
seat's card size caps it as it caps everything else, and the growth stops a third over the row's
own size. That last bound is what keeps the row one board: the height alone would let a lone
artifact on one line be drawn twice the size of the lands in two lines beside it. The bands with
the fewest lines are served first, because they are the ones sitting in the most air, and a band
that shares the tallest line count keeps the row's size exactly.

- Why: with the lands wrapped into two lines and the other permanents on one (BRD-48), the row's
  one card size left the others band floating at the bottom of its half of the row, with air above
  it and width to its right; the user asked why the cards did not take that room, since they would
  still fit (14-nov-2026). On the four-player Commander board at 1920 that takes the other
  permanents from 80 px to 107 px, where the width runs out before the height does.
- Guard: `src/board/layout/solveRow.test.ts`

### BRD-51 · A keyword is explained on the same card wherever it is explained
Pointing at a keyword badge and reading the panel beside a card give the same thing: a plate with
the keyword's symbol on its square, the name in the keyword's own colour, the English name in grey
beside it when the board is in another language, and what the keyword does underneath. The colour
is the one the badge carries (`kw-tone`), so the chip, the rim of the plate and the name always
agree. The bubble around the plate adds nothing of its own, and the badge still names the keyword
and its summary for a reader that cannot see the plate.

- Why: the badge showed a plain tooltip with the name in bold while the panel showed a boxed row
  with a gold name, so the same keyword looked like two different things depending on where you
  read it; the user asked for one ficha, and for the panel to take the colours of the keywords
  (14-nov-2026).
- Guard: `src/board/CardSlot.test.tsx` · `src/board/FloatingCardPreview.test.tsx`

### BRD-52 · The keyword badges go in columns of four
The badges of a card run down its right edge in columns of four, and the number of columns follows
the number of badges, not the height of the card: one to four fill a single column, five to eight
open a second one towards the middle of the card, nine a third, and so on, with the first column
always where it was. Four is what keeps a column clear of the type line, so a card too short for
four badges of the usual size draws them smaller instead of breaking the group. Nothing caps the
badges a card may show other than the columns its width has room for; what does not fit becomes
the "+N" chip, which counts those columns as well.

- Why: the column grew with the card's keywords and a fifth badge would have crossed the type
  line. The first answer broke the column wherever the card ran out of height, which put four
  badges in two columns on a rival's short card; the user asked for the columns to follow the
  count, four at a time (14-nov-2026). The five-badge cap that came before this went with it: the
  room on the card is what decides.
- Guard: `src/board/badgeFit.test.ts` · `src/board/CardSlot.test.tsx`

### BRD-53 · A counter carries the symbol of the game
A counter is drawn with the symbol the game prints for it, on a player and on a card alike: poison,
energy, experience, radiation, ticket and acorn on the player chip; charge, time, stun, shield,
flame, gold, ki, verse and the rest of the published ones on a card. The symbol is painted through
a mask so it takes the colour of the badge it sits in (`public/symbols/counters`, listed in
`glyphs/counterArt.ts`), and the name is matched exactly, so a counter the game spells differently
is left alone rather than drawn as something else. A counter with no published symbol shows a plain
mark and its count, and every badge, symbol or not, names the counter and its count under the
pointer. On a card the chip is of the same family as the rest of the card's badges: a dark plate
with the number in white and the counter's colour on the rim and the symbol, the colour saying
something where the counter has one (a blue shield, an amber stun, a red flame) and the gold of
the other badges where it does not. The files are framed by `node scripts/ability-symbols.mjs counters
--write`, the same tool that frames the keyword symbols (BRD-47), which first widens each file's
viewBox to hold its whole drawing and then centres it on the ink it paints.

- Why: every counter but poison and energy showed the same sparkles, so experience, radiation,
  tickets and acorns were indistinguishable on the bar (user request, 16-nov-2026). The cards had
  the same problem, with shields and stuns drawn as a shield and a bolt of our own and everything
  else as a "+N": 21 more symbols came from the set for them, and the ones the set has none for
  (blood, quest, level and the long tail of the engine's 227 counter types) say their name under
  the pointer instead (17-nov-2026). The gold chip those counters sat on came from before the
  rework and clashed with the dark plates the board had grown into, so the chip follows the
  loyalty, defense and +1/+1 badges now, with the colour moved to the rim and the symbol. Poison, energy,
  the ticket and the acorn come from the Mana icon set; experience and radiation have no vector in
  it and come from mtg.wiki (`Exp.svg`, `Rad.svg`), whose radiation file carries its own yellow
  disc, dropped here so the trefoil can take the badge's colour.
- Guard: `src/game/PlayerInfoBar.counters.test.tsx` · `src/board/CardSlot.test.tsx`

### BRD-54 · A player's counters hang under the chip, with no box around them
The counters of a player are drawn beside the photo, the name and the life as their symbol and
their number in the counter's own colour (BRD-53), with no plate, border or background: the symbol
sits right against its number and the counters sit apart from one another, which is what tells one
from the next, and they read at the interface's small size so a number beside a symbol is
legible at a glance. A counter that changes lights its own symbol and number and sends out a
round halo; it never flashes a plate or a square ring, because the counter has no box for
either to belong to. They hang under the chip, on a line of their own under the photo,
the name and the life, and run sideways from the left edge, wrapping onto another line when there
are many: the width beside the photo belongs to the board, and the chip has the height to spare.

- Why: the counters ran along the top of the chip in one line, which on a rival's column pushed
  them clear of the photo and the name; the user asked for them to stack like the keyword badges of
  a card (BRD-52), bounded by the chip's own height, and for the boxes to go, since the colour and
  the spacing already separate them (16-nov-2026). The change animation kept drawing one: a glow
  the size of a box and a ring with a square corner around a badge that has neither, which on a
  live board read as a green rectangle floating beside the chip, and the counters were a size
  smaller than anything else on the chip (user report, 23-nov-2026).
  Stacking them in columns beside the life solved the height but spent
  width the board wanted, so they moved under the chip (user request, 23-nov-2026).
- Guard: `src/game/PlayerInfoBar.counters.test.tsx` · `src/game/PlayerInfoBar.css.test.ts`

### BRD-55 · The number on a badge stands level with its symbol
Every number the board writes inside a badge, a counter, a power and toughness, a damage mark, the
counters of a player chip and its clock, is written in the interface face, whose figures all stand
on the baseline and reach the same height, and is lifted onto the middle of its plate by the slack
its line box leaves above the digits (`--digit-shift-ui`, measured from the font at start-up and
again once the web fonts land). The display face of the board keeps the titles, the names and the
life total.

- Why: the badges were written in the display face, which draws its figures old style: a 3, a 4, a
  5, a 7 and a 9 hang below the baseline while a 6 and an 8 rise above the others, so "3" sat lower
  than "2" in the same chip and no two chips lined up, which the user saw on the +1/+1 counters
  first (17-nov-2026). Lining figures fix the dance between digits; the lift fixes the line box,
  which in both faces leaves more room above the digits than below (measured at 100 px: the
  interface face reports an ascent of 108 and a descent of 25 for an ink that reaches 71).
- Guard: `src/ui/digitShift.test.ts`

### BRD-56 · A board is not a card viewer
The cards of a seat never grow past a size of their own, whatever room the seat has: 180 px wide
for the player and 160 for an opponent with the classic card, 150 and 130 with the compact one. A
seat's card size comes from the height of its rows (BRD-25), so a board holding one land has
nothing pulling the size down and the card grows until it meets that cap; past it the row simply
keeps the space. A crowded board never reaches the cap and is left exactly as it was. The tool
that checks the board fills its rooms reads the cap from the solver instead of carrying its own
copy of the numbers.

- Why: with a single land on the table the card came out 280 px wide with the side panel open and
  260 without it, at 1920, which is larger than the preview the pointer opens and reads as a card
  viewer rather than a board (user request, 17-nov-2026). Measured on the four-player showcase, a
  full board draws its creatures at 162 px and its lands at 80, so nothing there moves.
- Guard: `src/board/layout/solveBoardLayout.test.ts`

### BRD-57 · The main area never holds a seat that is out
A player who has left or lost is never the board drawn at full size while anybody is still
playing. Their pill in the turn strip takes no click, their copy in the side panel is folded to its
head and takes none either, and neither does any other way of picking a seat. A seat that goes out
while it is in the main area hands it back at once: to the player's own board, or, when that board
is out too because the player lost or is watching, to the first seat still in the game. The seat a
spectator opens on is chosen the same way, so joining a game in progress never starts on a dead
board. When nobody is left in the game the home seat stays, because there is nothing else to show.

- Why: the spectator's home seat was the last in turn order whatever its state, so watching a game
  where that player had already lost opened on their empty board (user report, 2026-11-22). The
  fallback had the same hole from the other side: a chosen seat that died fell back to the home
  seat without asking whether the home seat was still playing.
- Guard: `src/board/spotlight.test.ts`

### BRD-58 · A seat in a game carries no rank
The chip of a player in a game shows who they are and what they hold, never how the server rates
them: no rank badge beside the name, no emblem on the photo and no rating anywhere on it. The
ranking lives in the lobby, in the ranking screen and in a player's profile, which is where
somebody goes to look it up.

- Why: the rank was the widest thing on the chip ("BRONCE I (1052)" beside a four-letter name) and
  said nothing about the game being played; the user asked for it off the chip (23-nov-2026).
- Guard: `src/game/PlayerInfoBar.test.tsx`

### BRD-59 · A commander on the battlefield wears the Commander symbol
The server marks a commander with a card icon that carries no text of its own, only the hint
`Card is commander`. That card draws the Commander symbol (BRD-45) in a coin of its own, on the
left of the row the keyword coins start on: the same size as one of those coins, ringed in the
symbol's own gold, with the symbol filling it as a keyword's art fills its coin. The coin never
rides under the badge that owns the card's top-left corner. It is never abbreviated from its hint.

- Why: the generic fallback turns an icon with no text into the initials of its hint, so a
  commander wore a badge reading "CI" (user report, 23-nov-2026). The symbol is the one the rest of
  the client already uses for a commander, in the command zone and with the hand. Drawn flat in the
  corner it was hard to pick out on a busy board, so it went into a bubble (user request,
  23-nov-2026). That first bubble was wider than a keyword coin yet its symbol filled barely half
  of it, inside a pale ring: it read as an empty circle rather than as a mark, and the card's marks
  did not line up (user report, 23-nov-2026). A card already has a vocabulary for a round mark, the
  keyword coin, so the commander wears one of those.
- Guard: `src/board/CardIcons.test.tsx`, `src/board/CardSlot.css.test.ts`

### BRD-60 · A band draws no box
The bands a board lays its cards in, the creatures row, the lands, the other permanents and the
planeswalker zone, draw no background, border, tint or halo, empty or full. The cards rest on the
mat; the only line the board draws between them is the thin fading rule between the creatures and
the other permanents.

- Why: BRD-32 had already taken the frame off the planeswalker zone in the Arena layout, but the
  box survived in the shared rules and in the other layouts, and an empty band left a soft ellipse
  behind it. On a real table they read as faint rectangles around the groups, which is the layout's
  scaffolding showing through (user report, 23-nov-2026).
- Guard: `src/board/BoardZone.css.test.ts`

### BRD-61 · A permanent says on the table which mode it was given
A permanent that chose a mode as it entered carries that mode's name as a badge on the card, beside
its other designations (BRD-52), with the full line in its tooltip. The engine writes the choice
into the card's text as an info line ("Chosen mode: Mardu"), so until now it could only be read by
opening the card.

- Why: a modal enchantment on the table gave no sign of which half of it was live, and the player
  had to right-click every one of them to tell (user report, 23-nov-2026).
- Guard: `src/board/designations.test.ts` · `src/board/CardSlot.test.tsx`


### BRD-62 · The phase ladder sits inline beside the turn counter in the top strip
The turn's steps are a single horizontal row of ten icons beside the turn counter at the left of the
top control strip (BRD-11), and nowhere else: there is no text phase strip and no second ladder above
the action button. All ten steps sit inline in one row: upkeep, draw, the first main phase, the five
combat steps (begin, attackers, blockers, damage, end) grouped together in an inline combat pill so
nothing drops down over the opponent's hand, the second main phase and the end step; the two main
phases are the biggest and carry distinct I / II diamond glyphs, with a progress rail behind the row
filling up to the current step. Cleanup lights the end step icon. The step being played is lit in the
active player's seat colour and briefly swells when it changes, the steps already played are dimmed,
and a step the ladder does not show (untap) lights nothing; both combat damage steps light the damage
icon. The row always speaks about the turn being played: a click on a step toggles its stop for that
turn (on an opponent's turn, the opponent-turn stop), and a right click (or a touch long-press)
toggles the other turn's stop. Each icon shows both turns at once: an aligned notch under it when the
turn shown stops there, and a corner dot in the other seat's colour when the other turn does. A step
with no stop (attackers, blockers, damage) lights up as a non-interactive indicator (`is-static`) and
takes no click, and a spectator, who has no stops, sees the row but cannot change it. The icons carry
no text code: hovering or focusing a step opens an instant styled tooltip below the ladder with the
step's name, both turns' stops and a stop/smart-stop hint, and the accessible name carries the same
information. The stops are the one `phaseStops` setting (SET-11).

- Why: the user asked for the phase selector to be MTG Arena's SVG icon ladder with no text strip
  (24-nov-2026), moved it beside the turn counter in the top strip, and then asked for all steps
  including combat to run inline in one row so no combat flyout covers the opponent's hand below it
  (same day). Arena's row edits the stops of the turn on screen, so the right click keeps the other
  turn one gesture away.
- Guard: `src/game/ladderSteps.test.ts` · `src/game/PhaseLadder.test.tsx` · `src/dev/galleryFixtures.test.ts` · `e2e/phase-stops.spec.ts`
