# Game animations plan

Date: 2026-10-16. Status: **Implemented for v1, pending real-table verification** — every item in P0, P1 and P2 is done except the v2 items (B1 and C2 on `feat/game-ui-v2`) and D1/D2 (dropped). Checklist in section 6; every item is reachable from the dev gallery (`#/gallery`, group "Animaciones").

Condensed from the Spanish draft `animaciones.md` at the repo root. The draft's header said
"COMPLETO", which referred to the written plan, not to the code. Nothing in section 4 is
implemented beyond what section 6 marks as in progress.

Applies to the shared game board (`web/src/board/`, `web/src/game/`) under both the v1 layout
(`master`) and the v2 layout (`feat/game-ui-v2`, flag `gameUi`).

## 1. Goals and principles

Problem: the game UI is functional but static at the moments that matter. The player cannot
quickly tell whether a click was sent, which phase it is, who holds priority, or whether they
must act. The result is that players read the log instead of the board.

Goals:

1. Clarity: each animation answers "what happened?" or "what do I have to do?".
2. Feedback under 100 ms: every player action gets a visual response before the server echo.
3. Hierarchy: animate only what matters; everything else stays still.
4. One implementation for v1 and v2: change the shared layer, not two copies of the chrome.
5. Accessibility: respect reduced motion and the user's effects setting (section 2).
6. Performance: 60 fps with 20+ permanents; `transform` and `opacity` only.

Rules:

- Three levels: (1) player actions (cast, target, pass) always animate; (2) state changes
  (phase, turn, priority) animate unless a level-1 animation is running; (3) ambient effects
  (low life, hover) only when nothing else is running.
- At most two animations at once in the viewport. Never block input while an animation runs.
- Animate only when the underlying value actually changes, never on every `GAME_UPDATE`.
- Infinite loops are not used for feedback. The one allowed repeat is the target beacon (C1),
  and only while a choice is pending.

## 2. Reduced motion and effects off (single rule)

This section is the only source of truth for motion preferences. It replaces section 3.4 and
section 9.2 of the draft, which contradicted each other (one said "0 ms or opacity", the other
zeroed the duration tokens).

| Condition | Behavior |
|---|---|
| `html.fx-off` (user turned effects off) | No CSS animation or transition runs. JS helpers do nothing. |
| `prefers-reduced-motion: reduce` | No `transform` animation (no scale, rotate, translate, shake). Opacity-only transitions of 150 ms or less may still give feedback. Durations are not zeroed. |
| Normal | Full animation. Duration is divided by the user's speed (`FX_SPEEDS` in `web/src/board/fx.ts`: 0.5, 1, 1.5). |

The global off rule is the one place this is enforced:

```css
html.fx-off *,
html.fx-off *::before,
html.fx-off *::after {
  animation: none !important;
  transition: none !important;
}
```

Reduced motion is handled per animation with the same rule: keep the opacity change, drop the
transform. Each animation's acceptance test checks both conditions.

Current state (verified 2026-10-16):

- `fx.ts` already exposes `fxDuration`, `applyFxRoot`, `fxEnabled`, `prefersReducedMotion`. The
  off switch is the `settings.effects` boolean, not an animation speed of 0. The draft's
  "speed 0-2" model does not exist.
- Foundation (done): `fxDuration(ms)` is speed scaling only. `fxMotionDuration(ms)` returns 0 when
  effects are off or reduced motion is requested (transform and JS motion callers). `fxOpacityDuration(ms)`
  keeps opacity-only feedback under reduced motion, capped at 150 ms. `fxMotionAllowed()` is the gate
  for branches that used to test `fxDuration(80) > 0`.
- `html.fx-off` suppresses the named selectors and the global rule above. `applyFxRoot()` runs from
  `App` (it used to run only inside `GameScreen`, so the lobby ignored the setting).
- `tokens.css` has `--ease-out`, `--ease-in-out`, and five durations: `--dur-instant` 80 ms,
  `--dur-quick` 150 ms, `--dur-base` 250 ms, `--dur-slow` 400 ms, `--dur-slower` 600 ms, plus the
  original `--dur-fast` and `--dur-med`.

## 3. Scope and inventory

In scope: animations for the board, game chrome, `CardSlot`, `PlayerInfoBar`, and `GameScreen`.

Out of scope: sounds (`soundManager` already exists), music, and lobby or deck animations
(separate plan).

Existing animations to keep as they are: `cardAppear`, `cardLand`, the flight (`flightManager`),
`badgePop`, `sicknessVeil`, `recapMarkPulse`, `useBandFit`, and the `StackPile` spread.

Existing problems the plan addresses:

| Problem | Where | Fix |
|---|---|---|
| `shakeHit` animates `margin-left` (forces layout) | `CardSlot.css` | A3, use `translateX` |
| `targetPulse`, `chosenPendingPulse` loop forever and compete | `CardSlot.css` | C1 |
| `sicknessFloat`, `enteredGlow` loop forever | `CardSlot.css` | Stop the loop (section 7) |
| Phase change is a hard cut | `PhaseBar.tsx` | B1 |
| Turn and priority changes are silent | `GameScreen.tsx` | B2, B3 |
| Timer under 10 s is only a red number | `PlayerInfoBar.tsx` | C4 |
| Draw and token creation use the generic `cardAppear` | `BoardZone.tsx` | B4, D3 |

Inventory of the 17 items, by category:

| Category | Items | Layer | v1/v2 |
|---|---|---|---|
| A. Immediate action feedback | A1 cast, A2 mana tap, A3 damage, A4 pending | `CardSlot`, `flightManager` | shared |
| B. State transitions | B1 phase, B2 turn, B3 priority, B4 draw, B5 untap | `PhaseBar`/`PhaseDial`, `GameScreen`, `BoardZone` | B1 branches; others shared |
| C. Directed attention | C1 target beacon, C2 stack countdown, C3 low life, C4 timer | `CardSlot`, stack zone, `LowLifeVignette`, `PlayerInfoBar` | C2 branches; others shared |
| D. Delight | D1 parallax, D2 hover tilt, D3 token pop, D4 graveyard dissolve | `CardSlot`, `BoardZone` | D1, D2 dropped (section 5) |

Shared tokens: `tokens.css` (easing and duration tokens), `fx.ts` (speed, off switch), and
`flightManager.ts` (curved flight). Changing these first is a prerequisite for every P0 item.

## 4. Animations

Each block gives the problem, the target behavior, timing, and the acceptance test. Timings are
starting values to be checked on a real board, not final numbers.

### Category A — Immediate action feedback

**A1 — Cast "suck and shoot" (P0)**

- Problem: a cast shows only `is-pending` (opacity 0.72, small spinner). It is easy to miss in a
  fast game, so players click twice.
- Target: the card responds on press, then flies to its destination. Instants and sorceries fly
  to the stack with a gold trail. Permanents fly to the battlefield. Lands slide sideways.
- Timing: press 80 ms (scale 0.92), flight 340 ms on a bezier curve, land 180 ms.
- Acceptance: unit test: click adds `casting-press` and starts exactly one flight. Playwright
  (fake): the flight ends on the stack; the next card stays clickable during the flight.
  Reduced motion: opacity only, no flight.

**A2 — Mana tap pulse (P1)**

- Problem: tapping a land is only a 90-degree rotation. The player must look at the mana pool to
  confirm mana was produced.
- Target: a brief brightness flash and a ring in the land's color (W, U, B, R, G, C).
- Timing: rotation as today (150 ms), then a 120 ms ring.
- Acceptance: unit test: a tapped land gets `mana-<color>`. The floating particle to the mana
  pool is optional: build it only if 10 lands tapped at once stay within the frame budget.

**A3 — Damage feedback (P0)**

- Problem: `shakeHit` animates `margin-left`, which forces a layout on every frame, and the
  player sees no amount.
- Target: a horizontal shake (`translateX`, about 4 px), a 120 ms brightness flash, and a number
  showing the amount of combat or direct damage. Life lost to effects does not animate.
- Timing: shake 300 ms, flash 120 ms, number 600 ms floating up and fading.
- Hit stop is dropped. Setting `animationPlayState` on `<html>` pauses nothing, because
  `animation-play-state` is not inherited by the cards; pausing each running animation would need
  per-element bookkeeping for 60 ms. Shake, flash, and number carry the impact.
- Acceptance: unit test: damage adds `took-damage` and renders the correct amount. DevTools
  Performance shows no layout during the shake. Reduced motion: no shake; the number fades in.

**A4 — Pending states (P1)**

- Problem: `is-pending` and `is-chosen-pending` look alike, and the spinner says nothing about
  progress.
- Target: `is-pending` (castable card sent, waiting for the server): scale 0.98, opacity 0.85,
  and a 2 px bar filling over 3 s, which matches `PENDING_ACK_MS`. `is-chosen-pending` (target
  chosen): a gold ring that pulses once and then holds (no infinite loop).
- Acceptance: unit test: the two states use different classes. At 3 s the pending state clears
  with the existing timeout.

### Category B — State transitions

**B1 — Phase change "wipe" (P0)**

- Problem: the phase indicator changes with no transition, so the player may miss that combat
  started.
- Target: the active segment slides with a spring; the label fades up. Nothing animates when the
  step is unchanged.
- Timing: segment 250 ms spring, label 200 ms.
- Scope: v1 `PhaseBar` lands on `master`. The v2 `PhaseDial` version depends on
  `feat/game-ui-v2` (`PhaseDial` and `gameUi.ts` do not exist on `master`) and uses the same
  tokens and duration.
- Acceptance: unit test: a step change adds `phase-wipe` and removes it after 250 ms; the same
  step adds nothing. Reduced motion: label opacity only.

**B2 — Turn change "glow" (P0)**

- Problem: a new turn is only a number that increments.
- Target: the turn number scales to 1.05 with a gold glow. When the active player changes, that
  player's info bar gets a gold border for 300 ms.
- Trigger: only when `turn` or `activePlayerId` changes, never on every update.
- Acceptance: unit test: a turn increment adds `turn-glow`; an update with the same turn adds
  nothing.

**B3 — Priority "orb" (P1)**

- Problem: passing priority is a border color change with no direction.
- Target: a small gold orb travels from the previous priority holder to the new one (400 ms,
  ease-in-out) and pulses on arrival. `pointer-events: none`.
- Trigger: only when the holder changes.
- Acceptance: unit test: a holder change spawns the orb once; an update with the same holder
  spawns none.

**B4 — Draw "slide from library" (P1)**

- Problem: a drawn card uses the generic `cardAppear`, so it seems to come from nowhere.
- Target: the card slides from the library count in the resource bar to the hand (400 ms, scale
  0.8 to 1), then a small land (150 ms). The opponent sees a face-down card, never the card.
- Scope: not for the opening hand or the mulligan. Only draws during the game.
- Acceptance: unit test: a new hand card gets `draw-slide`; the mulligan does not. Face-down
  variant for the opponent (no card identity in the DOM).

**B5 — Untap "wave" (P2)**

- Problem: all tapped cards untap at once, which is abrupt.
- Target: a stagger of 40 ms per card, left to right, so 10 cards finish in about 400 ms.
- Scope: only when two or more cards untap. Works with `tapStyle` normal (90 degrees) and
  tilted (45 degrees).
- Acceptance: unit test: untap adds `untap-wave` with `animation-delay` = index x 40 ms; one card
  gets no delay.

### Category C — Directed attention

**C1 — Target beacon (P0)**

- Problem: `targetPulse` (1.2 s, infinite) and `chosenPendingPulse` (0.6 s, infinite) compete and
  become noise. The player cannot tell a required target from an optional one.
- Target: a required target shows a gold ring every 1.5 s while the choice is pending, and stops
  when chosen. An optional target gets a static gold border and no animation. The chosen target
  gets a static error-colored border.
- Arrows from the source card to the targets are optional and come after the beacon (section 7).
- Acceptance: unit test: `targetable` uses the beacon class and `targetPulse` is no longer
  referenced; optional and chosen targets have no animation.

**C2 — Stack countdown (P1)**

- Problem: the stack gives no sense of how long it has been waiting.
- Target: the top card pulses gently (scale 1.02), and a thin bar fills over 3 s to show how long
  the stack has been waiting for responses.
- Not included: the draft's 3 s "auto-resolve" timer. The client must not visually resolve a
  spell; XMage resolves the stack on the server and the view decides when it leaves.
- Scope: v2 uses `StackDeck` (exists only on `feat/game-ui-v2`). The v1 stack keeps the same
  logic in its current container: `StackZone` (`web/src/board/StackZone.tsx`), where the top entry
  is the first one in the stack record.
- The top entry pulses three times (1 s each) and then rests; it is not an infinite loop, so it
  follows section 1. The pulse stops when the stack empties.
- Acceptance: unit test: only the top card gets the pulse; the bar is absent when the stack is
  empty.

**C3 — Low life "vignette" (P2)**

- Problem: the low-life vignette is static, so 5 life and 1 life look the same.
- Target: at 5 or less, a soft vignette and a slow pulse of the life value. At 2 or less, a
  stronger vignette with a faster pulse. Above 5, nothing.
- Acceptance: unit test: life 6 renders nothing; 5 renders `active`; 2 or 1 renders `critical`.

**C4 — Timer urgency "tick" (P0)**

- Problem: under 10 s the timer is only a red number.
- Target: 30 to 10 s: warning color and scale 1.02. 10 to 5 s: error color, scale 1.05 on each
  whole second (a tick, not a loop). Under 5 s: scale 1.1 with a small shake on each second.
  The existing `timer_tick` sound plays in sync.
- Acceptance: unit test: 25 s gets `warn`, 8 s gets `urgent`, 4 s gets `critical`. There is no
  infinite animation on the timer.

### Category D — Delight (only when nothing else is running)

**D1 — Playmat parallax (dropped)**

Dropped. On a shared table, a surface that moves under the pointer makes it harder to aim at
targets. See section 5.

**D2 — Hand card tilt (dropped)**

Dropped for the same reason. The hover in the hand stays as it is.

**D3 — Token pop (P2)**

- Problem: new tokens use the generic appear animation.
- Target: a spring pop (scale 0 to 1.2 to 1, rotate 5 degrees to 0) over 300 ms, only for newly
  created tokens (`isToken`). Particles are optional: build them only if five tokens created at
  once stay within the frame budget.
- Acceptance: unit test: a new token gets `token-pop`; an existing token does not.

**D4 — Graveyard and exile "dissolve" (P2)**

- Problem: a card that leaves the battlefield disappears at once, with no sign of where it went.
- Target: the card fades and greys out over 300 ms, optionally flying to the graveyard or exile
  count in the resource bar.
- Implementation note: the card is removed from the DOM in the same render that the state
  changes, so a `querySelector` after the update finds nothing. The card needs a short-lived
  ghost element (or a delayed unmount) for the 300 ms.
- Acceptance: unit test: only a real zone change (to graveyard or exile) starts the dissolve; an
  update that does not change zones starts nothing.

## 5. Priority and roadmap

| Priority | Items | Notes |
|---|---|---|
| P0 | A1, A3, B1, B2, C1, C4 | Plus the prerequisite foundation: `tokens.css`, `fx.ts`, global off rule |
| P1 | A4, B3, B4, C2, A2 | C2 v2 needs `StackDeck` from `feat/game-ui-v2` |
| P2 | B5, C3, D3, D4 | |
| Dropped | D1, D2 | Distracting on a shared table |

Dependencies:

- The foundation (tokens, `fx.ts` split, global off rule) must land first. Every P0 item uses it.
- B1 v2 (`PhaseDial`) and C2 v2 (`StackDeck`) wait for `feat/game-ui-v2`. Their v1 parts can
  ship on `master`.
- Curved flight in `flightManager.ts` is needed by A1 and D4.

The draft's day estimates (about 15 days, three weeks) are not kept. They were not validated
against the code.

## 6. Status checklist

Foundation (prerequisite):

- [x] Tokens (`tokens.css`), `fx.ts` split, global `fx-off` rule — done (unit, fake e2e, and browser check of both off paths)

Legend: "not visually verified on a real table" means the item was checked in unit tests and
the dev gallery (`#/gallery`, group "Animaciones", headless Chromium) but never on a live
game table.

P0:

- [x] A1 Cast "suck and shoot" — done with known deviation: press and pop (commit 1474248e1df, unit); the arc flight predates this work. The gold trail for non-ability spells (`.flight-trail-gold`) and the land slide (`.flight-land`) are built and reachable (`anim:stack-trail`, `anim:land-slide`). Not visually verified on a real table.
- [x] A3 Damage feedback — done with known deviations: the effect-vs-combat split is a heuristic on rules text (a stack item whose rules contain "damage" that leaves the stack while the controlled life drops counts as a spell hit; `DAMAGE_TEXT` in `gameTransitionEngine.ts`); hit stop is dropped (section 4). The `translate` shake, the flash and the floating amount are verified in the gallery (`anim:creature-damage`, `anim:player-damage`, `anim:player-life-loss`). Not visually verified on a real table.
- [x] B1 Phase wipe (v1 `PhaseBar`; v2 waits for `feat/game-ui-v2`) — done for v1 (commit 1474248e1df, unit). Not visually verified on a real table.
- [x] B2 Turn glow — done (commit 1474248e1df, unit). Not visually verified on a real table.
- [x] C1 Target beacon — done for targets (attack arrows excluded, see section 7). Required card targets get the beacon (`target-beacon`); optional card targets and optional opponent pills get a static border only (`target-optional`, `is-targetable`); required opponent pills use `oppTargetBeacon` (the old `targetPulse` is gone from `OpponentSwitcherBar.css`); targetable player bars pulse 3 times, not forever. A chosen target gets the static error border and no beacon: `BoardZone` reads `feedback.chosenTargets` into `isChosen` (gallery `anim:chosen-target` renders `.card-slot.chosen` 1, `.target-beacon` 0). Not visually verified on a real table.
- [x] C4 Timer tick — done (commit 1474248e1df, unit). Not visually verified on a real table.

P1:

- [x] A4 Pending states — done: `is-pending` scales 0.98, fades to 0.85 and shows a 2 px bar filling over `PENDING_ACK_MS` (unit; the bar was checked in the gallery at its mid-point; reduced motion and fx-off checked in the browser via computed style). `is-chosen-pending` unchanged. Not visually verified on a real table.
- [x] B3 Priority orb — done (unit, browser screenshot of the mid-flight orb). Not visually verified on a real table.
- [x] B4 Draw slide — done for the local hand in `HandBar` and `HandZone`, and for the `HandRail` and `HandRow` layouts (same `useDrawSlide` hook; unit tests in `HandRail.test.tsx` and `HandRow.test.tsx`). Verified in the browser by measurement and a crop for `HandBar` only. Opponent face-down hands animate only when not collapsed into a stack (`stackBacks`); a collapsed stack has no per-card slot to animate, by design.
- [x] C2 Stack countdown — done for v1 (`StackZone`); v2 `StackDeck` waits for `feat/game-ui-v2`. Checked in the gallery: the top entry pulses, the bar is half filled at a seeked 1.5 s, both disappear when the stack entry unmounts, and reduced motion removes both. Not visually verified on a real table.
- [x] A2 Mana tap pulse — done for v1 (ring and brightness flash) plus the optional particle: the mana symbol of each tapped land (28 px, `symbols/<X>.svg`) flies to its controller's mana pool (`manaParticle.ts`, `manaParticle.css`, spawned from `CardSlot` on the untapped-to-tapped edge; on landing the controller's mana pool pulses once (`mana-pool-landed`, scale only); `transform` and `opacity` only; unit `manaParticle.test.ts`; gate passed in the measurement below). Checked in the gallery: the green ring shows on the tapped Forest at a seeked 230 ms. Measured in headless Chromium on the dev gallery (prototype particles, before the real one was built) (`board:arena-4-crowded`, 129 card slots on the stage): ten lands pulsing at once and a prototype of ten `transform`/`opacity` particles each ran 1.5 s with no frame over 10.5 ms (interval 8.3 ms at this display rate) and no frame over 33 ms; the prototype was a throwaway benchmark, not product code. The product particle was then checked in the gallery: one particle per tap, correct color, removed after 400 ms, and its frozen mid-flight point is the topmost element (z-index 900, above the gallery shell at 500). This is a synthetic run, not a real GPU or a live table, so it does not replace a DevTools trace on hardware.

P2:

- [x] B5 Untap wave — done (unit `useUntapWave.test.tsx`; gallery `anim:untap-wave`: three tapped cards untap and run the staggered untap-wave animation). Not visually verified on a real table.
- [x] C3 Low life vignette — done (unit `LowLifeVignette.test.tsx`, `lowLife.test.ts`; gallery `anim:life-5` renders `active` at level 1, `anim:life-2` renders `critical` at level 2, `anim:life-6` renders nothing). Not visually verified on a real table.
- [x] D3 Token pop — done: the spring pop, the ring impact the engine fires for a new token, and a burst of six 8 px dots (`tokenBurst.ts`, `tokenBurst.css`) radiating from the token in its first colour (colourless tokens use the grey dot). Spawned from `useTokenPop` only for tokens absent from the previous update; the rect is measured before the pop starts, since the pop begins at scale 0. Gate passed: five tokens at once (30 dots, 320 ms) in headless Chromium with no frame over 9.4 ms. Gallery `anim:token-pop`: the new token runs the pop animation. Not visually verified on a real table.
- [x] D4 Graveyard dissolve — done with known gaps: stolen cards and a rollback edge case. Gallery `anim:dissolve`: a `.card-dissolve-ghost` appears where the creature stood. Not visually verified on a real table.

Dropped:

- [ ] D1 Playmat parallax — not started (dropped, section 5)
- [ ] D2 Hand card tilt — not started (dropped, section 5)

## 7. Open questions and judgment calls

- Arrows from source to targets (C1 extension) are not in P0. Build them after the beacon, if
  wanted.
- A2 and D3 particles are conditional on a frame-budget measurement.
- `sicknessFloat` and `enteredGlow` loop forever and are in no priority. They should stop
  looping; a static marker is enough. Confirm with the owner before changing them.
- The draft's hit-stop approach is replaced by nothing (A3). Reconsider only with a measured
  need.
- D1 and D2 are dropped (section 5). Revisit only if the table design changes.

## 8. Testing

Tests assert classes, DOM, and state. Pixel and screenshot diffs are not used (they were the
source of flakes in this repo).

| Layer | Tool | What is tested |
|---|---|---|
| Unit (trigger logic) | Vitest | When an animation starts: a value changes, not on every update. Hook and helper behavior. |
| Component | Vitest + Testing Library | Expected classes or ghost elements appear; `prefers-reduced-motion` and `html.fx-off` remove transforms. Mock `matchMedia`. |
| Fake e2e | Playwright (`npm run test:e2e:fake`) | Animations in real flows against `FakeServer`, input not blocked, reduced motion via `emulateMedia`. |
| Manual | Dev and QA | Feel, hierarchy, no motion sickness, frame time with 20 permanents (DevTools Performance: no layout during shake). |

The real-protocol layer (`record.mjs`, recorded fixtures, `verify`, `self-test`, `human-test`) is
unaffected. This plan does not change the wire format, the contract schema, or any view field.
If an animation needs a field the server does not send, that is a separate contract change and
is out of scope here.

Before a P0 item is marked done: `unit` and `typecheck` pass for `web/`, `build` if the build
changed, and the fake e2e specs that touch the animated component pass.

## 9. References

- Draft (Spanish, kept until the owner decides): `animaciones.md` at the repo root
- Motion tokens and speed: `web/src/ui/tokens.css`, `web/src/board/fx.ts`
- Card, flight, and perf probe: `web/src/board/CardSlot.tsx`, `web/src/board/flightManager.ts`,
  `web/src/system/perfProbe.ts`
- v2 layout: `feat/game-ui-v2` (`gameUi: 'v1' | 'v2'`)
- Format reference: `docs/plans/2026-10-10-sim-dev-only-design.md`
