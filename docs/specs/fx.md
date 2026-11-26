# Board FX and animations

Prefix: `FX`

Board animations are driven by `web/src/board/gameTransitionEngine.ts`, which diffs the previous and
the next game view, plus per-component hooks (`useDrawSlide`, `useTokenPop`, `useUntapWave`, …) and
the fixed FX overlays (`web/src/board/*Overlay.tsx`). Motion preferences live in
`web/src/board/fx.ts`. The guiding principle: **an animation answers "what happened?" and never
stands between the player and the game**. How the FX layer stacks against dialogs is DLG-1 and
DLG-7 (`dialogs.md`). The design history is `docs/plans/2026-10-16-game-animations.md`.

### FX-1 · Turning effects off stops every animation, in every screen
With the effects setting off, the document root carries `html.fx-off` and no CSS animation or
transition runs anywhere: in a game, in the lobby, in the deck screens. The JS-driven effects
(flights, the coin, the draw slide, token pops, the untap wave, source pulses) do not start at all,
so nothing is left to wait for.

- Why: `4b3228b639` added the single global `html.fx-off` rule and moved `applyFxRoot` to `App`;
  before, it ran only inside the game screen, so the lobby ignored the setting.
- Guard: `src/board/fx.test.ts` · `src/board/gameTransitionEngine.test.ts` · `src/board/coinFlipFx.test.ts` · `src/board/useDrawSlide.test.tsx` · `src/board/useTokenPop.test.tsx` · `src/board/useUntapWave.test.tsx` · `src/board/KeywordAura.css.test.ts`

### FX-2 · Reduced motion drops the movement and keeps short fades
When the system asks for reduced motion, nothing moves: no flight, no spin, no shake, no scale, no
wave. Feedback that is only a change of opacity still plays, capped at 150 ms, so the player still
sees that something changed (the coin fades instead of spinning, a drawn card or a new token fades
in). Durations are not zeroed for those fades.

- Why: plan §2 made this the single rule after the draft contradicted itself ("0 ms or opacity" in
  one section, zeroed duration tokens in another); `4b3228b639` split `fxMotionDuration` from
  `fxOpacityDuration` to implement it.
- Guard: `src/board/fx.test.ts` · `src/board/gameTransitionEngine.test.ts` · `src/board/CoinFlipOverlay.test.tsx` · `src/board/useDrawSlide.test.tsx` · `src/board/useTokenPop.test.tsx` · `src/board/useUntapWave.test.tsx` · `src/board/KeywordAura.css.test.ts` · `e2e/game-feel.spec.ts`

### FX-3 · Animation speed is a player setting
The player picks half, normal or 1.5x speed (`FX_SPEEDS`); every client-timed animation divides
its duration by it, and none gets shorter than 60 ms. Speed only scales: it never turns an
animation off, which is the effects switch's job (FX-1).

- Why: so that a player who finds the board slow or busy can tune it without losing the
  information the animations carry; plan §2 settled that "off" is a separate boolean, not a speed
  of 0.
- Guard: `src/board/fx.test.ts`

### FX-4 · Animations never hold up play
While any animation runs the board stays clickable: a card in flight does not delay passing
priority or the next click. Overlays are visual only. A reload in the middle of an animation leaves
nothing hanging: no hidden slot, no half-entered card, no orphan flight.

- Why: plan §1 ("never block input while an animation runs"); the e2e guards came with the game-feel
  pass (`791af62e87`).
- Guard: `e2e/game-feel.spec.ts`

### FX-5 · Only a real change animates
An animation plays when the value it shows changes between two views, never because a view
arrived or a component mounted. The opening hand, a full hand refresh and the mulligan do not
slide; tokens already on the battlefield at mount do not pop; cards already untapped do not wave;
a re-render with the same state starts nothing. A token created on the battlefield was never in
any zone, so it does not fly in from anywhere: it pops in its own slot, as in MTG Arena, while a
card that enters from the hand, the stack, the graveyard or the exile still flies from there.

- Why: plan §1 ("animate only when the underlying value actually changes, never on every
  `GAME_UPDATE`"); `4b3228b639` kept initial hands, full refreshes and mulligans still. A new
  permanent with no known origin was flown in from the hand, so a token rose like a played card
  and then popped on top of that (user report, 26-nov-2026).
- Guard: `src/board/useDrawSlide.test.tsx` · `src/board/useTokenPop.test.tsx` · `src/board/useUntapWave.test.tsx` · `src/board/gameTransitionEngine.test.ts`

### FX-6 · A hit shows when it lands
Combat strikes start when combat damage is dealt, never while attackers or blockers are being
declared. A creature's damage and a player's life keep their previous value on screen until the
strike or the spell projectile aimed at them lands, then change with the hit, however late the
strike runs; a strike that never lands lets go after a 3 s safety net. A strike whose animation
ends before its impact still shows the hit. When several attackers hit the same player, the whole
loss shows on the first hit. With effects off nothing is held, and a frozen (rewound) view shows
the real game.

- Why: `94c95017d1` (the life counter dropped before the attacker even moved) and `5dd25ca220` (the
  same for spell hits). The real server usually sends no frame for the damage steps, so damage is
  detected by the transition crossing them (`docs/lessons.md`, Web client). Release on the landing,
  not on a clock: under CI load the strike's timers ran ~1 s late and the life still dropped on the
  planned 280 ms (`combat-strikes.spec.ts` red as `life,hit,hit` on five branches).
- Guard: `src/board/useCombatHeld.test.ts` · `src/board/damageHold.test.ts` · `src/board/combatStrikes.test.ts` · `src/board/projectileFx.test.ts` · `src/board/gameTransitionEngine.resolve.test.ts` · `e2e/combat-strikes.spec.ts`

### FX-7 · Spells leave the stack one at a time
When several spells leave the stack in one update, they resolve on screen one after another: each
stays visible while its projectiles fly and it exits to its zone, and the next starts only after
the previous one is done plus a short beat (120 ms). A spell still on the stack is never removed
by this queue; a new game drops whatever was held, and so does a fresh screen: the hold lives in
module state, so a remount must not inherit a spell from the previous instance, even when it comes
back with the same game id. A resolution that never reports back is released by a 2.5 s watchdog,
and a burst beyond six queued resolutions drops the rest instead of replaying them: after a
reconnect or a hidden tab the board has already moved on, and animating the backlog would keep old
spells on the stack for seconds.

This only applies while the stack is being **resolved**. A stack can also be **replaced**: a
rollback rewinds it, a Karn restart empties it inside the same game, a resync hands over a fresh
one. Nothing resolved in any of those, so nothing is held and nothing flies. A resolution takes
objects off one at a time and so always leaves one of the previous ids behind unless the stack is
now empty, which makes "non-empty and sharing no id with the one before it" the reading of a
replacement (`isStackReplacement`).

- Why: `5dd25ca220`. The transition engine still diffs the real game; only the rendered stack is
  held (`stackHold.ts`), so the board never disagrees with the server once the queue drains. The
  replacement case came from the gallery, where switching between two stack states played a
  resolution for each spell of the first: six cards drained out of the cascade over 1.8 s, and in a
  game the same shape would animate spells that never resolved.
- Guard: `src/board/stackHold.test.ts`

### FX-8 · Only heavy spells slam, and only when they resolve
A spell of mana value 5 or more, or any mythic, is heavy; 7 or more, or a mythic of 5 or more, is
epic, with a bigger quake. Abilities weigh nothing. The slam fires when the spell resolves: a
permanent when it lands on the battlefield, an instant or sorcery when it reaches the graveyard or
exile. A countered spell or a cast cancelled back to hand never slams.

- Why: XMage puts a spell on the stack before targets and costs are chosen and auto-payment settles
  the cast within milliseconds, so neither moment reads as one to the player (`docs/lessons.md`,
  Web client); `c9ae83a3cd` moved the slam from 320 ms after resolution to the card's landing.
- Guard: `src/board/impactFx.test.ts`

### FX-9 · The starting-player coin runs once, at the real start of the game
The coin that shows who plays first spins once per game, on the first view with turn 1 and a phase
and step set (after the mulligan), and lands on the active player's name. A client whose first view
is mid-game (a spectator, a reconnect) never sees it. It is skipped with effects off and only fades
under reduced motion. Its layering against dialogs is DLG-7.

- Why: the server never sends the real flip result, so the first player is the active player of
  that view (`2916b985f4`); it never sends a turn-0 view either, and the first trigger waited for
  one and never fired in real games (`e30ae35277`).
- Guard: `src/board/coinFlipFx.test.ts`

### FX-10 · The turn banner announces each new turn once
The banner names whose turn it is when the turn changes, on the first view of that turn with a
phase, never for the mulligan view. On turn 1 it waits for the coin (FX-9). A banner still pending
when its game ends or another game starts is dropped instead of firing in the next one.

It names the player, not the turn number, which the strip already carries: a label reading
"Turno de" over the name of whoever is playing, and for the viewer's own turn the name is dropped
for "Tu turno" and the band takes the board's gold instead of the blue another player gets. A
spectator controls nobody, so every turn reads as somebody else's. The band is a layer across the
whole window, not a part of a seat, so it reaches each player on their own screen whatever board
they have in the main area. Two rules open from the centre, the band lights between them, a
specular pass runs along it and the name settles out of a blur, every part on the one duration the
effects speed sets.

While a dialog covers the board the turn passes unannounced: the banner is dropped, never queued
for when the dialog closes.

- Why: `e30ae35277` tied the banner to the first phased view so it still appears when the turn
  number does not change after the mulligan; the drop guard came with the bounded timers of
  `8fbb005e7b`. It read "Turno 11 · Pablo" on a grey band, which says what the strip says and does
  not land as an announcement; the user asked for the shape every other client of this game uses,
  where the name is the headline (user request, 23-nov-2026). Queueing it behind a dialog would
  announce a turn that had already moved on, so a covered board gets no banner at all.
- Guard: `src/board/gameTransitionEngine.resolve.test.ts` · `src/board/gameTransitionEngine.timers.test.tsx` · `src/board/coinFlipFx.test.ts` · `src/board/feedbackFx.test.ts` · `src/board/FeedbackOverlay.test.tsx` · `src/game/feedbackModes/boardOrder.test.tsx`

### FX-11 · Board effects stay inside the style system
FX colours come from `web/src/ui/tokens.css` (`--mana-*-rgb`, `--ember-rgb`, …), never from
literals; the app-wide style ratchet (`styleTokens.test.ts`) refuses new literal colours. Effects
animate `transform` and `opacity` only, and on a card they use the independent `translate` and
`scale` properties, so a tapped card stays tapped through every hover and effect. A looping status
effect lives on a child element, never on the card slot.

- Why: `docs/lessons.md`, Web client: the tap rotation lives in `transform`, so an effect writing
  `transform` straightened tapped cards; an infinite animation on the slot froze the hover lift or
  erased the target glow.
- Guard: `src/board/KeywordAura.css.test.ts` · `e2e/tapped-rotation.spec.ts` (the colour part is
  held by the app-wide `styleTokens.test.ts` ratchet, which does not carry the id)

### FX-12 · Every animation has a gallery entry that replays it
Each animation has its own entry in the dev gallery (`#/gallery`, group "Animaciones") with a
Replay control that runs it through the real engine, and a real-browser spec presses Replay and
reads the computed `animationName`, so an effect that is wired but silently overridden fails.

- Why: `4b3228b639` gave every animation state its own entry and action. jsdom does not apply the
  CSS cascade: the countered and fizzle effects never played on the new stack because a later
  stylesheet won, and only the real-browser check caught it (`5359c64366`, `docs/lessons.md`).
- Guard: `src/dev/galleryFixtures.test.ts` · `e2e/animations-play.spec.ts`

### FX-13 · A card in flight wears the picture it had on the board
A flying card shows the same image the card was showing where it left from. The card cache answers
asynchronously, so a card whose art was not already loaded would spend its whole flight as a grey
plate with its name written on it; the board it is leaving had the picture on screen, so the
registry that already remembers where a card was also remembers what it was wearing, and the
flight borrows that.

- Why: a spell resolving off the stack flew as an empty frame reading "Lightning Bolt", which is
  the one moment the card most needs to be recognisable. It only showed for cards whose art had
  not been drawn yet, so it looked intermittent.
- Guard: `src/board/cardPositionRegistry.test.ts`


### FX-14 · A spell flying to the stack is handed over where it lands
A spell cast onto the stack flies there as a clone, and the card it is flying to is not drawn on
the cascade while the clone is in the air: from the first frame its place is empty, and it is shown
the instant the clone lands on it, already in place underneath while the clone fades out over it.
The flight only starts two frames after the view is drawn, so the object is marked as an arrival
while the view renders (`primeStackArrivals`), and an object that is marked but never flown shows
itself a tenth of a second later with the entry animation it would have had.

- Why: the card was dealt onto the cascade, taken away again two frames later, and then dealt a
  second time 150 ms after the clone had already vanished, sliding in from the side as if a second
  copy were arriving. Measured against the gallery's entry animation: the clone landed at 1050 ms
  and the card only appeared at 1290 ms, from 38 px away.
- Guard: `src/board/stackLinks.test.ts` · `src/board/StackZone.arrival.test.tsx`

### FX-15 · Two unrelated views are never diffed
Animations are the difference between one view and the next of the same game. When the screen is
handed a view of a different game, nothing is compared: whatever is in the air is dropped and the
new view is simply drawn. The store's game id is what tells two games apart, and the state gallery
hands the screen one fixture after another under a single id, so it says so itself
(`forgetPreviousView`). The card positions go blind for a moment around the swap as well, because
two fixtures share the ids of the cards they are built from and each card would otherwise fly in
from wherever its namesake stood.

- Why: switching between two gallery entries dealt a flight for every card the two had in common,
  including three Lightning Bolts shrinking into nothing, and ran the resolutions the previous
  entry's stack was still holding. The gallery is also how every animation is reviewed, so a bug
  that only shows there still shows on everything else.
- Guard: `src/board/cardPositionRegistry.test.ts` · `src/board/gameTransitionEngine.timers.test.tsx`

### FX-16 · A tap slide starts from the place the board gave the card, never from mid-air
When a tap regroups a pile the cards it displaced slide in from where they were, and "where they
were" is the position the layout had given them, not wherever an animation had them at that instant.
The reference is read with any slide the card is carrying taken back out: the one this animation is
playing and the lunge an attacker or a blocker holds in CSS. A card whose only movement is such an
offset has not changed place and is not animated at all.

- Why: the reference was the plain bounding box, taken on every commit, so a commit landing in the
  middle of a slide recorded a transient position and the next tap animated that card in from a
  place it had never occupied. The user saw cards moving and returning "very fast, and it looks
  random" (25-nov-2026). The jump that report started from was the chip reserve (BRD-21); this is
  the other half, and it is what made the movement look arbitrary rather than like a regroup.
- Guard: `src/board/useTapFlip.test.ts`
