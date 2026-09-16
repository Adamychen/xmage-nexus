import { pathToFileURL } from 'node:url'
import { runRecorder } from '../rec-lib.mjs'

// P4 — contadores de jugador (§3.10 veneno, energía, radiación):
// Attune with Aether ({G}, sorcery KLD 145): "busca una tierra básica,
// muéstrala, ponla en tu mano, baraja; ganas {E}{E}".
// getSpellAbility = SearchLibraryPutInHandEffect (GAME_TARGET con las tierras
// básicas de la biblioteca como possibleTargets) + GetEnergyCountersControllerEffect(2)
// (PlayerImpl.addCounters(CounterType.ENERGY...)). CounterType.ENERGY = "energy"
// y PlayerView serializa TODOS los contadores del jugador como
// counters:[{name,count}] (CounterView), así que el frame debe traer
// me.counters = [{name:'energy',count:2}].
//
// Mazo todo Bosques: da igual qué Bosque devuelva la búsqueda (no se
// identifica por UUID desde el cliente); lo que importa es el contador de
// jugador. La búsqueda revela la carta: si el reveal sigue vivo en la vista
// del frame, se verá en g.revealed (se limpia al pedir prioridad).
function makeEnergyDriver() {
  return {
    name: 'energy',
    outFile: 'energy.json',
    deck: {
      name: 'Mage Web energy rec',
      cards: [{ cardName: 'Forest', setCode: 'iko', cardNumber: '272', amount: 60 }],
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
        ctx.log('onSelect: cheatSetup (Attune with Aether en mano, Bosque al campo)')
        void ctx.cheatSetup({ hand: ['Attune with Aether'], battlefield: ['Forest'] })
        return
      }
      if (ctx.cardInHand('Attune with Aether')) {
        ctx.log('onSelect: lanzo Attune with Aether')
        ctx.playCardByName('Attune with Aether')
        return
      }
      ctx.pass()
    },
    // Búsqueda de Attune: una sola GAME_TARGET con las tierras básicas de la
    // biblioteca; se coge la primera (todas son Bosques). El descarte de
    // limpieza, si llega, coge una carta de la mano.
    onTarget(ctx, question, data) {
      const q = String(question ?? '')
      const pt = data?.options?.possibleTargets ?? data?.targets ?? []
      const ids = Array.isArray(pt)
        ? pt.map((o) => (typeof o === 'string' ? o : o?.id)).filter(Boolean)
        : Object.keys(pt ?? {})
      if (/discard/i.test(q)) {
        const hand = ctx.gv?.myHand ?? ctx.gv?.hand ?? {}
        const first = Object.keys(hand)[0] ?? ids[0]
        if (first) {
          ctx.log('onTarget: descarte de limpieza')
          return first
        }
        return undefined
      }
      if (ids[0]) {
        ctx.log('onTarget: cojo la primera tierra básica de la búsqueda')
        return ids[0]
      }
      return undefined
    },
    // Pago {G} explícito con Bosque (los flags de la vista no son fiables
    // durante el pago).
    onPlayMana(ctx, m) {
      const bf = Object.values(ctx.me?.battlefield ?? {})
      const forest = bf.find((c) => !c.tapped && /forest/i.test(c?.name ?? ''))
      if (forest) {
        ctx.sendAction('sendPlayerUUID', { gameId: ctx.gameId, value: forest.id })
        ctx.log('onPlayMana: giro', forest.name)
      }
    },
    // Invariante: el jugador controlado tiene el contador de jugador "energy"
    // a 2 (lo que expone el view) y Attune ya está en el cementerio.
    captureWhen(gv) {
      const me = (gv.players ?? []).find((p) => p?.controlled)
      if (!me) return false
      const energy = (me.counters ?? []).find((c) => /^energy$/i.test(String(c?.name ?? '')))
      const attuneGone = Object.values(me.graveyard ?? {}).some((c) => /attune with aether/i.test(String(c?.name ?? '')))
      return attuneGone && Number(energy?.count) === 2
    },
  }
}

export const drivers = { energy: makeEnergyDriver }

export const meta = {
  mechanic: 'energy',
  kind: 'game',
  assert: 'hasEnergy',
  note: 'Attune with Aether ({G}) resuelto: la búsqueda llega como GAME_TARGET con las tierras básicas de la biblioteca en options.possibleTargets (se devuelve un UUID, la carta va a la mano y se revela) y después GetEnergyCountersControllerEffect añade 2 contadores de energía AL JUGADOR (CounterType.ENERGY = "energy"), visibles en el view como me.counters=[{name:"energy",count:2}] (CounterView: {name,count}). Invariante: me.counters con energy=2 y la carta en el cementerio. Driver energy con cheatSetup.',
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await runRecorder(makeEnergyDriver())
}
