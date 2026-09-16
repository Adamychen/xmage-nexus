import { pathToFileURL } from 'node:url'
import { runRecorder } from '../rec-lib.mjs'

// P4 — §3.2 "Solo para gastar en… / maná flotante al cambiar de fase":
// confirmEmptyManaPool. Al pasar prioridad con maná en el pool y la pila vacía,
// HumanPlayer.passWithManaPoolCheck lanza un chooseUse (GAME_ASK) "You still
// have mana in your mana pool and it will be lost. Pass anyway?" (el proxy
// conecta con confirmEmptyManaPool=true por UserData.getDefaultUserDataView).
// Secuencia: primer turno propio, tierra + clic en la Forest para flotar {G} →
// pass (dispara el ASK, se responde true = seguir). El captureWhen exige
// _askSeen, así que el frame capturado es el GAME_UPDATE_AND_INFORM inmediato
// posterior a responder el ASK, aún con el maná en el pool (rec-lib solo
// captura GAME_UPDATE y el ASK llega como GAME_ASK; fallback: re-flotar en un
// turno posterior si el pool se vaciara antes).
function poolTotal(p) {
  const mp = p?.manaPool ?? {}
  return ['red', 'green', 'blue', 'white', 'black', 'colorless'].reduce((a, k) => a + Number(mp[k] ?? 0), 0)
}

function makeFloatingManaDriver() {
  return {
    name: 'floating-mana',
    outFile: 'floating-mana.json',
    deck: {
      name: 'Mage Web floating mana rec',
      cards: [{ cardName: 'Forest', setCode: 'iko', cardNumber: '272', amount: 60 }],
      sideboard: [],
    },
    gameType: 'Constructed - Pioneer',
    maxMs: 420_000,
    _landTurn: -1,
    _floatedTurn: -1,
    _askSeen: false,
    _askText: '',
    _floatedAfterAskTurn: -1,
    _untappedLand(ctx) {
      const bf = ctx.me?.battlefield ?? {}
      for (const [id, c] of Object.entries(bf)) {
        if (!c.tapped && (c.cardTypes ?? []).includes('LAND')) return id
      }
      return null
    },
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
          ctx.log('onSelect: tierra')
          return
        }
      }
      // T1: activar la tierra (clic = activa la habilidad de maná; la Forest
      // solo tiene una) sin lanzar nada → pool > 0.
      if (!this._askSeen) {
        if (this._floatedTurn !== turn) {
          const land = this._untappedLand(ctx)
          if (land) {
            this._floatedTurn = turn
            ctx.sendAction('sendPlayerUUID', { gameId: ctx.gameId, value: land })
            ctx.log('onSelect: activo Forest → pool {G}')
            return
          }
        }
        if (poolTotal(me) > 0) {
          ctx.log('onSelect: paso con maná flotante (dispara confirmEmptyManaPool)')
          ctx.pass()
          return
        }
      }
      // Tras el ASK: en el turno propio siguiente volver a flotar; el
      // GAME_UPDATE posterior a la activación cumple captureWhen.
      if (this._askSeen && turn > 1 && poolTotal(me) === 0 && this._floatedAfterAskTurn !== turn) {
        const land = this._untappedLand(ctx)
        if (land) {
          this._floatedAfterAskTurn = turn
          ctx.sendAction('sendPlayerUUID', { gameId: ctx.gameId, value: land })
          ctx.log('onSelect: floto de nuevo (post-ASK) para capturar')
          return
        }
      }
      ctx.pass()
    },
    // ASK de vaciar el pool: confirmarlo (true = "pasar de todos modos").
    onAsk(question, ctx) {
      const q = String(question ?? '')
      if (/pass anyway/i.test(q)) {
        this._askSeen = true
        this._askText = q
        ctx.log('onAsk: confirmEmptyManaPool →', JSON.stringify(q))
        return true
      }
      return undefined
    },
    // Éxito: maná en el pool del jugador controlado, pila vacía y ASK ya visto.
    captureWhen(gv) {
      if (!this._askSeen) return false
      const me = (gv.players ?? []).find((p) => p?.controlled)
      return poolTotal(me) > 0 && Object.keys(gv.stack ?? {}).length === 0
    },
  }
}

export const drivers = { 'floating-mana': makeFloatingManaDriver }

export const meta = {
  mechanic: 'floating-mana',
  kind: 'game',
  assert: 'hasFloatingMana',
  note: 'Maná flotante y confirmEmptyManaPool: en el primer turno propio, clic en la Forest jugada (sendPlayerUUID del permanente = activa su única habilidad de maná) deja {G} en el pool; al pasar prioridad (sendPlayerBoolean false) HumanPlayer.passWithManaPoolCheck dispara el GAME_ASK chooseUse "You still have mana in your mana pool and it will be lost. Pass anyway?" (solo con userData.confirmEmptyManaPool=true, que es el default del proxy: UserData.getDefaultUserDataView; el web lo reenvía en GAME_INIT con updatePreferences {confirmEmptyManaPool} y lo togglea en GameMenu → settings.manaPayment.confirmEmptyPool) y se responde true = seguir. El frame capturado es el GAME_UPDATE_AND_INFORM inmediatamente posterior a responder el ASK: me.manaPool.green=1 (aún sin vaciar), pila vacía, Forest girada y prioridad ya cedida al SIM (hasPriority=false, isActive=true) — el ASK llega como GAME_ASK (no como GAME_UPDATE) y rec-lib solo captura GAME_UPDATE, así que este es el estado más cercano al aviso (el fallback del driver re-flota en un turno posterior si el pool se vaciara antes de capturar). El pool se serializa como ManaPoolView {red,green,blue,white,black,colorless} (cifras; 0 = vacío) y el web lo pinta en ManaPoolView.',
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await runRecorder(makeFloatingManaDriver())
}
