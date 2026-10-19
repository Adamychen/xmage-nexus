# Remaining MTG Arena animations (gap list)

Animations that MTG Arena has and XMage Nexus does not yet have, or has not verified.
Source: code review of `web/src` (2026-10-19) plus general knowledge of Arena. Not checked
against a live Arena session, so items marked "unverified" need a runtime check first.

## Missing

1. **Library shuffle.** Arena shows the library cards mixing when it is shuffled. Only the
   lobby (`lobby/CreateTable/RandomPacksSelector.tsx`, `lobby/CreateTable/DevTab.tsx`) and
   `decks/SampleHandModal.tsx` mention shuffle. No in-game animation.
2. **Coin flip / die roll for the starting player.** Arena animates a coin or die at game
   start. Here the die is only an icon in `game/feedbackModes/GenericDialog.tsx` and
   `game/feedbackModes/TargetBar.tsx`.
3. **Counter pop.** `.counter-badge` in `board/CardSlot.css` (around line 517) is static.
   When a +1/+1 or other counter count changes, there is no pulse or tick.
4. **Auras and equipment flying to their target.** `board/gameTransitionEngine.ts` has no
   `attach` handling. Attachments appear without a trajectory.
5. **Opponent card reveal.** Arena shows the card enlarged when the opponent casts a spell
   or plays a card. Nothing equivalent was found in `board/feedbackFx.ts` or the transition
   engine. The flight to the stack exists but is small.
6. **Scry.** Not animated. No scry handling in `board/`. A top/bottom reorder changes
   neither the graveyard nor the hand count, so the transition engine does nothing. The
   only UI is `game/LibraryOrderDialog.tsx`, a dialog.
7. **Surveil cards kept on top or bottom.** Not animated, same reason as scry.
8. **Planeswalker loyalty change.** Not animated.
   - Ability activation (+/-): the loyalty badge is plain text (`board/CardSlot.tsx:481-485`),
     with no previous-value tracking and no keyframe. The planeswalker dialog
     (`game/PlaneswalkerAbilityDialog.tsx:32-63`) shows the projected value as text only.
   - Combat damage: the planeswalker can be a strike target and gets the generic shake
     (`board/combatStrikes.ts`). Losing loyalty does not change the `damage` field, so the
     damage-number path in `board/gameTransitionEngine.ts:414-424` never fires.
   - Caveat: if the server sends loyalty as a generic counter, it would show as a `.counter-badge`
     that pops (`board/CardSlot.css:538`). Not confirmed.
   - No test covers loyalty animation.

## Partially animated

- **Mill.** Animated, but the flight starts from the hand position, not the library. The
  card flies to `.graveyard-stack` in 350 ms (`board/gameTransitionEngine.ts:292-320`). Only
  the first 3 arrivals animate. Origin falls back to the library only when no hand rect
  exists. A library card is not a `CardSlot`, so it has no registry position. Needs a
  browser check, since this comes from reading the code.
- **Surveil to graveyard.** Same path as mill.

## Already present (for reference)

Card flights between zones (variants: destroy, exile, heavy, land, gold trail), spell slam on
resolve, impact sparks, sequential combat strikes, damage numbers, token burst, life pop,
turn banner, phase wipe, mana particles, tap/untap flip, animated playmats, foil effects,
animated targeting arrows, end screen.
