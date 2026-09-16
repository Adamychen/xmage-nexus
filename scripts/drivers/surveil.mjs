import { pathToFileURL } from 'node:url'
import { runRecorder } from '../rec-lib.mjs'

// P4 — surveil vía cheatSetup (§3.8): Consider ({U}, "Surveil 1, then draw a
// card") en mano + Isla al campo. Análogo exacto al driver scry: el prompt
// llega como GAME_TARGET "Select up to one card to PUT into your GRAVEYARD
// (Surveil)" (PlayerImpl.doSurveil usa TargetCard(0,1,Zone.LIBRARY) con ese
// filtro) — devolver el UUID de la top la manda al cementerio, declinar la
// deja arriba. El mazo pone 2 Montañas en las posiciones 8-9 de la biblioteca
// (skipInitShuffling) para que la carta vigilada sea identificable como
// "Mountain en el cementerio" sin depender de cuántos robos previos haya
// hecho el jugador (el recorder empieza en el turno 2, ver frame scry).
function makeSurveilDriver() {
  return {
    name: 'surveil',
    outFile: 'surveil.json',
    deck: {
      name: 'Mage Web surveil rec',
      cards: [
        // Mano inicial (7) + posiciones 8-9 (el robo del turno se lleva la 8;
        // el surveil manda la siguiente Mountain al cementerio).
        { cardName: 'Island', setCode: 'iko', cardNumber: '265', amount: 7 },
        { cardName: 'Mountain', setCode: 'LEA', cardNumber: '292', amount: 2 },
        { cardName: 'Island', setCode: 'iko', cardNumber: '265', amount: 51 },
      ],
      sideboard: [],
    },
    gameType: 'Constructed - Pioneer',
    maxMs: 420_000,
    _acted: false,
    _cheated: false,
    onSelect(ctx) {
      const gv = ctx.gv
      const me = ctx.me
      if (!me || me.hasPriority !== true) return
      const isMyMain = me.isActive === true && (gv.phase === 'PRECOMBAT_MAIN' || gv.phase === 'POSTCOMBAT_MAIN')
      if (!isMyMain) {
        ctx.pass()
        return
      }
      // Regla P1: el cheat va tras ≥1 acción normal (ver counterspell).
      if (!this._acted) {
        if (ctx.playLand()) {
          this._acted = true
          ctx.log('onSelect: tierra inicial')
        } else ctx.pass()
        return
      }
      if (!this._cheated) {
        this._cheated = true
        ctx.log('onSelect: cheatSetup (Consider en mano, Isla al campo)')
        void ctx.cheatSetup({ hand: ['Consider'], battlefield: ['Island'] })
        return
      }
      if (ctx.cardInHand('Consider')) {
        ctx.log('onSelect: lanzo Consider')
        ctx.playCardByName('Consider')
        return
      }
      ctx.pass()
    },
    // El surveil (como el scry) llega como GAME_TARGET en Zone.LIBRARY: el
    // UUID de la top elegida = cementerio. Se usan los ids de la propia
    // pregunta (regla del driver vote: un id ajeno repite el prompt en bucle).
    onTarget(ctx, question, data) {
      const q = String(question ?? '')
      if (!/surveil|put into your graveyard/i.test(q) || /discard/i.test(q)) return undefined
      const pt = data?.options?.possibleTargets ?? data?.targets ?? []
      const ids = Array.isArray(pt)
        ? pt.map((o) => (typeof o === 'string' ? o : o?.id)).filter(Boolean)
        : Object.keys(pt ?? {})
      if (ids[0]) {
        this._surveilled = true
        ctx.log('onTarget: surveil al cementerio')
        return ids[0]
      }
      return undefined
    },
    // Pago {U} explícito con Isla (sin depender de isActive/hasPriority del
    // default: durante el pago de costes el flag puede no llegar en la vista).
    onPlayMana(ctx, m) {
      const msg = String(m?.data?.message ?? '')
      const isle = Object.values(ctx.me?.battlefield ?? {}).find((c) => !c.tapped && /island/i.test(c?.name ?? ''))
      if (isle) {
        ctx.sendAction('sendPlayerUUID', { gameId: ctx.gameId, value: isle.id })
        ctx.log('onPlayMana: giro', isle.name, msg.slice(0, 30))
      }
    },
    captureWhen(gv) {
      const me = (gv.players ?? []).find((p) => p?.controlled)
      const gy = Object.values(me?.graveyard ?? {})
      const hasMountain = gy.some((c) => /^mountain$/i.test(String(c?.name ?? '')))
      const hasConsider = gy.some((c) => /^consider$/i.test(String(c?.name ?? '')))
      return hasMountain && hasConsider
    },
  }
}

export const drivers = { surveil: makeSurveilDriver }

export const meta = {
  mechanic: 'surveil',
  kind: 'game',
  assert: 'hasSurveil',
  note: 'Consider ({U}) resuelto: surveil 1 llega como GAME_TARGET "Select up to one card to PUT into your GRAVEYARD (Surveil)" (misma forma que el scry de Opt, filtro distinto: devolver el UUID de la top = cementerio, declinar = dejar arriba) y después roba. La Montaña vigilada acaba en el cementerio junto a Consider (la carta lanzada). Driver surveil con cheatSetup.',
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await runRecorder(makeSurveilDriver())
}
