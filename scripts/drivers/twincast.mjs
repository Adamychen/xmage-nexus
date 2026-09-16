import { pathToFileURL } from 'node:url'
import { runRecorder } from '../rec-lib.mjs'

// P4 — copiar hechizo vía cheatSetup (§3.4): Lightning Bolt a la cara del
// rival + Twincast ({U}{U}) copiando el Bolt en la pila. Mazo todo Montañas y
// un único cheatSetup (Bolt + Twincast a la mano, 2 Islas al campo) para tener
// {R} y {U}{U} a la vez. El objetivo de Twincast al lanzarse lo auto-resuelve
// el motor (el Bolt es el único hechizo legal en la pila → no llega
// GAME_TARGET); al crear la copia sí llega un GAME_ASK "Change this 1 of 1
// target: ...?" (StackObjectImpl.chooseNewTarget, optional) y se responde
// false: la copia mantiene el objetivo original (cara del rival). Orden de
// resolución LIFO: primero la copia (3 daños, 20→17) y después el Bolt
// original (17→14). Al final hay UN solo Lightning Bolt físico en el
// cementerio propio (la copia no es carta) + Twincast; vida del SIM 14.
function makeTwincastDriver() {
  return {
    name: 'twincast',
    outFile: 'twincast.json',
    deck: {
      name: 'Mage Web twincast rec',
      cards: [{ cardName: 'Mountain', setCode: 'LEA', cardNumber: '292', amount: 60 }],
      sideboard: [],
    },
    gameType: 'Constructed - Pioneer',
    maxMs: 300_000,
    _landTurn: -1,
    _cheated: false,
    _boltCast: false,
    _boltPaid: false,
    _twincastCast: false,
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
      if (!this._cheated) {
        this._cheated = true
        ctx.log('onSelect: cheatSetup (Bolt + Twincast en mano, 2 Islas al campo)')
        void ctx.cheatSetup({ hand: ['Lightning Bolt', 'Twincast'], battlefield: ['Island', 'Island'] })
        return
      }
      if (!this._boltCast) {
        if (ctx.cardInHand('Lightning Bolt') && ctx.untappedMana() >= 1) {
          ctx.log('onSelect: lanzo Lightning Bolt a la cara del rival')
          ctx.playCardByName('Lightning Bolt')
          this._boltCast = true
        } else ctx.pass()
        return
      }
      if (!this._twincastCast) {
        const boltOnStack = Object.values(gv.stack ?? {}).some((s) => /lightning bolt/i.test(s?.name ?? ''))
        if (boltOnStack && ctx.cardInHand('Twincast') && ctx.untappedMana() >= 2) {
          ctx.log('onSelect: lanzo Twincast copiando el Bolt de la pila')
          ctx.playCardByName('Twincast')
          this._twincastCast = true
          return
        }
      }
      ctx.pass()
    },
    // Pago por color: {R} del Bolt con la Montaña, {U}{U} del Twincast con las
    // Islas cheateadas (el pago por defecto cogería la primera tierra sin
    // voltear y podría gastar una Isla en el Bolt o una Montaña en el Twincast).
    onPlayMana(ctx) {
      const bf = ctx.me?.battlefield ?? {}
      const pick = (re) => {
        for (const [id, c] of Object.entries(bf)) {
          if (!c.tapped && re.test(c?.name ?? '')) return id
        }
        return null
      }
      const src = this._boltPaid ? (pick(/island/i) ?? pick(/mountain/i)) : pick(/mountain/i)
      if (src) {
        ctx.sendAction('sendPlayerUUID', { gameId: ctx.gameId, value: src })
        if (!this._boltPaid) this._boltPaid = true
      }
    },
    onTarget(ctx, q) {
      const stack = ctx.gv?.stack ?? {}
      const boltId = Object.keys(stack).find((k) => /lightning bolt/i.test(stack[k]?.name ?? ''))
      if (boltId && /spell/i.test(String(q ?? ''))) {
        ctx.log('onTarget: Twincast → Bolt en la pila (si el motor no lo auto-resolvió)')
        return boltId
      }
      const rival = (ctx.gv?.players ?? []).find((p) => !p?.controlled)
      ctx.log('onTarget: Bolt → cara del rival')
      return rival?.playerId ?? rival?.id
    },
    onAsk(q, ctx) {
      if (/change this/i.test(String(q ?? ''))) {
        ctx.log('onAsk: NO cambio el objetivo de la copia (mantiene la cara del rival)')
        return false
      }
      return undefined
    },
    captureWhen(gv) {
      const me = (gv.players ?? []).find((p) => p?.controlled)
      const rival = (gv.players ?? []).find((p) => !p?.controlled)
      const gy = Object.values(me?.graveyard ?? {}).map((c) => String(c?.name ?? '').toLowerCase())
      const bolts = gy.filter((n) => n === 'lightning bolt').length
      const stackEmpty = Object.keys(gv.stack ?? {}).length === 0
      return bolts === 1 && gy.includes('twincast') && stackEmpty && Number(rival?.life ?? 20) === 14
    },
  }
}

export const drivers = { twincast: makeTwincastDriver }

export const meta = {
  mechanic: 'twincast',
  kind: 'game',
  assert: 'hasTwincastCopy',
  note: 'Twincast ({U}{U}) copia con cheatSetup (§3.4) un Lightning Bolt lanzado a la cara del SIM: el objetivo de Twincast al lanzarse lo auto-resuelve el motor (único hechizo legal en la pila, no llega GAME_TARGET); al crearse la copia llega el GAME_ASK "Change this 1 of 1 target: <SIM>?" (StackObjectImpl.chooseNewTarget, reemplazo opcional) y se responde false, así la copia conserva el objetivo original. Resolución LIFO: copia 3 daños (20→17) y después el Bolt original (17→14). Captura: vida del SIM 14, pila vacía, UN solo Lightning Bolt físico en el cementerio propio + Twincast (la copia no es carta). Driver twincast con cheatSetup.',
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await runRecorder(makeTwincastDriver())
}
