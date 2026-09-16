import { pathToFileURL } from 'node:url'
import { runRecorder } from '../rec-lib.mjs'

// P4 — §3.2 "Convoke / Improvise / Delve": falta improvise.
// Reverse Engineer ({3}{U}{U}, sorcery, DrawCardSourceControllerEffect(3) +
// ImproviseAbility) en mano; 2 Islas + 3 Ornithopter al campo (los duplicados
// del mismo nombre en cheatSetup.battlefield funcionan, ver mass-tokens).
// Total 3 Islas (la jugada de tierra + el cheat) + 3 Ornithopter: con solo 3
// Islas es IMPOSIBLE pagar {3}{U}{U} sin improvise (3 maná < 5), así que el
// pago obliga a usar el botón special (igual patrón que delve/convoke).
//
// Flujo de pago (HumanPlayer.playManaHandling → activateSpecialAction):
//   1) GAME_PLAY_MANA "Pay {3}{U}{U}" → se gira una Isla (UUID, habilidad de
//      maná normal; el motor prohíbe maná normales DESPUÉS de improvise).
//   2) GAME_PLAY_MANA "Pay {3}{U}"  → segunda Isla.
//   3) GAME_PLAY_MANA "Pay {3}"     → sendPlayerString("special") → el servidor
//      dispara GAME_CHOOSE_ABILITY con la ImproviseSpecialAction → se responde
//      su UUID; su TargetControlledPermanent(1..3, untapped artifacts,
//      notTarget) llega como GAME_TARGET "Select artifact to tap as
//      Improvise's pay (selected N of 3, min 1)" → un Ornithopter por prompt
//      (3 giros = {C}{C}{C} al pool) → coste pagado → roba 3.
function makeImproviseDriver() {
  return {
    name: 'improvise',
    outFile: 'improvise.json',
    deck: {
      name: 'Mage Web improvise rec',
      cards: [{ cardName: 'Island', setCode: 'iko', cardNumber: '265', amount: 60 }],
      sideboard: [],
    },
    gameType: 'Constructed - Pioneer',
    maxMs: 420_000,
    _landTurn: -1,
    _cheated: false,
    _cast: false,
    _handBeforeCast: -1,
    _improvTapped: [],
    onSelect(ctx) {
      const gv = ctx.gv
      const me = ctx.me
      if (!me || me.hasPriority !== true) return
      const isMyMain = me.isActive === true && (gv.phase === 'PRECOMBAT_MAIN' || gv.phase === 'POSTCOMBAT_MAIN')
      if (!isMyMain) {
        ctx.pass()
        return
      }
      // Tierra por turno (como counterspell/warp): evita el descarte de
      // limpieza si la run tarda más de un turno.
      const turn = gv.turn ?? 0
      if (turn !== this._landTurn) {
        if (ctx.playLand()) {
          this._landTurn = turn
          ctx.log('onSelect: tierra')
          return
        }
      }
      // Regla P1: el cheat va tras ≥1 acción normal (la tierra del T1).
      if (!this._cheated) {
        this._cheated = true
        ctx.log('onSelect: cheatSetup (Reverse Engineer en mano, 2 Islas + 3 Ornithopter al campo)')
        void ctx.cheatSetup({
          hand: ['Reverse Engineer'],
          battlefield: ['Island', 'Island', 'Ornithopter', 'Ornithopter', 'Ornithopter'],
        })
        return
      }
      if (!this._cast && ctx.cardInHand('Reverse Engineer') && ctx.untappedMana() >= 2) {
        this._cast = true
        // La carta lanzada sale de la mano (pre-cast → pre-cast-1) y luego
        // DrawCardSourceControllerEffect(3): tras resolver, mano = pre-cast+2.
        this._handBeforeCast = Object.keys(gv.myHand ?? gv.hand ?? {}).length
        ctx.log('onSelect: lanzo Reverse Engineer (mano pre-cast=', this._handBeforeCast, ')')
        ctx.playCardByName('Reverse Engineer')
        return
      }
      ctx.pass()
    },
    // Pago: {U}{U} con Islas ANTES de improvise (tras girar artefactos el
    // motor bloquea las habilidades de maná: ActivationManaAbilityStep.AFTER).
    onPlayMana(ctx, m) {
      const msg = String(m?.data?.message ?? '')
      const me = ctx.me
      const bf = Object.values(me?.battlefield ?? {})
      if (/\{U\}/.test(msg)) {
        const isle = bf.find((c) => !c.tapped && /island/i.test(c?.name ?? ''))
        if (isle) {
          ctx.sendAction('sendPlayerUUID', { gameId: ctx.gameId, value: isle.id })
          ctx.log('onPlayMana: pago {U} con', isle.name)
          return
        }
      }
      ctx.sendAction('sendPlayerString', { gameId: ctx.gameId, value: 'special' })
      ctx.log('onPlayMana: botón special (improvise) msg=', msg.slice(0, 60))
    },
    // Activación de la acción especial: elegir la de improvise (la única
    // esperada); fallback a la primera opción.
    onChooseAbility(opts, ctx) {
      const imp = (opts ?? []).find((o) => /improvise/i.test(String(o?.label ?? '')))
      const val = (imp ?? (opts ?? [])[0])?.value
      if (val) {
        ctx.log('onChooseAbility:', imp ? 'improvise' : 'primera opción', JSON.stringify((opts ?? []).map((o) => o.label)).slice(0, 200))
      }
      return val
    },
    // Giro de artefactos para improvise: un GAME_TARGET por artefacto (el
    // filtro sigue viendo los 3 sin girar durante la selección, así que se
    // recuerdan los ya elegidos).
    onTarget(ctx, question, data) {
      const q = String(question ?? '')
      if (/discard/i.test(q)) {
        // Descarte de limpieza con min 2 (mano 9 → 7): hay que devolver una
        // carta DISTINTA por prompt (repetir la misma la quita de la elección
        // y el servidor vuelve a preguntar en bucle).
        const hand = ctx.gv?.myHand ?? ctx.gv?.hand ?? {}
        this._discarded = this._discarded ?? []
        const pick = Object.entries(hand).find(([id]) => !this._discarded.includes(id))
        if (pick) {
          this._discarded.push(pick[0])
          ctx.log('onTarget: descarte de limpieza', pick[1]?.name)
          return pick[0]
        }
        return undefined
      }
      if (/improvise/i.test(q)) {
        const bf = Object.values(ctx.me?.battlefield ?? {})
        const art = bf.find(
          (c) => /ornithopter/i.test(c?.name ?? '') && !c.tapped && !this._improvTapped.includes(c.id),
        )
        if (art) {
          this._improvTapped.push(art.id)
          ctx.log('onTarget: giro', art.name, 'para improvise', this._improvTapped.length, '/3')
          return art.id
        }
      }
      return undefined
    },
    // Invariante: Reverse Engineer en el cementerio, los 3 Ornithopter girados
    // y la mano +3 (robo de 3).
    captureWhen(gv) {
      const me = (gv.players ?? []).find((p) => p?.controlled)
      const re = Object.values(me?.graveyard ?? {}).some((c) => /reverse engineer/i.test(String(c?.name ?? '')))
      const orniths = Object.values(me?.battlefield ?? {}).filter((c) => /ornithopter/i.test(String(c?.name ?? '')))
      const tapped = orniths.filter((c) => c?.tapped === true).length
      const hand = Object.keys(gv.myHand ?? gv.hand ?? {}).length
      return re && tapped === 3 && this._handBeforeCast >= 0 && hand >= this._handBeforeCast + 2
    },
  }
}

export const drivers = { improvise: makeImproviseDriver }

export const meta = {
  mechanic: 'improvise',
  kind: 'game',
  assert: 'hasImprovise',
  note: 'Reverse Engineer ({3}{U}{U}, roba 3, ImproviseAbility) con 3 Islas + 3 Ornithopter vía cheatSetup: el {U}{U} se paga con 2 Islas (UUID en GAME_PLAY_MANA "Pay {3}{U}{U}" → "Pay {3}{U}") y el {3} CON el botón special (sendPlayerString "special" en "Pay {3}" → GAME_CHOOSE_ABILITY con la ImproviseSpecialAction → su TargetControlledPermanent(1..3 artefactos sin girar, notTarget) llega como GAME_TARGET "Select artifact to tap as Improvise\'s pay (selected N of 3, min 1)", un Ornithopter por prompt, 3 giros = {C}{C}{C}); tras improvise el motor bloquea habilidades de maná (ActivationManaAbilityStep.AFTER), por eso las Islas van primero. Captura: Reverse Engineer en el cementerio, los 3 Ornithopter girados en el campo y la mano = pre-cast+2 (la carta lanzada sale de la mano y DrawCardSourceControllerEffect(3) roba 3: 7→9). Driver improvise con cheatSetup.',
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await runRecorder(makeImproviseDriver())
}
