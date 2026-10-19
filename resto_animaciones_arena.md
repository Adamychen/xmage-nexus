# Remaining MTG Arena animations (gap list)

Animations that MTG Arena has and XMage Nexus does not yet have, or has not verified.
Source: code review of `web/src` (2026-10-19) plus general knowledge of Arena. Not checked
against a live Arena session, so items marked "unverified" need a runtime check first.

## Missing

1. ~~**Library shuffle.**~~ Closed, not planned. The view only sends the library count, which does
   not change on a shuffle, and no game code reads a shuffle event. Reopen only if a real game log
   line for the shuffle turns up and the feed parser can use it.
2. **Coin flip / die roll for the starting player.** Coin done in `e30ae35277` (`board/coinFlipFx.ts`,
   `board/CoinFlipOverlay.tsx`): cosmetic, because the server does not send the real flip.
   Still open: the die roll. Here the die is only an icon in `game/feedbackModes/GenericDialog.tsx`
   and `game/feedbackModes/TargetBar.tsx`, and the roll result is not in the view.
3. ~~**Counter pop.**~~ Done in `b2477c074f` and `07a65cceee` (`useCounterPulse.ts`). Gallery:
   `anim:counter-change`.
4. ~~**Auras and equipment flying to their target.**~~ Entering attachments already flew to their slot
   (path B). Done now for a host change (equip, re-enchant, unattach): `flyReattached` in
   `board/gameTransitionEngine.ts`. Gallery: `anim:equip-move`.
5. ~~**Opponent card reveal.**~~ Done in `b750a71c63`: a spell (the controlled player's or an
   opponent's) rises enlarged to the centre, holds about 200 ms, then flies to the stack
   (`gameTransitionEngine.ts`, `FlyingCardOverlay.tsx`). Gallery: `anim:spell-cast-own`,
   `anim:spell-cast-opp`. Covers spells only; a played land or permanent already lifts on entry.
6. **Scry.** Not animated. No scry handling in `board/`. A top/bottom reorder changes
   neither the graveyard nor the hand count, so the transition engine does nothing. The
   only UI is `game/LibraryOrderDialog.tsx`, a dialog.
7. **Surveil cards kept on top or bottom.** Not animated, same reason as scry.
8. **Planeswalker loyalty change.** The +/- change is done: loyalty arrives as the `loyalty` field, not
   a counter, and the badge reuses `useCounterPulse` (purple flash, ring, `+N`/`-N` label, number tick).
   Gallery: `anim:loyalty-change`; tests in `board/CardSlot.counterPulse.test.tsx`.
   Still open: combat damage to a planeswalker only gets the generic shake, but the loyalty number
   now moves too, which covers it.

## Partially animated

- ~~**Mill.**~~ Done: a card that reaches the graveyard without having been in the hand (own
  `myHand`, or the opponent's hand count not shrinking) flies from the library. The engine also
  accepts the compact `.library-chip`/`.graveyard-chip`, which had no flights at all (draws, discards
  and mills). Gallery: `anim:mill`. Only the first 3 arrivals animate.
- ~~**Surveil to graveyard.**~~ Same path as mill.

## Already present (for reference)

Card flights between zones (variants: destroy, exile, heavy, land, gold trail), spell lift and
hold before the stack (`b750a71c63`), spell slam on resolve, impact sparks, sequential combat strikes, damage numbers, token burst, life pop,
turn banner, phase wipe, mana particles, tap/untap flip, animated playmats, foil effects,
animated targeting arrows, end screen.
