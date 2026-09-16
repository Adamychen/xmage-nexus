import { pathToFileURL } from 'node:url'
import { runRecorder } from '../rec-lib.mjs'

// P4 — jump-start vía cheatSetup (§3.3): Radical Idea ({1}{U}, "Draw a card.
// Jump-start") en el cementerio + Isla en mano (para el descarte del coste) +
// Islas al campo (para {1}{U}). El UUID del cementerio se juega directo, igual
// que en el driver flashback (JumpStartAbility también es BASE_ALTERNATE en
// Zone.GRAVEYARD); el coste adicional DiscardTargetCost(new TargetCardInHand())
// llega como GAME_TARGET de descarte y se responde con un id de la propia
// pregunta (la carta descartada va al cementerio). Al resolver se roba y la
// carta se exilia en vez de ir al cementerio (JumpStartReplacementEffect,
// mismo patrón que flashback).
function makeJumpStartDriver() {
  return {
    name: 'jump-start',
    outFile: 'jump-start.json',
    deck: {
      name: 'Mage Web jumpstart rec',
      cards: [{ cardName: 'Island', setCode: 'iko', cardNumber: '265', amount: 60 }],
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
        ctx.log('onSelect: cheatSetup (Radical Idea al cementerio, Isla en mano + Isla al campo)')
        void ctx.cheatSetup({
          graveyard: ['Radical Idea'],
          hand: ['Island'],
          battlefield: ['Island'],
        })
        return
      }
      // Como flashback: reenviar el UUID del cementerio en cada ventana hasta
      // que el hechizo salga de la zona (en la pila ya no aparece aquí).
      const js = ctx.cardInGraveyard('Radical Idea')
      if (js) {
        ctx.log('onSelect: lanzo Radical Idea por jump-start')
        ctx.sendAction('sendPlayerUUID', { gameId: ctx.gameId, value: js })
        return
      }
      ctx.pass()
    },
    // Discriminado por texto (regla del driver vote). El coste adicional de
    // jump-start NO dice "discard" (DiscardTargetCost.setText('')): llega como
    // GAME_TARGET "Select a card", targetZone HAND, con los ids en data.targets
    // y sin options.possibleTargets (visto en vivo 2026-09-16). El descarte de
    // limpieza sí dice "discard". En ambos se devuelve un id de la propia
    // pregunta, nunca de un escaneo propio.
    onTarget(ctx, question, data) {
      const q = String(question ?? '').trim()
      if (!/discard/i.test(q) && !/^"?select a card"?$/i.test(q)) return undefined
      const pt = data?.options?.possibleTargets ?? data?.targets ?? []
      const ids = Array.isArray(pt)
        ? pt.map((o) => (typeof o === 'string' ? o : o?.id)).filter(Boolean)
        : Object.keys(pt ?? {})
      if (ids[0]) {
        this._discarded = true
        ctx.log('onTarget: descarte', /discard/i.test(q) ? '(limpieza)' : '(coste jump-start)')
        return ids[0]
      }
      return undefined
    },
    // Por si el clic en el cementerio abre el picker normal vs jump-start.
    onChooseAbility(opts, ctx) {
      const js = (opts ?? []).find((o) => /jump.?start/i.test(String(o?.label ?? '')))
      if (js) {
        ctx.log('onChooseAbility: jump-start')
        return js.value
      }
      return (opts ?? [])[0]?.value
    },
    // Pago {1}{U} explícito con Islas (sin depender de isActive/hasPriority del
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
      const ex = me?.exile ?? {}
      const exVals = Array.isArray(ex) ? ex : Object.values(ex)
      const exiled = exVals.some((c) => /radical idea/i.test(String(c?.name ?? (typeof c === 'string' ? c : ''))))
      const discarded = Object.values(me?.graveyard ?? {}).some((c) => /island/i.test(String(c?.name ?? '')))
      return exiled && discarded
    },
  }
}

export const drivers = { 'jump-start': makeJumpStartDriver }

export const meta = {
  mechanic: 'jump-start',
  kind: 'game',
  assert: 'hasJumpStart',
  note: 'Radical Idea lanzada desde el cementerio por jump-start ({1}{U} + coste adicional de descartar una Isla, GAME_TARGET de descarte respondido con el possibleTargets real): al resolver roba 1 y se exilia en vez de ir al cementerio (JumpStartReplacementEffect), mientras la Isla descartada queda en el cementerio. Driver jump-start con cheatSetup.',
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await runRecorder(makeJumpStartDriver())
}
