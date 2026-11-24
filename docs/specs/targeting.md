# In-board targeting

Prefix: `TGT`

Choosing targets on the board itself: what is marked and clickable while a `GAME_TARGET` is open,
the targeting bar, the arrows, stack targets and player targets. The legal targets are the
prompt's options (`targetIds` in `web/src/game/GameScreen.tsx`); the click dispatch lives in
`web/src/board/useBoardPresenter.ts` and the marks in `web/src/board/CardSlot.tsx`. Which prompts
block and how card grids pick are in `prompts.md` (PRM-1, PRM-4 to PRM-7); the zone rings and the
pile that opens by itself are PRM-8.

### TGT-1 · A target choice without a card list is made on the board
A `GAME_TARGET` that carries no card list opens no dialog: a bar in the dock names the source
(the spell or ability asking), says what to choose and, for multi-target choices, how many are
picked so far; the hint is announced to screen readers. The legal targets are marked on the board
and a click on one answers the prompt. When the targeting ends, nothing stays marked.

- Why: the player reads the board to choose a target, so the board stays the picker
  (`5378774879`, non-modal action bars for mana and targeting; PRM-1 keeps plain targeting
  non-blocking).
- Guard: `e2e/targeting.spec.ts` · `src/game/feedbackModes/promptBars.test.tsx`

### TGT-2 · Required targets call for attention; optional and chosen ones do not
A target the player must choose pings a gold ring every 1.5 s while the choice is pending. A
target of an optional choice (the player may finish without it) keeps a static gold border and
never animates. A target already chosen loses the ring and shows a static chosen border. Opponent
pills follow the same split, and a targetable player bar pulses three times, not forever.

- Why: the old infinite pulses competed and became noise, and the player could not tell a required
  target from an optional one (`docs/plans/2026-10-16-game-animations.md` C1, shipped in
  `1474248e1d` and `dadd98c2ae`).
- Guard: `src/board/CardSlot.test.tsx`

### TGT-3 · A target click is acknowledged at once and sent once
Clicking a target marks it as chosen-pending immediately, before the server answers. Further
clicks on the same target are ignored until the server's echo confirms it (or 3 s pass without
one). Once the server reports it chosen, clicking it again sends it again, which un-chooses it.

- Why: the latency work of plan4 §5.4 (`791af62e87`) made every click acknowledge in under
  100 ms. The engine keeps only the latest answer that arrives while it is busy, and re-sending a
  chosen UUID removes it (`docs/lessons.md`, multi-card choices), so a double click would undo the
  pick.
- Guard: `src/board/CardSlot.test.tsx` · `e2e/latency.spec.ts`

### TGT-4 · A click on a legal target picks it
While a target is being chosen, a click on a legal target sends it as the target, even when the
same card is also playable or a mana payment would otherwise take the click. Only a combat
selection (declaring attackers or blockers) comes before it.

- Why: so that the player's click answers the open question instead of starting another action
  with the same card.
- Guard: `src/board/useBoardPresenter.test.ts`

### TGT-5 · A legal target can be picked wherever the board shows it
A legal target is marked and clickable in every place the client draws it: the battlefield, the
hands, the hand viewer, the graveyard and exile piles, the floating looked-at / revealed /
companion viewers, the stack and the player bars. Cards in those places that are neither a target
nor playable take no click.

- Why: the graveyard/exile/library viewer never received the targets, so a card there could not
  be chosen (`8290f779a4`); the floating viewers had the same gap (issue #3, `0aa005cf3a`,
  `docs/lessons.md`).
- Guard: `src/board/PileOverlay.test.tsx` · `src/game/InfoWindows.test.tsx` · `src/board/HandViewer.test.tsx` · `src/board/HandBar.test.tsx`

### TGT-6 · A legal target is never folded into a group
Piles that collapse identical permanents (lands, tokens) leave a legal target out as its own card.
The player always clicks the exact object the server will receive. The stack folds nothing into
anything any more (STK-4), so this is a rule about the battlefield now.

- Why: on the stack, so that the targeting click stayed per entry (`90b4c9be46`), until the
  cascade stopped folding at all; on the battlefield, the review in `8fbb005e7b` ("stacks exclude
  targets and attachments").
- Guard: `src/board/BoardZone.battlefield.test.tsx` · `src/board/stackGroups.test.ts`

### TGT-7 · A target on the stack brings the stack into view
When a legal target is a spell or ability on the stack (a counterspell, Stifle), the stack is in
view. It is always on the board now (STK-2), so what this asks for is narrower than it used to be:
a stack the player had pushed aside comes back by itself. Only the eligible objects are marked,
they stay marked while the stack moves, and clicking one sends the stack object's id.

- Why: added in v0.2.7 (`1d104eef17`), so that a counterspell's target is on screen without the
  player hunting for the stack tab; the tab and the deck are gone, the grip is not.
- Guard: `src/game/stackTargeting.test.ts` · `src/board/StackZone.test.tsx` · `e2e/stack-target.spec.ts`

### TGT-8 · Players are targeted on their own bar
When a player is a legal target ("any target", "target player"), that player's info bar is marked
and takes the click, and in multiplayer the opponent's pill in the opponent switcher does too.
Your own pill in the switcher is never a target; your own bar is.

- Why: parity with the desktop client's targetable avatar (`PlayerPanelExt`, see
  `web/COMPONENT_PARITY.md`); "any target" prompts include both players (`docs/lessons.md`).
- Guard: none yet (no test clicks a player bar or a pill during a target choice; `targeting.spec`
  only checks the opponent is among the legal ids)

### TGT-9 · Arrows show what each spell points at
An arrow runs from an object on the stack to each of its targets, drawn from the card the object
is. Which objects draw one is STK-3: the one about to resolve and the one under the pointer, in
every layout, so a long chain never becomes a thicket. While a choice is open, an arrow also runs
from the source to each target already chosen.

- Why: arrows were added in `09f8b123bd`, filtered to the top and the hovered object in the Table
  layout only; the cascade made that the rule everywhere (`ROADMAP.md` §4).
- Guard: `src/board/CombatArrowsOverlay.test.tsx` (the source-to-chosen arrow during a choice is
  not asserted)

### TGT-10 · An arrow is drawn over the board, not under it
The arrow layer sits above everything the board itself paints: the phase strip, the player chips,
the zone piles and the badges on a card. It still passes under what is deliberately in front of
the board, a card lifted out of the hand, the menus and the dialogs.

- Why: an arrow that disappears behind a strip of chrome does not say who is attacking whom, which
  is its whole job; it was drawn at `z-index: 28`, under the phase strip and the piles, with an
  exception that lifted it only while the stack drawer was open.
- Guard: `src/board/CombatArrowsOverlay.test.tsx` · `e2e/game-menu-overlay.spec.ts`

### TGT-11 · An arrow is a beam that points, not a ladder of dashes
An arrow is one colour the whole way, ending in a notched dart, with a dark seam under it where it
crosses the board. Nothing marches, nothing fades and nothing glows: the direction is in the dart.
A halo was tried under the beam and taken out again, and so was a gradient along it.

- Why: the arrows were dashed strokes animated forever, which read as a ladder and told the
  direction only by watching them move; a gradient along the beam was tried first and read as the
  arrow fading out rather than as a direction. A capture of the board was also never reproducible,
  because the dash phase depends on the instant of capture and on the path's sub-pixel length, and
  WebKit does not freeze it; the reduced-motion rule existed only to make screenshots settle. The
  halo went the same way: over a board of card art it read as a smear around the beam.
- Guard: `src/board/CombatArrowsOverlay.test.tsx` · `e2e/arena-chrome.spec.ts`
### TGT-12 · An arrow leaves over the top of its source and comes in under its target
Every arrow leaves what is acting through its top edge and arrives at what it points at through
the bottom edge, whatever is acting: a spell or an ability on the stack, an attacker, a blocker. The
curve rises out of the source and comes up into the target, so neither end crosses its own card and
the dart is always read arriving from below. An arrow between two objects on the stack, which lie
over each other, swings out past the cascade's left edge and rises into the bottom corner of the
covered card that stays in view.

- Why: the arrows were anchored on the line between the two centres, trimmed by a fixed inset, so
  the same pair of cards gave a different entry point as either one moved and the dart could sit on
  the card's own art. A first fix brought every arrow in over the target's top and sent the stack's
  out of the bottom of its card; with the stack's bubble under the cascade (STK-9) that crossed the
  bubble's text, and it was not what the user had asked for: any card that targets has its arrow
  leaving through the top, and any card that is targeted has it arriving through the bottom, as in
  MTG Arena (2026-11-23).
- Guard: `src/board/CombatArrowsOverlay.test.tsx`
