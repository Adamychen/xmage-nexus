import { pathToFileURL } from 'node:url'
import { runRecorder } from '../rec-lib.mjs'

// P4 — reducción de coste (§3.2) vía cheatSetup: Goblin Electromancer
// (GRN 174, {U}{R} 2/2; estático SpellsCostReductionControllerEffect:
// "Instant and sorcery spells you cast cost {1} less to cast") + Lightning
// Strike (M19 152, {1}{R}, 3 daños a cualquier objetivo). Mazo todo-Montañas:
// T1 se juega la Montaña del turno (acción normal previa al cheat) y el cheat
// añade a la mano los dos hechizos y al campo una Isla + una Montaña: 3 tierras
// en total (2 Montañas + 1 Isla). Se lanza el Electromancer ({U}{R} → giradas
// Isla+Montaña) y después el Strike, que con el Electromancer fuera cuesta
// {R} en vez de {1}{R} (el prompt de maná pide 1 maná, no 2): solo queda una
// Montaña sin girar y con ella se paga. Invariante del frame: el Strike en el
// cementerio, el Electromancer en el campo, las 3 ÚNICAS tierras giradas y el
// rival a 17 — coste nominal total 4 manás ({U}{R} + {1}{R}) pagado con 3, lo
// que es imposible sin la reducción.
function makeReduceCostDriver() {
  return {
    name: 'reduce-cost',
    outFile: 'reduce-cost.json',
    deck: {
      name: 'Mage Web reduce cost rec',
      cards: [{ cardName: 'Mountain', setCode: 'LEA', cardNumber: '292', amount: 60 }],
      sideboard: [],
    },
    gameType: 'Constructed - Pioneer',
    maxMs: 300_000,
    _acted: false,
    _cheated: false,
    _elec: false,
    _strike: false,
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
      // Regla P1: el cheat va tras ≥1 acción normal (la tierra del T1) y no se
      // juegan más tierras después para que el frame tenga exactamente 3.
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
        ctx.log('onSelect: cheatSetup (Electromancer + Strike a la mano, Isla + Montaña al campo)')
        void ctx.cheatSetup({
          hand: ['Goblin Electromancer', 'Lightning Strike'],
          battlefield: ['Island', 'Mountain'],
        })
        return
      }
      // Primero el Electromancer ({U}{R}); se exige ≥3 manás sin girar para
      // que el Strike reducido ({R}) siga siendo pagable después.
      if (!this._elec && !ctx.findOnBattlefield('Goblin Electromancer') && ctx.cardInHand('Goblin Electromancer') && ctx.untappedMana() >= 3) {
        this._elec = true
        ctx.log('onSelect: lanzo Goblin Electromancer')
        ctx.playCardByName('Goblin Electromancer')
        return
      }
      // Después el Strike: con el Electromancer en el campo su {1}{R} cuesta {R}.
      if (this._elec && ctx.findOnBattlefield('Goblin Electromancer') && !this._strike && ctx.cardInHand('Lightning Strike')) {
        this._strike = true
        ctx.log('onSelect: lanzo Lightning Strike (coste ya reducido)')
        ctx.playCardByName('Lightning Strike')
        return
      }
      ctx.pass()
    },
    // Pago color-aware: el prompt de maná trae el símbolo restante (patrón del
    // driver modal). El {U} del Electromancer se paga con la Isla; el {R} del
    // Electromancer y el del Strike con Montañas (una cada vez).
    onPlayMana(ctx, m) {
      const msg = String(m?.data?.message ?? '')
      const bf = Object.values(ctx.me?.battlefield ?? {}).filter(
        (c) => !c.tapped && (c.cardTypes ?? []).includes('LAND'),
      )
      const wantU = /\{U\}/.test(msg)
      const wantR = /\{R\}/.test(msg)
      const island = bf.find((c) => /island/i.test(c?.name ?? ''))
      const mountain = bf.find((c) => /mountain/i.test(c?.name ?? ''))
      const pick = (wantU && island) || (wantR && mountain) || island || mountain || bf[0]
      if (pick) {
        ctx.sendAction('sendPlayerUUID', { gameId: ctx.gameId, value: pick.id })
        ctx.log('onPlayMana: giro', pick.name, 'para', msg.slice(0, 40))
      }
    },
    // El único objetivo propio de la partida es el rival (Lightning Strike a
    // la cara); el descarte de limpieza (si aparece) gasta Montañas.
    onTarget(ctx, question, data) {
      const q = String(question ?? '')
      const idsOf = (src) =>
        Array.isArray(src)
          ? src.map((o) => (typeof o === 'string' ? o : o?.id)).filter(Boolean)
          : Object.keys(src ?? {})
      if (/discard/i.test(q)) {
        const ids = idsOf(data?.options?.possibleTargets ?? data?.targets)
        const mtn = ids.find((id) => /mountain/i.test(ctx.gv?.myHand?.[id]?.name ?? ''))
        if (mtn) return mtn
        if (ids[0]) return ids[0]
        const hand = ctx.cardInHand('Mountain')
        return hand ?? undefined
      }
      const opp = (ctx.gv?.players ?? []).find((p) => !p?.controlled)
      const id = opp?.playerId ?? opp?.id
      if (id) {
        ctx.log('onTarget: Lightning Strike a la cara del rival')
        return id
      }
      return undefined
    },
    captureWhen(gv) {
      const me = (gv.players ?? []).find((p) => p?.controlled)
      const sim = (gv.players ?? []).find((p) => !p?.controlled)
      const bf = Object.values(me?.battlefield ?? {})
      const elec = bf.some((c) => /goblin electromancer/i.test(c?.name ?? ''))
      const gy = me?.graveyard ?? {}
      const gyVals = Array.isArray(gy) ? gy : Object.values(gy)
      const strikeGy = gyVals.some((c) => /lightning strike/i.test(c?.name ?? (typeof c === 'string' ? c : '')))
      const lands = bf.filter((c) => (c.cardTypes ?? []).includes('LAND'))
      const tapped = lands.filter((c) => c.tapped === true).length
      const strikeOnStack = Object.values(gv?.stack ?? {}).some((s) => /lightning strike/i.test(s?.name ?? ''))
      return (
        elec &&
        strikeGy &&
        !strikeOnStack &&
        lands.length === 3 &&
        tapped === 3 &&
        Number(sim?.life ?? 20) === 17
      )
    },
  }
}

export const drivers = { 'reduce-cost': makeReduceCostDriver }

export const meta = {
  mechanic: 'reduce-cost',
  kind: 'game',
  assert: 'hasReduceCost',
  note: 'Goblin Electromancer (GRN 174, {U}{R}; "Instant and sorcery spells you cast cost {1} less") + Lightning Strike (M19 152, {1}{R}) vía cheatSetup con solo 3 tierras (Montaña del T1 + Isla y Montaña cheateadas): el Electromancer se paga {U}{R} (Isla+Montaña giradas) y el Strike, ya con el Electromancer en el campo, se paga con la última Montaña — el prompt de maná pide {R} (1 maná) en vez de {1}{R}. Captura: Strike en el cementerio propio, Electromancer en el campo, las 3 únicas tierras giradas y el rival a 17 — coste nominal 4 manás pagado con 3, imposible sin la reducción. Driver reduce-cost con cheatSetup.',
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await runRecorder(makeReduceCostDriver())
}
