# The stack

Prefix: `STK`

The stack is drawn on the board itself (`web/src/board/StackZone.tsx`, sized by
`web/src/board/stackCascadeFit.ts`), as the pile of cards it is. It is not a panel, a tab or a
list: the objects on it are cards, lying over each other, and the one in front is the one about to
resolve. How a spell flies onto it and how it leaves is FX (`fx.md`: FX-7 one at a time, FX-14 the
hand-over where it lands); the arrows it draws to its targets are TGT-10 and TGT-11
(`targeting.md`).

### STK-1 · The stack is a cascade of cards, sized by the room it has
Each object on the stack is drawn as its card, whole and readable. The one that resolves next is in
front, at the bottom right, and every object under it is offset up and to the left by a sliver of
its own width and height, turned a little further, the way a pile splays when it is pushed. The
card size and the offsets come from the room the cascade is given, never from a constant tuned on
one screen, and that room is measured on a box of its own: the cascade sets its own width and
height from the answer, so measuring itself would be measuring its own answer. Past six objects the
tail is folded away and counted on the front card, because a seventh sliver carries nothing a
number does not carry better.

- Why: the stack was a list of rows with a header and a tab in the drawer, which said what was on
  the stack but never showed it. BRD-54 had already paid for the measurement trap on the player's
  counter stack, and the cascade walked into it twice more before the room became a box.
- Guard: `src/board/stackCascadeFit.test.ts` · `src/board/StackZone.test.tsx` · `e2e/arena-chrome.spec.ts`

### STK-2 · It is a layer over the board, and it can be pushed aside
An empty stack draws nothing at all: no box, no panel, no line saying it is empty. A stack with
something on it is a layer over the board, in the same place in every layout, with no menu to open
and no tab to find. It does lie over the board's own cards, and that is the deal: being in view the
moment something is cast is worth more than the cards it covers, and the grip on its edge is what
pays for it, pushing the whole thing aside and bringing it back without closing it and without
losing what is on it. The board is not squeezed to make room, because that would move every card
on it each time something is cast. What the stack never covers is the dock: the button the player
is about to press is not a card they can look at later.

- Why: a stack you have to open is a stack you read after the moment has passed. The grip is what
  pays for always being in view, and it stands clear of the turned cards' corners so it never sits
  on one.
- Guard: `src/board/StackZone.test.tsx` · `src/game/GameDrawer.test.tsx` · `e2e/arena-chrome.spec.ts`

### STK-3 · Only two objects point at their targets
The object about to resolve always draws its target arrows, and so does the one under the pointer.
Nothing else does. A stack pushed aside draws none at all: the point of pushing it is to see what
was underneath, and an arrow reaching for a card that has moved is the worst of both.

- Why: every arrow at once is a thicket nobody reads, and the two that matter are the one resolving
  next and the one you are asking about.
- Guard: `src/board/StackZone.test.tsx`

### STK-4 · Identical spells are not folded into one
Three copies of the same spell are three cards on the stack, each drawn on its own, because each
one resolves on its own. Nothing is collapsed into a row with a count.

- Why: the old timeline folded identical entries into `×N`, which read as one object and hid the
  fact that each copy resolves separately. On the battlefield a pile is a pile (TGT-6); the stack
  is an order of resolution.
- Guard: `src/board/StackZone.test.tsx`

### STK-5 · The card under the pointer stays where it is
Hovering an object on the stack does not lift it, grow it, turn it or move the cards around it.
What the pointer opens is the preview beside the stack, and the card stays exactly where it was so
the pile never rearranges itself under the hand.

- Why: a cascade is read by its edges. A card that grows or rises covers its neighbours' slivers,
  which is the one thing the shape is for.
- Guard: `src/board/StackZone.css.test.ts` · `src/board/StackZone.test.tsx`

### STK-6 · Who controls an object is said with the object
The object being read carries a chip with its controller's name at the head of its bubble (STK-10),
and so does the preview the pointer opens. It is read from the object's own controller, or from its
source card when the object is an ability, and a watcher is never told that someone else's spell is
theirs. When neither says, the chip says so rather than guessing.

- Why: on a shared pile the only question that cannot be answered by the card itself is whose it
  is, and a spectator seeing "You" over a player's counterspell is worse than no chip at all. The
  chip moved from the card's art to the bubble so that nothing of ours is drawn over a card
  (2026-11-23).
- Guard: `src/board/StackZone.test.tsx`

### STK-7 · The text of the object is read, not guessed
An ability on the stack is its text: the card under it is only the art of the source that made it.
So that text is read in the bubble (STK-10), and so is a spell's: nothing is written over the card,
which is drawn whole as the printed image. The text is never cut to a fixed number of lines; what
does not fit scrolls.

- Why: the plate over the card was 10 px with a three-line clamp, so the ability that is about to
  resolve was both small and cut off (user report with a screenshot, 2026-11-22). The stack card
  frame that drew the text inside a card of our own was set aside for the bubble (branch
  `feat/stack-card-frame`): the user preferred the printed image with the text beside it
  (2026-11-23, mockup https://claude.ai/artifact/XEhy954NqPRyZGfndeoSmd).
- Guard: `src/board/StackZone.test.tsx` · `src/board/stackEntries.test.ts`

### STK-8 · An object reaches the stack from where it came
A spell flies to the cascade from the card that was cast: the hand it left, or the zone it was
cast from. A triggered or activated ability is a new object with an id of its own and no past, so
it flies from the card that made it, the source the view names (`sourceCard`), which is still on
the board where the player can see it. An object whose source nobody has drawn (a card the client
never saw) eases in where it lands, as before.

- Why: every ability simply appeared on the stack, so nothing tied it to the permanent that
  triggered it and a player had to read the name to find out what had gone off (user request,
  23-nov-2026).
- Guard: `src/board/stackLinks.test.ts`

### STK-9 · The text says what will happen
The bubble's text is read from what the server sends, not from the printed card: an ability shows
its own text; a modal spell shows only the modes that were chosen, without the "Choose…" header or
the modes left out; an announced X is the last line, `X = n`; the lines the server appends for its
own panel (target on the stack, related objects, hints) are not shown, because the target arrow
already says them.

- Why: the printed card already shows the printed text, so the bubble is worth its place only if it
  says what this object will do. The X value comes as a card icon, not in the text, so it is its own
  line rather than a number guessed into the sentence.
- Guard: `src/cards/frame/stackCardText.test.ts`

### STK-10 · The text hangs under the cascade in a bubble, open until it is folded away
Under the cascade hangs a speech bubble whose tail points at the front card. Its head is a single
strip: the controller chip, an ability mark, a "Copy" chip, the object's name and a chevron. It
comes open, reading the object about to resolve, and the strip is what folds it away and what
brings it back; nothing else does, so the pointer crossing the stack never folds or unfolds it. A
fold is undone by the next stack: pushing the stack aside or running it out leaves none behind.

What the pointer moves is which object is read: the card under it, a card behind the front one
included, and it keeps reading the card last hovered for a moment after leaving, so the pointer can
cross from the card to the bubble; then it falls back to the object about to resolve. The card
being read that way is ringed and the tail slides to point at it, so it is plain which card the
text belongs to. Its height is the room measured between the cascade and the dock, never a number;
past that it scrolls. When there is no room for it there, it lies over the front card's own lower
half instead, because the only part of the screen it may cover is the stack itself: never the
board, never the dock.

- Why: the user liked the bubble of the mockup but not that it covered the board, and chose it
  under the cascade rather than beside it (2026-11-23). It read as folded and opened on hover at
  first; the same day the user asked for the opposite, since what an object is about to do is the
  reason the stack is on screen and asking for it every time is a click to read the thing you were
  already looking at. Under the cascade it is as wide as the card, so it stays out of the middle of
  the board.
- Guard: `src/board/StackZone.test.tsx` · `src/board/StackZone.css.test.ts`

### STK-11 · The whole stack opens in the zone viewer
Beside the cascade, under the grip that pushes it aside, a button with the number of objects on the
stack opens all of them in the zone viewer of the graveyard and the exile (BRD-24), in the order the
cascade shows them: the object about to resolve at the right and on top, marked #1, and the ones
that resolve later to its left, each with its position and the name of its controller (and a mark
when it is an ability). The cascade only draws as many cards as fit; the viewer
draws every one, and when its fan cannot hold them all it opens slid to the right end, on #1, with
the objects that resolve later in the pile at its left. An object the prompt can target is ringed there and a click on it chooses it, as in
the cascade. The button stays on screen while the stack is pushed aside, and the viewer closes when
the stack empties.

- Why: a long stack folds behind the "+N" of its front card and the cards it does draw only show
  their title strip, so a deep chain could not be read; the user asked for a button to see it like
  the graveyard (24-nov-2026).
- Guard: `src/board/StackZone.test.tsx`

### STK-12 · The stack viewer says what the object being read does and aims at
Beside the fan of the stack viewer (STK-11), over the dimmed board, a panel reads one object: the
one about to resolve when the viewer opens, then the one under the pointer or the keyboard focus.
It shows the object's name and the server's text, as the bubble does (STK-10), and, under
"Targets", what it aims at, the way MTG Arena shows a spell's target beside it: a card on the
battlefield or in any other zone is drawn as that card; a player is named in their seat colour; an
object on the stack is named by its place ("#2 · on the stack") and ringed in the fan. The fan keeps
clear of the panel, so no card slides under it.

- Why: the arrows that say what a stack object aims at are drawn over the board, which the viewer
  dims and covers; the user asked to see the target card beside it, as MTG Arena does, or marked
  when it is on the stack (24-nov-2026).
- Guard: `src/board/StackZone.test.tsx`
