import { pathToFileURL } from 'node:url'
import { runRecorder } from '../rec-lib.mjs'

// PRM-6 / BRD-66 — Kodama's Reach ({2}{G}): search for up to two basic lands, reveal them, put one
// onto the battlefield tapped and the other into the hand. Records the engine's prompt chain (no
// frame): the library search asks "Select basic land cards (selected N of 2)" once per card, with
// the whole library in cardsView1 and min/max left at 0 (the maximum is only in the message), then
// "Select a card to put on the battlefield tapped" over the two lands. The reveal itself arrives in
// GameView.revealed ("Kodama's Reach [xxx]"), not as a prompt. Mazo: 60 Islands; cheatSetup puts
// the spell in hand, three Forests on the battlefield and Plains/Mountain/Forest on the library.
function libraryTargetIds(data) {
  const pt = data?.options?.possibleTargets
  return Array.isArray(pt) ? pt.map(String) : []
}

function makeKodamasReachDriver() {
  return {
    name: 'kodamas-reach-chain',
    outFile: false,
    promptsOutFile: 'kodamas-reach-chain.json',
    deck: {
      name: 'Mage Web kodama rec',
      cards: [{ cardName: 'Island', setCode: 'iko', cardNumber: '265', amount: 60 }],
      sideboard: [],
    },
    gameType: 'Constructed - Pioneer',
    maxMs: 240_000,
    _acted: false,
    _cheated: false,
    onSelect(ctx) {
      const me = ctx.me
      const gv = ctx.gv
      if (!me || me.hasPriority !== true) return
      if (!(me.isActive === true && (gv.phase === 'PRECOMBAT_MAIN' || gv.phase === 'POSTCOMBAT_MAIN'))) {
        ctx.pass()
        return
      }
      if (!this._acted) {
        if (ctx.playLand()) this._acted = true
        else ctx.pass()
        return
      }
      if (!this._cheated) {
        this._cheated = true
        void ctx.cheatSetup({ hand: ["Kodama's Reach"], battlefield: ['Forest', 'Forest', 'Forest'], library: ['Plains', 'Mountain', 'Forest'] })
        return
      }
      if (ctx.cardInHand("Kodama's Reach")) {
        ctx.playCardByName("Kodama's Reach")
        return
      }
      ctx.pass()
    },
    onTarget(ctx, question, data) {
      const q = String(question ?? '')
      if (/discard/i.test(q)) return undefined
      const ids = libraryTargetIds(data)
      const chosen = new Set((data?.options?.chosenTargets ?? []).map(String))
      const named = (name) => Object.entries(data?.cardsView1 ?? {}).find(([id, c]) => c?.name === name && ids.includes(id) && !chosen.has(id))?.[0]
      if (/basic land cards/i.test(q)) return chosen.size === 0 ? named('Forest') : named('Mountain')
      if (/battlefield tapped/i.test(q)) return named('Mountain') ?? ids[0]
      return undefined
    },
    captureWhen(gv) {
      const me = (gv.players ?? []).find((p) => p?.controlled)
      return Object.values(me?.graveyard ?? {}).some((c) => /kodama/i.test(String(c?.name ?? '')))
    },
  }
}

export const drivers = { 'kodamas-reach-chain': makeKodamasReachDriver }

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await runRecorder(makeKodamasReachDriver())
}
