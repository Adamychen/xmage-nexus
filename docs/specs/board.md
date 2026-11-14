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

### BRD-2 · Planeswalkers, sagas and battles get their own zone in the creatures row
Non-creature planeswalkers, sagas and battles sit in their own band at the right end of the
creatures row, beside the creatures band, drawn with the gold marquee frame. The row is split the
way BRD-1 splits the other row: the bands share one card size and each band's width follows what
its cards need at that size (BRD-26). The marquee band is never narrower than one of its cards and
never wider than its cards need (the width left over goes to the creatures). The sizes come from
the board's single layout function (BRD-25), so no band reads a size another band chose. They never stack with each other, each shows
its own loyalty, lore or defense, and a seat without any has no marquee band, so the creatures
band keeps the whole row. A seat with only marquee permanents (no creatures, no commander) still
has a creatures row: it is the row that holds them. The own board of the Arena layout (v1 chrome)
gives this zone the right edge of both rows instead (BRD-33).

- Why: the column at the right edge (issue #23, part 3) copied the smallest card size of the
  bands beside it, and the bands measured their room after the column: each one resized the
  other every frame, so a board with one planeswalker kept resizing forever (user report,
  2026-10-29; reproduced at 1366×900 with 6 creatures and 7 lands: about 180 style changes per
  second). A band of its own in the creatures row has no such dependency, and the user chose it.
- Guard: `src/board/BoardZone.kindColumns.test.tsx` · `src/board/bandWeights.test.ts` · `src/board/layout/solveRow.test.ts` · `src/board/marquee.test.ts` · `e2e/kind-bands.spec.ts`

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
With it on, in the Arena and Table layouts, a player (not a spectator) with at least one opponent
still in the game — a duel, a game that started as one, or a pod down to two — sees one board at
full size in the main area — their own when the game starts —
and every other seat in a panel on the right edge of the board, one copy per seat, top to bottom
in turn order starting after the player. A copy is the whole board of that seat (status row,
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
starts on the seat the column view draws at the bottom for a spectator (the last in turn order),
the panel holds every other seat in turn order after it, and a seat whose hand the spectator may
see shows it in the main area as the column view does. In a duel the Arena preference keeps the
Arena layout while the switch is on (with it off a duel is drawn on the Standard board, as before),
so the mode stays when a pod is down to two and in games that start with two players. With the
switch off or in Standard or Pod, the board is drawn as BRD-3…BRD-5 describe (or as the duel board);
turning the switch on or off mid-game takes effect at once and never drops an open prompt.

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
  With one copy in a duel its box used to stretch to the panel's whole height around a much smaller
  board; the user asked for each box to keep the table's proportions at the panel's width, and for
  the panel to scroll when the copies do not fit (user report, 2026-11-12).
- Guard: `src/board/ScaledCopy.test.tsx` · `src/board/SpotlightBoard.test.tsx` · `src/board/cardOverlays.test.ts` · `src/board/spotlight.test.ts` · `src/game/GameScreen.test.tsx` · `src/state/persistence.test.ts` · `e2e/spotlight.spec.ts`

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
revealed top of the library) or a card in it the current prompt can target. The own board of the
Arena layout draws its piles at the bottom-left with a caption instead (BRD-32), and an opponent's
column draws them at the right of its status row (BRD-36).

- Why: players coming from MTG Arena, EDHPlay or paper look for the piles next to the board (issue
  #23); the chips stay in the column mode, where the Table layout chose them.
- Guard: `src/board/BoardZone.pileCards.test.tsx` · `src/board/SpotlightBoard.test.tsx` · `src/game/ResourceBar.test.tsx` · `e2e/spotlight.spec.ts`

### BRD-13 · The panel can be resized
The panel's left edge can be dragged to change its width between 15% and 35% of the board width
(22% by default). The width is a player setting (`boardSpotlightPanel`), kept across games, and the
copies rescale while dragging: a copy spans the panel's width (BRD-6), so a wider panel makes every
copy larger, and the panel scrolls vertically once they no longer fit its height. A copy never
scrolls sideways.

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
a transform only: it is drawn above the battlefield, and the battlefield does not move. The own
board of the Arena layout (v1 chrome, with or without the side panel) reserves the same height as
its bottom row (BRD-32).

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

### BRD-20 · Piles hold five; token piles open after a second of hover
Three or more identical permanents pile up (two lands are enough on the own board of the Arena layout, as
in MTG Arena, BRD-32), five to a pile at most: twelve Treasures are piles of five, five
and two, and a sixth token left alone stays a single card. Lands follow the same five-card limit. A pile is
drawn as its top card with each other copy a dim edge just behind it, and the count badge in the corner.
With a mouse, a token pile fans out only after the pointer has rested on it for one second, and only that
pile; a touch fans it out at once. While a token pile is fanned out the large hover preview is hidden, so
it never covers the fanned cards. A land pile fans out as soon as the pointer enters. A fanned pile closes as
soon as the pointer moves over anything outside it, even when the browser never reports that the pointer left.

- Why: a board of tokens (dozens of Treasures or Soldiers) spread each pile across the row, and passing the
  pointer over a pile fanned it out and pushed its neighbours aside. A pile that holds still and opens on a
  deliberate hover keeps the board readable while every token stays selectable (2026-10-26).
  A land pile stayed open while the pointer rested on the mana rock it had pushed aside (CI, 2026-10-31):
  when the card under the pointer is redrawn as the pointer leaves, React reports no leave for the pile, so
  the pile also watches pointer moves while it is open.
- Guard: `src/board/stackGroups.test.ts` · `src/board/StackPile.test.tsx` · `e2e/stack-groups.spec.ts`

### BRD-21 · A board settles: no card size keeps changing for ever
Once a board has been drawn and nothing changes (no new game view, no window resize, no hover),
no band, marquee or zone changes its card size or its number of lines again: the sizes are written
once per change of input and then stay. This holds for a board drawn at a window size and for a
board already on screen whose window is then resized, with the browser's scrollbars visible. A
compact hand in a status row (an opponent's hand) takes no height of its own: the row's height
comes from the rest of the row, the hand stretches to it and sizes its cards from it in one step.
The guard sweeps every board layout (Standard, Pod, Arena, Table) with 2 and 4 seats, boards of
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
  2 changes tolerated) stayed green. The board is now sized by one pure function (BRD-25).
- Guard: `src/board/HandZone.test.tsx` · `e2e/board-settle.spec.ts` · `e2e/board-spotlight-settle.spec.ts`

### BRD-22 · The phase dial shows the steps of combat
On the phase dial (v2 chrome) the combat pip keeps its place on the arc, and five small circles
sit outside it on a short arc of their own, in order: beginning of combat, declare attackers,
declare blockers, combat damage (first strike and regular damage are one circle) and end of
combat. They are always shown. During combat the circle of the current step is lit like the
active pip, the ones already passed this turn are dimmed like past pips, and the combat pip stays
lit for the whole combat. Each circle is 26 px and carries a two-letter mark, the same marks the phase bar
uses (BC, AT, BL, DM, EC), in text no smaller than 10 px (ACC-3), and has the step's full name as its tooltip and accessible
name. While the game is in combat, the phase name shown with the dial names the step too
("Combat · Blockers"), so the current step can be read without decoding the marks. No
circle is clipped by the dial's box or by any element around it. The beginning and end of combat circles toggle the stop of that step (click for the own
turn, right-click or Shift+click for the opponent's, with the same stop dots as the pips); the
other three have no stop in XMage and are not buttons. The circles never overlap each other, a
pip or the centre, and the whole dial still fits its dock corner (BRD-14).

- Why: the dial showed combat as one pip, so a player could not tell whether the game was
  waiting on attackers, blockers or damage (user request, 2026-10-29); the user chose small
  circles beside the combat pip over ten pips on the arc, which would not fit the corner.
- Guard: `src/game/PhaseDial.test.tsx` · `e2e/game-ui-v2.spec.ts`

### BRD-23 · A fanned pile never covers the permanents beside it
A pile fanned out on hover spreads to the right of its own first card and pushes the permanents after it
aside. It never moves left over the permanents before it: when the band leaves no room on the right, the fan
compresses instead.

- Why: the fan slid left to stay inside the band when the pile sat near the right edge, so it covered the
  tapped lands in front of it (reported 2026-10-30). The rule already written in `StackPile` ("a mana rock
  beside a land pile is never covered") was not enforced.
- Guard: `src/board/stackSpread.test.ts` · `e2e/land-fan.spec.ts`

### BRD-24 · The playable-from-other-zones overlay wraps its cards and scrolls down, never sideways
The list of cards playable from the graveyard, exile or another zone lays its cards out in rows that
wrap to the width of the overlay, and the list scrolls vertically. A long list (ten cards in the
graveyard) never needs a sideways scroll on a desktop or a phone screen.

- Why: the list was one row at a fixed 760 px, so ten cards spread over 2 300 px and the player had to
  slide sideways to see them all (reported 2026-10-30).
- Guard: `e2e/cross-zone-layout.spec.ts`

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
permanents in the other row in the Arena and Table layouts) use one card size: the largest, up to
the seat's cap, at which every band of the row fits its cards in at most three lines inside the
row's width and height. Each band is then as wide as its cards need at that size, and the width
left over is shared in proportion to that need, unless a band takes fewer lines than the row is
tall for and grows its own cards into the room it leaves (BRD-50). So a band never shrinks to the floor or scrolls
while a band beside it in the same row keeps room it does not use. Only when not even the floor
size fits does the row stay at the floor and the bands that overflow scroll (BRD-27). Rows of the
same seat may use different sizes.

- Why: measured 2026-11-01 on a 4-seat Table board at 1000 px, the creatures band of the own seat
  was 38 px wide (the floor) for seven creatures, scrolling 294 px of content, while the marquee
  band beside it kept 122 px for one planeswalker: each band fitted itself inside a width that
  flex had already handed out.
- Guard: `src/board/layout/layoutEngine.test.ts` · `src/board/layout/solveBoardLayout.test.ts` · `e2e/board-resize.spec.ts` · `e2e/board-fill.spec.ts`

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
On the classic interface (v1) the action button shows "Waiting for <name>" while another player
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
not scaled with the board: the seat colour, the player's name (cut with an ellipsis when it does not
fit) and their life with a heart, updated with every game view. The head of the player whose turn
it is carries a turn badge and a gold edge. A click on the head brings that seat to the main area,
as a click on the copy does (BRD-7). The board in the main area has no head: its own status row is
already readable.

- Why: a scaled copy is a few hundred pixels wide, so its own status row is too small to tell whose
  board it is or how much life they have; the user asked for the name and life on each box, as
  EDHPlay shows them (user report, 2026-11-12). The look follows the panel, not EDHPlay's.
- Guard: `src/board/SpotlightBoard.test.tsx`

### BRD-32 · The own Arena board is framed around the hand
On the Arena layout with the v1 chrome, the own board, with or without the side panel (BRD-6),
keeps the battlefield clear of everything around it. The player chip sits at the top-left corner
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
- Guard: `src/board/BoardZone.arenaOwn.test.tsx` · `src/board/layout/solveRow.test.ts` · `src/board/stackGroups.test.ts` · `e2e/spotlight.spec.ts`

### BRD-33 · The own planeswalkers take the right edge of both rows, as in MTG Arena
On the own board of the Arena layout (BRD-32) planeswalkers, sagas and battles (BRD-2) take a zone
at the right edge that runs from the top of the creatures row down to the bottom of the lands row,
starting at the top, and the lands row leaves that width free. One card stands alone; two or more
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
- Guard: `src/board/layout/solveRow.test.ts`

### BRD-34 · The uncast own commander is the last card of the hand
On the own board of the Arena layout (BRD-32) with the fanned hand, the commander and the companion
in the command zone are drawn as the last cards of the hand fan, apart from it by a gap of 0.4 of
a card and with a gold edge. Their cost bubbles (HND-6) already include the commander tax: the tax
is generic mana, so it adds to the cost's generic pip (`{2}{R}{R}` with a tax of 2 reads
`{4}{R}{R}`) or becomes one in front of the coloured pips (`{G}{W}{U}{B}` reads
`{2}{G}{W}{U}{B}`), after `{X}` when the cost has one, and it grows with every cast. A first cast
and a companion show the printed cost. A click casts them as a click on the command zone does. Emblems and planes stay in the
bottom row of the board, at the right of the hand. With the hand as a column or a row, the
command zone stays on the board as before.

- Why: in the middle of the board the uncast commander took room from the creatures; the user
  asked for MTG Arena's Brawl arrangement, the commander as a hand card set apart (2026-11-12). The
  tax drawn in the card's corner sat below the board edge in the hand, a "+" drawn next to a pip did
  not read against the gold edge, and a separate "+N" still had to be added up by eye.
- Guard: `src/board/HandBar.test.tsx` · `src/board/commanders.test.ts` · `src/board/BoardZone.arenaOwn.test.tsx`

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
On the Arena layout with the v1 chrome and no side panel, every opponent column keeps its place
facing the own board and shows its library, graveyard and exile as small piles at the right end of
its status row, instead of chips: each one half a card, smaller than the own piles, with a caption
with its name and count. The opponent's board is mirrored vertically, so the piles hang from the
top edge with the caption under them, and the cards are turned round: the half that shows is the
top of the card, upside down, as the rest of a mirrored board would be. The captions always use the
short names ("Lib", "GY"): the same row also holds the chip, the hand and the commander (BRD-40),
and three long captions push the piles onto a second line that eats the battlefield. A click opens the same
viewer, and a pile glows in the same cases as the own (BRD-12). At phone width the columns keep
their chips.

- Why: the own board got its piles with captions (BRD-32); the user wanted the opponents to show
  theirs the same way, smaller, as long as they fit (2026-11-12, checked at 1920, 1366 and 390 px
  with three opponents). At 1366 a column with counters on the chip wrapped its status row and the
  piles landed on the lands, hence the short names and no wrapping.
- Guard: `src/board/BoardZone.arenaOwn.test.tsx`

### BRD-37 · The Arena layout shows the same turn order strip with and without the side panel
On the Arena layout with the v1 chrome, the strip in the divider (or in the top bar with the side
panel) always shows the turn order ring: every player in turn order, with arrows, the active one
marked and "Your turn" on the own pill. The pills carry no life: every board of the layout shows
it already. A click on an opponent's pill brings that board to the main area with the side panel
(BRD-7) and focuses it without (BRD-3).

Every pill whose click does something carries the board icon, dim at rest and lit when that pill is
pointed at, focused by the keyboard or already focused, where it turns into the icon that brings
all the boards back; its tooltip names the action after the player and the life. Pointing at a pill
lights its opponent's column, and pointing at that column lights the pill, so the strip reads as
the control of the boards above it. The pill is the only way in: those boards draw no focus button
of their own (a spectator, whose pills do nothing, keeps it).

- Why: without the side panel the strip was the opponent switcher of the Standard layout (with
  life and paging arrows) and with it the turn order ring, so the same layout read two ways; the
  user asked for one, without life (2026-11-13). A button on every column said what a click does
  but took the width the status row needed, while the pill said nothing at all, so the icon and the
  lit pair moved that offer to the strip, where there is room for it (2026-11-13).
- Guard: `src/board/TurnOrderRing.test.tsx` · `src/board/ArenaBoard.test.tsx` · `e2e/seat-focus.spec.ts`

### BRD-38 · Opponents' hands: half a card facing the player, a fan in the side panel mode
On the Arena layout with the v1 chrome, an opponent's hidden hand is one pile of backs with its
count, drawn as a small fan of up to ten backs, each turned a little, with the count on it.
Without the side panel the opponent faces the player, so the fan is turned round and only its top
half shows, hanging from the top edge of the column, at the size of that seat's piles (a narrow
column closes it to almost one card). It never takes its size from the status row's height, which
grows with the chip's counters and would leave one seat's hand much larger than another's.
With the side panel (BRD-6) the fan sits upright in the bottom row of that board (BRD-39), on the
board in the main area and on the copies, showing only its top half like the own resting hand, so it
covers nothing. A known card still shows face up and the pile
still opens the hand viewer.

- Why: a whole card back took a column's height for a number, and a stacked pile read less like a
  hand than a fan (user request, 2026-11-13).
- Guard: `src/board/HandZone.test.tsx`

### BRD-39 · With the side panel every board is drawn like the own Arena board
On the Arena layout with the v1 chrome and the side panel on (BRD-6), every player's board, the one
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
On the Arena layout with the v1 chrome and no side panel, an opponent's command zone is drawn in
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
These are rules about the card itself, so they hold in every layout (Arena, Table and Standard,
with the side panel and without it) and in both card styles, not only on the Arena board.

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
fixes it). The symbol is the published vector of the game wherever there is
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
- Guard: `src/board/CardSlot.test.tsx` · `src/board/KeywordGlyph.test.tsx` · `src/state/persistence.test.ts` · `src/settings/BoardDemo.test.tsx`

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
