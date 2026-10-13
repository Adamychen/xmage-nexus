import { pathToFileURL } from 'node:url'
import { runRecorder } from '../rec-lib.mjs'

// Pins the second top-card channel: `PlayerView.topCard`, the one the engine fills
// for a player whose top card is REVEALED (`PlayerImpl.isTopCardRevealed()`), as
// opposed to the look-any-time peek pinned by drivers/top-card-peek.mjs.
//
// Why this channel needs its own frame: it was empty in all 123 recorded frames
// before this driver, yet the web reads it in four places (board/crossZone.ts,
// board/boardShared.ts, board/targetZones.ts and the library chip + peek slot in
// game/ResourceBar.tsx, which dedupes the slot by
// `peekedCard.id !== player.topCard?.id`). PlayerView.java builds it per view from
// the CURRENT library top (`player.isTopCardRevealed() && player.getLibrary().hasCards()
// ? new CardView(topCard, game) : null`), so unlike `lookedAt` this one is a full
// `CardView` (name, rules, P/T) and it moves every time the library changes — that
// is the "alternation of views" the roadmap wanted pinned.
//
// Which card: `Future Sight` (Modern Horizons 53, {2}{U}{U}{U}) — the card the
// roadmap named. In this fork it is `PlayWithTheTopCardRevealedEffect` (sets
// topCardRevealed for its controller) + `PlayFromTopOfLibraryEffect` (lets us cast
// what we see, which is how the slot gets a playable ring in the real protocol).
// Magus of the Future / Courser of Kruphix / Melek, Izzet Paragon are the same
// effect class; Future Sight was picked because it is an enchantment, so no
// summoning sickness and no creature the AI can remove before the capture.
//
// Path: 60 Islands, turn 1 first main — land drop (the normal action the cheat
// requires), then cheat Future Sight to hand + 4 Islands to the battlefield, then
// cast it from hand so the effect applies on the GAME thread.
function makeTopCardRevealedDriver() {
  return {
    name: 'top-card-revealed',
    outFile: 'top-card-revealed.json',
    deck: {
      name: 'Mage Web top card revealed rec',
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
        ctx.log('onSelect: cheatSetup (Future Sight to hand + 4 Islands to the battlefield for {2}{U}{U}{U})')
        void ctx.cheatSetup({
          hand: ['Future Sight'],
          battlefield: ['Island', 'Island', 'Island', 'Island'],
        })
        return
      }
      if (!this._cast && ctx.cardInHand('Future Sight') && ctx.untappedMana() >= 5) {
        this._cast = true
        ctx.log('onSelect: cast Future Sight from hand')
        ctx.playCardByName('Future Sight')
        return
      }
      ctx.pass()
    },
    captureWhen(gv) {
      const me = (gv.players ?? []).find((p) => p?.controlled)
      return !!me?.topCard
    },
  }
}

export const drivers = { 'top-card-revealed': makeTopCardRevealedDriver }

export const meta = {
  mechanic: 'top-card-revealed',
  kind: 'game',
  assert: 'hasTopCardRevealed',
  note: 'Revealed top card (Future Sight, MH1 53, {2}{U}{U}{U}) cast for real from hand on turn 1 after a land drop; Future Sight + 4 Islands arrive by cheatSetup (the deck is 60 Islands). Capture: the first view whose controlled PlayerView carries a non-null topCard — PlayerView.java fills it from the CURRENT library top while the player is topCardRevealed, so it is a full CardView (name, rules, P/T), unlike the SimpleCardView payload of GameView.lookedAt. Read by board/crossZone.ts, board/boardShared.ts, board/targetZones.ts and the library chip of game/ResourceBar.tsx (which hides the peek slot when both channels point at the same card id).',
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await runRecorder(makeTopCardRevealedDriver())
}
