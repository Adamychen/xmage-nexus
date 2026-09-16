import { pathToFileURL } from 'node:url'
import { runRecorder } from '../rec-lib.mjs'

// P4 — emerge (§3.2 costes alternativos) vía cheatSetup: Wretched Gryff
// (EMN 12, {7} 3/4 volar; EmergeAbility {5}{U}) a la MANO (no directo al campo:
// su trigger "When you cast" y el robo exigen el hilo GAME, ver pithing-needle)
// + Grizzly Bears (MV 2, fodder del sacrificio) + 4 Islas al campo (más la
// Isla del turno = 5 manás). Con 5 manás el hardcast {7} es impagable, así que
// el motor solo ofrece el coste de emerge (EmergeAbility es un SpellAbility
// BASE_ALTERNATE: PlayerImpl.getCastableSpellAbilities lo devuelve como única
// habilidad utilizable → el clic lanza directo, sin picker). El sacrificio es
// un TargetSacrifice con chooseHint "to sacrifice for emerge" (GAME_TARGET si
// el motor no lo auto-elige; con un único legal probablemente lo auto-elija) y
// el coste baja {5}{U} → {3}{U} porque EmergeAbility.activate llama a
// CardUtil.reduceCost con el mana value del sacrificado. Captura: Gryff en el
// campo propio + el Grizzly Bears sacrificado en el cementerio propio.
function makeEmergeDriver() {
  return {
    name: 'emerge',
    outFile: 'emerge.json',
    deck: {
      name: 'Mage Web emerge rec',
      cards: [{ cardName: 'Island', setCode: 'iko', cardNumber: '271', amount: 60 }],
      sideboard: [],
    },
    gameType: 'Constructed - Pioneer',
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
      const turn = gv.turn ?? 0
      // Regla P1: el cheat va tras ≥1 acción normal (la tierra del T1). No se
      // juegan más tierras tras el cheat para no alterar el montaje.
      if (!this._cheated && turn !== this._landTurn) {
        if (ctx.playLand()) {
          this._landTurn = turn
          ctx.log('onSelect: tierra inicial (acción normal previa al cheat)')
          return
        }
      }
      if (!this._acted) this._acted = true
      if (!this._cheated) {
        this._cheated = true
        ctx.log('onSelect: cheatSetup (Gryff a la mano, Grizzly Bears + 4 Islas al campo)')
        void ctx.cheatSetup({
          hand: ['Wretched Gryff'],
          battlefield: ['Grizzly Bears', 'Island', 'Island', 'Island', 'Island'],
        })
        return
      }
      // {3}{U} tras reducir {5}{U} por el MV 2 del Grizzly: 4 manás + 1 isla
      // del turno. Se exige ≥4 por si el cheat aún no ha asentado la vista.
      if (!this._cast && ctx.cardInHand('Wretched Gryff') && ctx.untappedMana() >= 4) {
        this._cast = true
        ctx.log('onSelect: lanzo Wretched Gryff (solo emerge es pagable)')
        ctx.playCardByName('Wretched Gryff')
        return
      }
      ctx.pass()
    },
    // Por si el motor abre el picker de habilidades en vez de lanzar directo:
    // elegir la opción que mencione emerge.
    onChooseAbility(opts, ctx) {
      ctx.log('onChooseAbility emerge:', JSON.stringify(opts).slice(0, 300))
      const em = (opts ?? []).find((o) => /emerge/i.test(String(o?.label ?? o?.value ?? '')))
      if (em) return em.id ?? em.value
      return undefined
    },
    // Y por si lo abre como GAME_CHOOSE_CHOICE con keyChoices (patrón
    // dash/evoke): la clave que menciona emerge.
    onChooseChoice(opts, ctx) {
      ctx.log('onChooseChoice emerge:', JSON.stringify(opts).slice(0, 300))
      const em = (opts ?? []).find((o) => /emerge/i.test(String(o?.label ?? o?.value ?? '')))
      if (em) return em.value
      return undefined
    },
    onTarget(ctx, question, data) {
      const q = String(question ?? '')
      const idsOf = (src) =>
        Array.isArray(src)
          ? src.map((o) => (typeof o === 'string' ? o : o?.id)).filter(Boolean)
          : Object.keys(src ?? {})
      if (/discard/i.test(q)) {
        const ids = idsOf(data?.options?.possibleTargets ?? data?.targets)
        const isle = ids.find((id) => /island/i.test(ctx.gv?.myHand?.[id]?.name ?? ''))
        if (isle) return isle
        if (ids[0]) return ids[0]
        return undefined
      }
      if (/sacrifice|emerge|creature/i.test(q)) {
        const bear = ctx.findOnBattlefield('Grizzly Bears')
        if (bear) {
          ctx.log('onTarget: sacrificio de emerge → Grizzly Bears')
          return bear
        }
        const ids = idsOf(data?.options?.possibleTargets ?? data?.targets)
        if (ids[0]) {
          ctx.log('onTarget: sacrificio de emerge → primer legal del payload')
          return ids[0]
        }
        return undefined
      }
      return undefined
    },
    captureWhen(gv) {
      const me = (gv.players ?? []).find((p) => p?.controlled)
      const bf = Object.values(me?.battlefield ?? {})
      const gy = me?.graveyard ?? {}
      const gyVals = Array.isArray(gy) ? gy : Object.values(gy)
      const gryff = bf.some((c) => /wretched gryff/i.test(c?.name ?? ''))
      const bearInGy = gyVals.some((c) => /grizzly bears/i.test(c?.name ?? (typeof c === 'string' ? c : '')))
      return gryff && bearInGy
    },
  }
}

export const drivers = { emerge: makeEmergeDriver }

export const meta = {
  mechanic: 'emerge',
  kind: 'game',
  assert: 'hasEmerge',
  note: 'Wretched Gryff (EMN 12, {7} 3/4 volar, Emerge {5}{U}) a la mano + Grizzly Bears (MV 2, fodder) + 4 Islas al campo vía cheatSetup y lanzado por emerge: EmergeAbility es un SpellAbility BASE_ALTERNATE, así que el clic con el hardcast {7} impagable (5 manás) lanza directo por emerge sin picker; el sacrificio (TargetSacrifice con chooseHint "to sacrifice for emerge") y CardUtil.reduceCost con el MV del sacrificado rebajan {5}{U} → {3}{U}. Captura: Wretched Gryff en el campo propio + el Grizzly Bears en el cementerio propio. Driver emerge con cheatSetup.',
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await runRecorder(makeEmergeDriver())
}
