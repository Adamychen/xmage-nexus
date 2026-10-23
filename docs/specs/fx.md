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
a re-render with the same state starts nothing.

- Why: plan §1 ("animate only when the underlying value actually changes, never on every
  `GAME_UPDATE`"); `4b3228b639` kept initial hands, full refreshes and mulligans still.
- Guard: `src/board/useDrawSlide.test.tsx` · `src/board/useTokenPop.test.tsx` · `src/board/useUntapWave.test.tsx`

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
by this queue; a new game drops whatever was held.

- Why: `5dd25ca220`. The transition engine still diffs the real game; only the rendered stack is
  held (`stackHold.ts`), so the board never disagrees with the server once the queue drains.
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
The banner names the turn and its active player when the turn changes, on the first view of that
turn with a phase, never for the mulligan view. On turn 1 it waits for the coin (FX-9). A banner
still pending when its game ends or another game starts is dropped instead of firing in the next
one.

- Why: `e30ae35277` tied the banner to the first phased view so it still appears when the turn
  number does not change after the mulligan; the drop guard came with the bounded timers of
  `8fbb005e7b`.
- Guard: `src/board/gameTransitionEngine.resolve.test.ts` · `src/board/gameTransitionEngine.timers.test.tsx` · `src/board/coinFlipFx.test.ts`

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
