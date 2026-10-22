# The hand

Prefix: `HND`

The player's own hand is drawn by `web/src/board/HandBar.tsx` (the fan; `HandRail.tsx` and
`HandRow.tsx` are the optional column and row), mounted once per board by `BoardShell.tsx`. Other
players' hands are `HandZone.tsx` rows inside their `BoardZone`, with `HandViewer.tsx` for the cards
this client knows. The guiding principle: **the hand is always at hand but never in the way** — it
costs no board space, reads at a glance, and the server alone decides what a card in it can do.
Picks from the hand for a prompt are PRM-4 and the keep/mulligan bar over the raised hand is PRM-2
(`docs/specs/prompts.md`).

### HND-1 · Your hand is a fan tucked under the bottom edge of the board
The own hand is a fan of overlapping cards floating over the bottom edge of the board: it takes no
layout space (your battlefield reaches the bottom of the board), the cards arc (the edges tilt
outward, the middle rises) and at rest only their top half shows. Pointing at any card lifts the
whole fan to about 90% visible. The empty strip around the cards does not catch clicks, so what
lies under it stays usable. In a 1v1 pod the fan spans the whole bottom row.

- Why: the Arena-style overlay (`10d84d4073`) keeps the player zone at full height instead of
  pushing the battlefield up to make room for the hand.
- Guard: `src/board/handSizing.test.ts` · `src/board/HandBar.test.tsx` · `e2e/hand-bar.spec.ts`

### HND-2 · A growing hand spreads first and shrinks last, between the side panels
As cards are added the fan spreads across the width it has (at most 1100 px) while every card
keeps its size; only when each card would show less than 35% of its width do the cards shrink,
down to a 64 px minimum. A bigger hand never gets bigger cards. The fan lives in the centre band
between the bottom-left player panel (with its mana pool) and the command wheel on the right, and
never covers either.

- Why: the sizing solved for a pitch the CSS never rendered, so 15 cards collapsed into ~195 px of
  a 1008 px bar with 92 px cards (`ac89f94a5b`); the spread hand then covered the mana pool row and
  the command wheel, so the band is measured from the panels (`77b4dc20b6`).
- Guard: `src/board/handSizing.test.ts` · `src/board/HandBar.test.tsx` · `e2e/hand-width.spec.ts` · `e2e/hand-bar.spec.ts`

### HND-3 · Pointing at a hand card grows it in place, with no floating preview
The card under the pointer straightens and grows until it is legible (about 260 px wide, never
taller than 55% of the window, and always at least a little), keeping its bottom edge where it was
so the pointer never leaves it. Its neighbours slide aside, each keeping a strip to move onto, and
the rest of the fan dims. Own hand cards get no separate floating preview; battlefield cards still
do. Only the painted card reacts to the pointer, never the part sunk below the edge or the space
above the fan.

- Why: so the card being read stays under the pointer and nothing else is painted over the board.
  The own hand used a floating preview (`57653890f0`) until the hand bar rework (`a64c4d08d2`).
- Guard: `src/board/handSizing.test.ts` · `e2e/hand-bar.spec.ts`

### HND-4 · Playable cards stand out, and a click hands the card to the server
A card the server lists as playable sits slightly higher in the fan and glows softly; a card that is
the target of the current prompt pulses gold. Clicking a hand card sends it to the server, which
decides what it means (play it, cast it, pick it): the client neither predicts nor blocks it.
Animations stop under reduced motion.

- Why: the server owns every rule (ROADMAP "Zero Rules Re-implementation"), so the hand only shows
  what the server offers and forwards what the player picks.
- Guard: `src/board/HandBar.test.tsx`

### HND-5 · Dragging rearranges your hand, and the order you chose sticks
Pressing a card and moving it more than a few pixels drags it to a new place; the rest of the fan
slides around it and dropping it never counts as a click, while a press that does not move is a
plain click. The arrangement survives every update: cards that leave the hand drop out, and new
cards join on the right in the order the server sent them. Dragging only rearranges; it never plays
a card.

- Why: the hand reorder came with `ad1b687c24`; the order is kept client-side so that each server
  update does not undo the player's arrangement.
- Guard: `src/board/HandBar.test.tsx` · `src/board/handOrder.test.ts`

### HND-6 · Printed costs float over the hand cards, unless the player turns them off
Each card in the fan shows its printed mana cost as bubbles poking out above its top-right corner:
one bubble per symbol, both halves for a split card, none for a land or a face-down card, and one
bubble size for the whole hand, scaled to the cards. It is the printed cost, never a reduced one, because the server
does not send that. The Appearance setting *Cost symbols in hand* removes them, and the rendered
card style never draws them.

- Why: a packed cost (`{2}{G}`) drew one broken bubble (`4090bf3d4f`); and issue #12 asked for the
  bubbles to be optional, since the card image already shows the cost (`39f397d6f1`).
- Guard: `src/board/HandBar.test.tsx` · `src/board/handSizing.test.ts`

### HND-7 · Fan, column or row: the player picks the layout, the opening hand is always a fan
Besides the fan, the hand can be a column at the left of the board or a scrollable row of whole
cards; the two are exclusive, and both show every card whole (readable as text with the rendered
card style) and mark the playable ones. The
opening-hand decision always shows the raised fan (PRM-2). The column gives way to the fan while
the side panel is open, and comes back when it closes.

- Why: the column makes the hand readable at once and moves the board instead of covering it, and
  the fan stays for the mulligan (`fee20914ce`); the row is the third option (`febb74f9a3`); the
  column and the side panel do not fit together (ROADMAP §4.3c).
- Guard: `src/board/HandRail.test.tsx` · `src/board/HandRow.test.tsx` · `e2e/game-ui-v2.spec.ts`

### HND-8 · An opponent's hand shows its size face down and what you know of it face up
An opponent's hand row shows one back per card in hand. Cards this client knows (revealed by an
effect, watched with permission, or in a hand you control) show face up in it, the backs after
them. In a pod the backs collapse into one ×N stack as soon as there are two, with the known cards
kept face up beside it; a hand that is entirely face up never collapses. In the Table layout the row
is replaced by the hand badge of HND-9 and the stack only appears while the hand is the target of
an effect, because it carries the target highlight.

- Why: the hand size is public information and revealed cards stay known; a pod has no room for a
  row of backs per opponent (`6eaceab068`); the Table layout moved the hand to the portrait badge
  (`47ec51c1f9`).
- Guard: `src/board/HandZone.test.tsx` · `e2e/pod-bands.spec.ts` · `e2e/reveal.spec.ts`

### HND-9 · A known opponent hand opens in a viewer
Clicking a pod's hand stack, or in the Table layout the hand badge on the portrait (eye icon,
`known/total`), opens the hand viewer: the known cards numbered from #1, then one numbered back per
unknown card. The stack opens it even when nothing is known. Only a known card that is a target or
playable reacts to a click; the viewer closes with its close button or Escape.

- Why: the grimoire-style viewer for an opponent's hand (`6eaceab068`); in the Table layout a hand
  with known cards opens from its badge (`47ec51c1f9`).
- Guard: `src/board/HandViewer.test.tsx` · `src/board/HandZone.test.tsx` · `src/board/ArenaBoard.test.tsx` · `e2e/pod-bands.spec.ts` · `e2e/game-ui-v2.spec.ts`

### HND-10 · While you control another player, one button switches the hand you see
When you control another player (Mindslaver), the server sends their hand and a Switch Hands button
appears on your side of the board. It swaps your fan for their hand, named on the button, and a
click on one of their cards acts for them; the same button switches back. When the controlled hand
is no longer sent, the client switches back by itself. An opponent's zone never shows the button.

- Why: acting on a controlled turn (`4fba86bc77`); the button is mounted above the fan because the
  fan intercepted its click and in 1v1 the hand never changed.
- Guard: `src/board/handSwitch.test.ts` · `src/board/BoardZone.handSwitch.test.tsx` · `src/board/GameBoard.control.test.tsx` · `src/state/store.test.ts`

### HND-11 · Clicking a hand card never moves the board
Focusing or clicking a hand card, even one that peeks below the board edge, never scrolls the board.

- Why: the board containers were scroll containers, so a clicked hand card was scrolled into view
  and shifted the whole board up by up to ~100 px with no way back (`0ab8316a85`,
  `docs/lessons.md`).
- Guard: `e2e/board-scroll.spec.ts`

### HND-12 · The client shows how many cards a player holds, never a maximum hand size
Hand counts are always shown, but no maximum hand size is: the server's player view does not carry
it. The discard down to hand size in the cleanup step is the server's own prompt, answered in the
hand (PRM-4).

- Why: `PlayerView.maxHandSize` is triaged as an accepted engine-to-view gap with no channel
  (`web/src/state/engineViewRegistry.ts`, `35995d0a63`).
- Guard: none yet (nothing asserts that no limit is shown; the gap itself is held by the
  `engineViewCoverage.test.ts` baseline)
