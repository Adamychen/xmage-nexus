import { pathToFileURL } from 'node:url'
import { runRecorder } from '../rec-lib.mjs'

// P4 — FFA de 6 (§3.11 "FFA 5–10 jugadores | 1 + 5 IA | Layout standard con
// switcher (cae solo a standard con 5+)"): mesa real "Free For All" de 6
// (1 humano + 5 SIM). El motor no tiene nada especial para 5+: la decisión §9.1
// del plan es servir SOLO el layout standard con `OpponentSwitcherBar` (el POD
// recorta a MAX_BOARD_PLAYERS=4 sin switcher y el standard muestra a todos los
// rivales de uno en uno — ver `boardLayout.ts:effectiveBoardLayout`).
//
// Frame estable y barato: la primera main propia con la tierra jugada (sin
// combate ni cheat), que ya pinta 6 jugadores. El replay exige `game-board`
// (no `pod-board`), la barra `.opponent-switcher-bar` y 6 píldoras.
const SIM_DECK = {
  name: 'Mage Sim ffa-six lands',
  cards: [
    { cardName: 'Forest', setCode: 'iko', cardNumber: '272', amount: 50 },
    { cardName: 'Island', setCode: 'iko', cardNumber: '263', amount: 50 },
  ],
  sideboard: [],
}

function makeFfaSixDriver() {
  return {
    name: 'ffa-six',
    outFile: 'ffa-six.json',
    deck: {
      name: 'Mage Web ffa-six rec',
      cards: [{ cardName: 'Mountain', setCode: 'LEA', cardNumber: '292', amount: 60 }],
      sideboard: [],
    },
    playerTypes: ['HUMAN', 'SIM', 'SIM', 'SIM', 'SIM', 'SIM'],
    simDecks: [SIM_DECK, SIM_DECK, SIM_DECK, SIM_DECK, SIM_DECK],
    tableGameType: 'Free For All',
    gameType: 'Constructed - Pioneer',
    maxMs: 300_000,
    _landTurn: -1,
    onSelect(ctx) {
      const gv = ctx.gv
      const me = ctx.me
      if (!me || me.hasPriority !== true) return
      const isMyMain = me.isActive === true && (gv.phase === 'PRECOMBAT_MAIN' || gv.phase === 'POSTCOMBAT_MAIN')
      if (!isMyMain) {
        ctx.pass()
        return
      }
      const turn = gv.turn ?? 0
      if (turn !== this._landTurn) {
        if (ctx.playLand()) {
          this._landTurn = turn
          ctx.log('onSelect: tierra T', turn)
          return
        }
      }
      ctx.pass()
    },
    captureWhen(gv) {
      if ((gv.players ?? []).length !== 6) return false
      const me = (gv.players ?? []).find((p) => p?.controlled)
      if (!me) return false
      return Object.values(me.battlefield ?? {}).some((c) => (c?.cardTypes ?? []).includes('LAND'))
    },
  }
}

export const drivers = { 'ffa-six': makeFfaSixDriver }

export const meta = {
  mechanic: 'ffa-six',
  kind: 'game',
  assert: 'hasFfaSix',
  note: 'FFA real de 6 (1 humano + 5 SIM) en mesa "Free For All": frame estable en la primera main propia con la tierra jugada (sin cheat ni combate). Evidencia de la decisión §9.1 (solo standard con switcher para 5+): el view trae 6 jugadores y el replay exige `game-board` (NO `pod-board`), `.opponent-switcher-bar` visible y 6 píldoras `.opp-pill` — `effectiveBoardLayout` cae a standard cuando totalPlayers > MAX_BOARD_PLAYERS=4.',
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await runRecorder(makeFfaSixDriver())
}
