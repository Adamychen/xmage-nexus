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
outward, the middle rises) and at rest about seven tenths of each card shows: its art, its name
and its type line, with only the rules box tucked under the edge. Pointing at any card lifts the
whole fan to about 90% visible. The empty strip around the cards does not catch clicks, so what
lies under it stays usable. In a 1v1 pod the fan spans the whole bottom row.

- Why: the Arena-style overlay (`10d84d4073`) keeps the player zone at full height instead of
  pushing the battlefield up to make room for the hand. The resting fan used to sink 56% of each
  card under the edge, which cut them across the middle of the art and read as a bad crop rather
  than as a tucked hand (user report, 23-nov-2026).
- Guard: `src/board/handSizing.test.ts` · `src/board/HandBar.test.tsx` · `e2e/hand-bar.spec.ts`

### HND-2 · A growing hand spreads first and shrinks last, between the side panels
As cards are added the fan spreads across the width it has (at most 1100 px) while every card
keeps its size; only when each card would show less than 35% of its width do the cards shrink,
down to a 64 px minimum. A bigger hand never gets bigger cards. The fan lives in the centre band
between your piles (library, graveyard, exile) on the left and the action button on the right, and
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
Each card in the fan shows as bubbles above its top-left corner what casting it costs now,
in the strip the next card leaves uncovered: one bubble per symbol, both halves for a split card,
none for a land or a face-down card, and one bubble size for the whole hand, scaled to the cards. A
cost too long for the strip stacks its bubbles until it fits, and spreads them again on the grown
card. For the commander in the command zone that includes its tax (BRD-34); no other modifier is in
it, because the server does not send a card's modified cost, and the printed cost stays on the card
image. The
*Cost symbols in hand* setting (`Settings → Board`, Card overlays) removes them, and the rendered
card style never draws them.

- Why: a packed cost (`{2}{G}`) drew one broken bubble (`4090bf3d4f`); and issue #12 asked for the
  bubbles to be optional, since the card image already shows the cost (`39f397d6f1`). At the
  printed top-right corner each cost was drawn over the next card in the fan, so Cultivate's
  `{2}{G}` read as the cost of the card beside it. The bubbles say what the card costs to cast,
  since the printed cost is already on the card's own image (user decision, 2026-11-13).
- Guard: `src/board/HandBar.test.tsx` · `src/board/handSizing.test.ts` · `e2e/board-overlays.spec.ts`

### HND-7 · Fan, column or row: the player picks the layout, the opening hand is always a fan
Besides the fan, the hand can be a column at the left of the board or a scrollable row of whole
cards; the two are exclusive, and both show every card whole (readable as text with the rendered
card style) and mark the playable ones. The
opening-hand decision always shows the raised fan (PRM-2). The column gives way to the fan while
the chat and log panel (PNL-10) is open, since that panel lies over it, and comes back when it closes.

- Why: the column makes the hand readable at once and moves the board instead of covering it, and
  the fan stays for the mulligan (`fee20914ce`); the row is the third option (`febb74f9a3`); the
  column and the chat and log panel cannot share the left edge (ROADMAP §4.3c).
- Guard: `src/board/HandRail.test.tsx` · `src/board/HandRow.test.tsx` · `e2e/arena-chrome.spec.ts` · `src/game/GameScreen.test.tsx`

### HND-8 · An opponent's hand shows its size face down and what you know of it face up
An opponent's hand row shows one back per card in hand. Cards this client knows (revealed from
that hand by an effect, watched with permission, or in a hand you control; HND-13) show face up in
it, the backs after them. In a pod the backs collapse into one ×N stack as soon as there are two,
with the known cards kept face up beside it; a hand that is entirely face up never collapses.

- Why: the hand size is public information and revealed cards stay known; a pod has no room for a
  row of backs per opponent (`6eaceab068`).
- Guard: `src/board/HandZone.test.tsx` · `e2e/reveal.spec.ts`

### HND-9 · A known opponent hand opens in a viewer
Clicking an opponent's hand opens the hand viewer: the known cards, then one back per unknown card,
with no position numbers (BRD-24). The stack opens it even when nothing is known. Only a known card that is a target or
playable reacts to a click; the viewer closes with its close button or Escape.

- Why: the grimoire-style viewer for an opponent's hand (`6eaceab068`).
- Guard: `src/board/HandViewer.test.tsx` · `src/board/HandZone.test.tsx`

### HND-10 · While you control another player, one button switches the hand you see
When you control another player (Mindslaver), the server sends their hand and a Switch Hands button
appears on your side of the board. It swaps your fan for their hand, named on the button, and a
click on one of their cards acts for them; the same button switches back. When the controlled hand
is no longer sent, the client switches back by itself. An opponent's zone never shows the button.

- Why: acting on a controlled turn (`4fba86bc77`); the button is mounted above the fan because the
  fan intercepted its click and in 1v1 the hand never changed.
- Guard: `src/board/handSwitch.test.ts` · `src/board/BoardZone.handSwitch.test.tsx` · `src/board/ArenaBoard.control.test.tsx` · `src/state/store.test.ts`

### HND-11 · Clicking a hand card never moves the board
Focusing or clicking a hand card or one of your pile cards, even one that peeks below the board
edge, never scrolls the board.

- Why: the board containers were scroll containers, so a clicked hand card was scrolled into view
  and shifted the whole board up by up to ~100 px with no way back (`0ab8316a85`,
  `docs/lessons.md`). The Arena zone kept `overflow: hidden`, so focusing a pile card at the
  bottom-left moved the own board up 182 px (24-nov-2026).
- Guard: `e2e/board-scroll.spec.ts`

### HND-12 · The client shows how many cards a player holds, never a maximum hand size
Hand counts are always shown, but no maximum hand size is: the server's player view does not carry
it. The discard down to hand size in the cleanup step is the server's own prompt, answered in the
hand (PRM-4).

- Why: `PlayerView.maxHandSize` is triaged as an accepted engine-to-view gap with no channel
  (`web/src/state/engineViewRegistry.ts`, `35995d0a63`).
- Guard: none yet (nothing asserts that no limit is shown; the gap itself is held by the
  `engineViewCoverage.test.ts` baseline)

### HND-13 · Only a revealed window named for a hand puts cards in that hand
A card from `GameView.revealed` shows face up in an opponent's hand only when its window is named
for that player's hand (`Cards in <name>'s hand`, what Telepathy and the other
play-with-hand-revealed effects open). Every other window is named after the effect that opened it,
carries no owner and holds cards that are not in anyone's hand: the top of a library, the piles of
a Fact or Fiction, a hand a Duress already read into its own window. Those stay out of every hand
row and show in the revealed window of their own (`src/game/infoWindowState.ts`), as they do in the
desktop client. A hand you control and a hand you watch are unaffected: they arrive keyed by
player.

- Why: `revealed` is the whole game's list, the same for every player
  (`GameView`/`GameState.getRevealed()`), so copying it into each opponent's hand painted the same
  cards face up in several hands at once in a pod; one function now answers "what do I know of this
  hand", for the hand row and for the reveal animation alike.
- Guard: `src/board/revealedCards.test.ts`

### HND-14 · The opening hand is dealt before it is asked about, and waits for the question
In the pre-game (the view carries no phase and no step: the starting-player choice and the
mulligans) the hand bar holds the cards back until the opening-hand decision is on screen, the keep
or mulligan question and the London cards to put back. The question is remembered for the hand it
was asked about: after a keep the cards stay up while the other seats decide, and after a mulligan
the new hand waits for its own question instead of being dealt in sight and asked about seconds
later. A seat that only watches has no hand to hold back, and a game already
running is untouched, because its view carries a phase.

- Why: the cards reached the hand a good while before the mulligan screen did, and a player saw
  seven cards with nothing asking anything about them (user report, 25-nov-2026). The server deals
  at `GAME_INIT` and asks in a later `GAME_ASK`, so the gap belongs to the client to close. The
  consequence to know: a client that arrives in the middle of the pre-game, a reconnection after
  its own keep, has never been asked, so its bar stays empty until the game starts. Remembering the
  question for the game rather than for the hand had the mulligan show its new seven, then close
  and reopen the screen over them a moment later (user, 2026-11-26). The view says
  nothing that tells that apart from a hand just dealt, and the cards are not playable either way.
- Guard: `src/board/openingHand.test.ts`
