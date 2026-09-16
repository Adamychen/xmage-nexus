import { pathToFileURL } from 'node:url'
import { runRecorder } from '../rec-lib.mjs'

// P4 — §3.1 "Conceder durante mulligan" (lección plan3: la UI no debe ofrecer
// algo que el server ignora). Sonda de comportamiento: al llegar la PRIMERA
// ventana de mulligan (GAME_ASK "Mulligan ...?") se manda
// sendPlayerAction CONCEDE (mismo comando que el botón Conceder de la web,
// concedeGame → cmds.sendPlayerAction('CONCEDE', gameId)) y se pide mulligan
// (true) en vez de keep: así, si el server ignora el CONCEDE, la partida sigue
// y aparece una SEGUNDA ventana de mulligan (evidencia directa); si lo honra,
// el server corta el diálogo y llega GAME_OVER con el jugador hasLeft=true.
//
// Análisis del fork (§3.1): GameImpl.setConcedingPlayer ya contempla partida
// sin prioridad: usa state.getChoosingPlayerId() — que durante la fase de
// mulligan apunta al jugador al que se le pregunta (Mulligan.executeMulliganPhase
// hace setChoosingPlayerId(playerId) antes de chooseMulligan). Al coincidir con
// nosotros, HumanPlayer.signalPlayerConcede(true) marca asyncWantConcede y
// despierta waitForResponse, que ejecuta ((GameImpl) game).checkConcede() en el
// hilo de juego: leave(playerId) → checkIfGameIsOver → end() → GAME_OVER.
function makeConcedeMulliganDriver() {
  return {
    name: 'concede-mulligan',
    outFile: 'concede-mulligan.json',
    deck: {
      name: 'Mage Web concede-mulligan rec',
      cards: [{ cardName: 'Plains', setCode: 'm20', cardNumber: '261', amount: 60 }],
      sideboard: [],
    },
    gameType: 'Constructed - Pioneer',
    maxMs: 180_000,
    _conceded: false,
    _asks: 0,
    _secondAsk: false,
    onAsk(question, ctx) {
      const q = String(question ?? '')
      if (!/mulligan/i.test(q)) return undefined
      this._asks += 1
      if (!this._conceded) {
        this._conceded = true
        ctx.log('onAsk: mulligan #1 → envío CONCEDE |', q.slice(0, 90))
        ctx.sendAction('sendPlayerAction', { gameId: ctx.gameId, action: 'CONCEDE' })
        // Pedir mulligan (no keep): si el server ignora el CONCEDE, vuelve a
        // preguntar (2ª ventana viva) — evidencia inequívoca.
        return true
      }
      this._secondAsk = true
      ctx.log('onAsk: mulligan #' + this._asks + ' tras el CONCEDE → el server NO lo cortó; hago keep')
      return false
    },
    // Caso A (server honra CONCEDE): frame final con me.hasLeft === true.
    // Caso B (server lo ignora): 2ª ventana de mulligan con la partida viva.
    captureWhen(gv) {
      const me = (gv.players ?? []).find((p) => p?.controlled)
      if (!me) return false
      if (this._conceded && me.hasLeft === true) return true
      if (this._secondAsk && me.hasLeft !== true) return true
      return false
    },
  }
}

export const drivers = { 'concede-mulligan': makeConcedeMulliganDriver }

export const meta = {
  mechanic: 'concede-mulligan',
  kind: 'game',
  assert: 'hasConcedeMulligan',
  note: 'CONCEDE en la 1ª ventana de mulligan (GAME_ASK "Mulligan down to 6 cards?"): el server SÍ lo honra — GameImpl.setConcedingPlayer usa state.getChoosingPlayerId() (fijado por Mulligan.executeMulliganPhase), HumanPlayer.signalPlayerConcede(true) despierta waitForResponse y checkConcede→leave→end dejan un GAME_UPDATE inmediato con players[].hasLeft=true (turn 1, mano 0, sin tierras jugadas, rival con 7). El CONCEDE se procesa antes que la respuesta keep/mulligan que manda el driver (se envió mulligan true y el diálogo ya estaba cortado). La UI no expone Conceder dentro del MulliganDialog (el botón vive en el menú ⋯ de la cabecera y el backdrop modal lo tapa, Modal.tsx): como el server sí lo procesa, debería ofrecerse desde el propio diálogo. Invariante del frame: me.hasLeft===true. Driver concede-mulligan.',
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await runRecorder(makeConcedeMulliganDriver())
}
