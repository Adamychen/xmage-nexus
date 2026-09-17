import { pathToFileURL } from 'node:url'
import { runRecorder } from '../rec-lib.mjs'

// P4 — §3.1 "Mulligan gratuito de Commander / multijugador". Regla real:
// CR 103.5c — "In a multiplayer game and in any Brawl game, the first mulligan
// a player takes doesn't count toward the number of cards that player will put
// on the bottom of their library or the number of mulligans that player may
// take." NO depende del starting player (el plan4 citaba 103.4a/903.8, que es
// la vida de Two-Headed Giant / otra regla): la exención es POR JUGADOR y
// aplica a todos los jugadores de la mesa.
//
// El motor YA lo implementa: `MatchOptions.freeMulligans` (seteable vía
// createTable del proxy) llega a `LondonMulligan.mulligan()` /
// `mulliganDownTo()`, que llevan un contador POR JUGADOR
// (`usedFreeMulligans.get(playerId)`) — exactamente la semántica de 103.5c.
// Lo que faltaba era el default: la mesa nacía con freeMulligans=0 y había que
// pedirlo a mano (el wizard web ya tenía el chip + hint, sin preselección).
// El 1v1 Commander (Commander Two Player Duel) NO lleva mulligan gratis (no es
// multijugador ni Brawl): el frame anterior "costs card" probaba eso mismo.
//
// Este driver verifica el caso real de 103.5c: mesa "Commander Free For All"
// de 3 jugadores (1 humano + 2 SIM) con freeMulligans:1, tomamos DOS mulligans
// y hacemos keep. Si el primero fuera de pago la mano final sería 5; con la
// exención es 6 (7 − 1 mulligan pagado). El informe "X mulligans for free."
// del motor viaja al chat/log de partida (GAME_INFORM → CHATMESSAGE), no al
// GameView, así que la evidencia del frame es `handCount`.
const MOUNTAIN = { cardName: 'Mountain', setCode: 'LEA', cardNumber: '292', amount: 99 }
const KRENKO = { cardName: 'Krenko, Mob Boss', setCode: 'M13', cardNumber: '138', amount: 1 }

function commanderDeck(name) {
  return { name, cards: [{ ...MOUNTAIN }], sideboard: [], commanders: [{ ...KRENKO }] }
}

function makeCommanderFreeMulliganDriver() {
  return {
    name: 'commander-free-mulligan',
    outFile: 'commander-free-mulligan.json',
    deck: commanderDeck('Mage Web commander free-mull rec'),
    playerTypes: ['HUMAN', 'SIM', 'SIM'],
    simDecks: [commanderDeck('Mage Sim commander free-mull rec A'), commanderDeck('Mage Sim commander free-mull rec B')],
    gameType: 'Variant Magic - Commander',
    tableGameType: 'Commander Free For All',
    freeMulligans: 1,
    maxMs: 120_000,
    _mulligans: 0,
    _kept: false,
    onTarget(ctx, question) {
      const q = String(question ?? '')
      if (/bottom of (your )?library/i.test(q)) {
        const hand = ctx.gv?.myHand ?? {}
        const id = Object.keys(hand)[0]
        if (id) {
          ctx.log('onTarget: pago del mulligan pagado → carta al fondo (' + (hand[id]?.name ?? id) + ')')
          return id
        }
      }
      return undefined
    },
    onAsk(question, ctx) {
      const q = String(question ?? '')
      if (!/mulligan/i.test(q)) return undefined
      if (this._mulligans < 2) {
        this._mulligans += 1
        ctx.log(`onAsk: mulligan ${this._mulligans}/2 → SÍ |`, q.slice(0, 90))
        return true
      }
      this._kept = true
      ctx.log('onAsk: keep |', q.slice(0, 90))
      return false
    },
    captureWhen(gv) {
      const me = (gv.players ?? []).find((p) => p?.controlled)
      if (!me) return false
      if (!this._kept) return false
      return gv.turn === 1 && Number(me.handCount) === 6
    },
  }
}

export const drivers = { 'commander-free-mulligan': makeCommanderFreeMulliganDriver }

export const meta = {
  mechanic: 'commander-free-mulligan',
  kind: 'game',
  assert: 'firstMulliganFreeSecondCostsCard',
  note: 'CR 103.5c verificado en real (el "Gap de motor" del plan4 era un falso diagnóstico: citaba 103.4a/903.8 y ligaba la exención al starting player). La regla exime el PRIMER mulligan de cada jugador en multijugador y en cualquier Brawl; el motor la implementa con `MatchOptions.freeMulligans` + `usedFreeMulligans` por jugador en LondonMulligan. Frame: mesa "Commander Free For All" de 3 (1 humano + 2 SIM) con freeMulligans:1 (antes el default 0 lo dejaba fuera; el wizard web ya lo preselecciona desde 2026-09-17), tomamos DOS mulligans y keep: mano final 6 (una carta al fondo por el segundo), no 5. Los dos SIM conservan 7. El informe "mulligans for free." va al chat/log, no al GameView. El caso 1v1 sin mulligan gratis (Commander Two Player Duel, freeMulligans 0) queda documentado en el historial del driver.',
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await runRecorder(makeCommanderFreeMulliganDriver())
}
