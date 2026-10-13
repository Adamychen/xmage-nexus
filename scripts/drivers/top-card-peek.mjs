import { pathToFileURL } from 'node:url'
import { runRecorder } from '../rec-lib.mjs'

// Pins the any-time top-card peek channel (`GameView.lookedAt`, group named
// "Top card of your library").
//
// Contract finding this driver exists to prove: the group is NOT a `RevealedView`
// with full `CardView`s, even though `contract.schema.json` points `lookedAt` at
// `#/definitions/RevealedView`. `LookedAtView` (Mage.Common/.../view/LookedAtView.java)
// carries `SimpleCardsView`, so a real frame ships
// `{name, cards: {<id>: {id, expansionSetCode, cardNumber, usesVariousArt, gameObject,
// isChoosable, isSelected, playableStats}}}` — no name, no rules text. The only
// recorded frame that had a non-empty `lookedAt` before this driver (gitaxian-probe.json,
// the opponent's hand) shows exactly that shape, so the peek slot in
// `game/ResourceBar.tsx` was built and unit-tested against a fake `CardView`
// (`dev/galleryFixtures.ts` clones a hand card) that the server never sends.
//
// Which card: `Sphinx of Jwar Isle` (ZEN 68, {4}{U}{U}) — one of the four cards that
// put the group on the wire (`LookAtTopCardOfLibraryAnyTimeEffect`: this one and
// `Rulik Mons, Warren Chief`; the effect class is shared by ~40 cards). It was chosen
// over the cheaper `Realmwalker` (KHM 188) because Realmwalker's "as it enters, choose a
// creature type" chooser adds an unrelated prompt, and over `Future Sight`, which does
// NOT use this channel at all in this fork: FutureSight.java is
// `PlayWithTheTopCardRevealedEffect` + `PlayFromTopOfLibraryEffect`, i.e. the
// `PlayerView.topCard` channel (see drivers/top-card-revealed.mjs).
//
// Path: 60 Islands (no cheat needed for the deck), turn 1 first main — play a land
// (the one normal action the cheat requires), then cheat Sphinx to hand + 5 Islands to
// the battlefield, then cast it for real from hand so the continuous effect applies on
// the GAME thread (cheating a permanent straight to the battlefield is the documented
// freeze; casting is the proven pattern from pithing-needle.mjs).
function makeTopCardPeekDriver() {
  return {
    name: 'top-card-peek',
    outFile: 'top-card-peek.json',
    deck: {
      name: 'Mage Web top card peek rec',
      cards: [{ cardName: 'Island', setCode: 'iko', cardNumber: '271', amount: 60 }],
      sideboard: [],
    },
    gameType: 'Constructed - Modern',
    maxMs: 300_000,
    _acted: false,
    _cheated: false,
    _cast: false,
    onSelect(ctx) {
      const gv = ctx.gv
      const me = ctx.me
      if (!me || me.hasPriority !== true) return
      const isMyMain = me.isActive === true && (gv.phase === 'PRECOMBAT_MAIN' || gv.phase === 'POSTCOMBAT_MAIN')
      if (!isMyMain) {
        ctx.pass()
        return
      }
      if (!this._acted) {
        if (ctx.playLand()) {
          this._acted = true
          ctx.log('onSelect: land (normal action before the cheat)')
        } else ctx.pass()
        return
      }
      if (!this._cheated) {
        this._cheated = true
        ctx.log('onSelect: cheatSetup (Sphinx to hand + 5 Islands to the battlefield for {4}{U}{U})')
        void ctx.cheatSetup({
          hand: ['Sphinx of Jwar Isle'],
          battlefield: ['Island', 'Island', 'Island', 'Island', 'Island'],
        })
        return
      }
      if (!this._cast && ctx.cardInHand('Sphinx of Jwar Isle') && ctx.untappedMana() >= 6) {
        this._cast = true
        ctx.log('onSelect: cast Sphinx of Jwar Isle from hand')
        ctx.playCardByName('Sphinx of Jwar Isle')
        return
      }
      ctx.pass()
    },
    captureWhen(gv) {
      return (gv.lookedAt ?? []).some((g) => g?.name === 'Top card of your library')
    },
  }
}

export const drivers = { 'top-card-peek': makeTopCardPeekDriver }

export const meta = {
  mechanic: 'top-card-peek',
  kind: 'game',
  assert: 'hasTopCardPeek',
  note: 'Any-time top-card peek (Sphinx of Jwar Isle, ZEN 68, {4}{U}{U}) cast for real from hand on turn 1 after a land drop; Sphinx + 5 Islands arrive by cheatSetup (the deck is 60 Islands). Capture: the first view whose GameView.lookedAt carries a group named "Top card of your library" — the channel that feeds game/topCardPeek.ts and the slot beside the library. Contract note: that group is a LookedAtView, so its cards are SimpleCardView entries ({id, expansionSetCode, cardNumber, ...}), NOT CardView: no name, no rules text. The engine writes it once when LookAtTopCardOfLibraryAnyTimeEffect applies (PlayerImpl.lookAtCards -> fireUpdatePlayersEvent), guarded by canLookAtNextTopLibraryCard (no new peek while a spell is being paid for). Future Sight is NOT this channel in this fork (it is PlayWithTheTopCardRevealedEffect -> PlayerView.topCard, pinned by top-card-revealed.mjs).',
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await runRecorder(makeTopCardPeekDriver())
}