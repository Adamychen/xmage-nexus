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
- Guard: `src/board/stackCascadeFit.test.ts` · `src/board/StackZone.test.tsx` · `e2e/game-ui-v2.spec.ts`

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
- Guard: `src/board/StackZone.test.tsx` · `src/game/GameDrawer.test.tsx` · `e2e/game-ui-v2.spec.ts`

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

### STK-6 · Who controls an object is said on the object
Each card on the stack carries a chip with its controller's name, and so does the preview the
pointer opens. It is read from the object's own controller, or from its source card when the object
is an ability, and a watcher is never told that someone else's spell is theirs. When neither says,
the chip says so rather than guessing.

- Why: on a shared pile the only question that cannot be answered by the card itself is whose it
  is, and a spectator seeing "You" over a player's counterspell is worse than no chip at all.
- Guard: `src/board/StackZone.test.tsx`
