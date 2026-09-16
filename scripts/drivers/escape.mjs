import { pathToFileURL } from 'node:url'
import { runRecorder } from '../rec-lib.mjs'

// P4 — escape vía cheatSetup (§3.3 lanzar desde otras zonas): Phoenix of Ash
// ({1}{R}{R} 2/2 volar/prisa, Escape—{2}{R}{R}, exiliar otras 3 cartas del
// cementerio) al cementerio + 3 Montañas más al cementerio (fodder del coste)
// + 3 Montañas al campo (más la del turno = 4 manás). EscapeAbility es un
// SpellAbility BASE_ALTERNATE en Zone.GRAVEYARD: el UUID del cementerio se
// juega directo, igual que en flashback/jump-start. El coste adicional
// ExileFromGraveCost (TargetCardInYourGraveyard, 3 cartas) NO emitió
// GAME_TARGET en la corrida real: con exactamente 3 cartas legales (la propia
// Phoenix queda fuera por AnotherPredicate) el motor las auto-elige
// (TargetImpl.tryToAutoChoose: possibleTargets == min - elegidas). El onTarget
// queda preparado para el caso con fodder de sobra (4+ cartas → prompt
// interactivo, patrón del descarte de jump-start). Al resolver,
// EscapesWithAbility(1) la hace entrar con un contador +1/+1: prueba
// inequívoca del lanzamiento con escape (un hardcast no lo tendría). Captura:
// Phoenix en el campo con +1/+1 y las 3 cartas del coste en me.exile.
function makeEscapeDriver() {
  return {
    name: 'escape',
    outFile: 'escape.json',
    deck: {
      name: 'Mage Web escape rec',
      cards: [{ cardName: 'Mountain', setCode: 'LEA', cardNumber: '292', amount: 60 }],
      sideboard: [],
    },
    gameType: 'Constructed - Pioneer',
    maxMs: 420_000,
    _landTurn: -1,
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
      const turn = gv.turn ?? 0
      if (turn !== this._landTurn) {
        if (ctx.playLand()) {
          this._landTurn = turn
          ctx.log('onSelect: tierra')
          return
        }
      }
      // Regla P1: el cheat va tras ≥1 acción normal (ver counterspell).
      if (!this._cheated) {
        this._cheated = true
        ctx.log('onSelect: cheatSetup (Phoenix + 3 Montañas al cementerio, 3 Montañas al campo)')
        void ctx.cheatSetup({
          graveyard: ['Phoenix of Ash', 'Mountain', 'Mountain', 'Mountain'],
          battlefield: ['Mountain', 'Mountain', 'Mountain'],
        })
        return
      }
      // Reenviar el UUID del cementerio en cada ventana hasta que la carta
      // salga de la zona (en la pila ya no está; el coste de exilio se paga
      // por GAME_TARGET).
      const phoenix = ctx.cardInGraveyard('Phoenix of Ash')
      if (phoenix) {
        ctx.log('onSelect: lanzo Phoenix of Ash por escape')
        ctx.sendAction('sendPlayerUUID', { gameId: ctx.gameId, value: phoenix })
        return
      }
      ctx.pass()
    },
    // Por si el clic en el cementerio abre el picker de habilidades.
    onChooseAbility(opts, ctx) {
      const esc = (opts ?? []).find((o) => /escape/i.test(String(o?.label ?? '')))
      if (esc) {
        ctx.log('onChooseAbility: escape')
        return esc.value ?? esc.id
      }
      return (opts ?? [])[0]?.value
    },
    // Coste de exilio: ids en data.options.possibleTargets o en data.targets
    // (patrón de los costes con withNotTarget, igual que el descarte de
    // jump-start: "Select a card" sin possibleTargets). Una carta por prompt,
    // sin repetir las ya gastadas.
    onTarget(ctx, question, data) {
      const q = String(question ?? '').trim()
      if (/discard/i.test(q)) return undefined
      const pt = data?.options?.possibleTargets ?? data?.targets ?? []
      const ids = Array.isArray(pt)
        ? pt.map((o) => (typeof o === 'string' ? o : o?.id)).filter(Boolean)
        : Object.keys(pt ?? {})
      this._spent = this._spent ?? []
      const pick = ids.find((id) => !this._spent.includes(id))
      if (pick) {
        this._spent.push(pick)
        ctx.log('onTarget: exilio del coste de escape', ids.length, 'legales')
        return pick
      }
      return undefined
    },
    // Pago {2}{R}{R} con Montañas sin voltear (el flag isActive/hasPriority de
    // la vista no es fiable durante el pago).
    onPlayMana(ctx, m) {
      const bf = Object.values(ctx.me?.battlefield ?? {})
      const mtn = bf.find((c) => !c.tapped && /mountain/i.test(c?.name ?? ''))
      if (mtn) {
        ctx.sendAction('sendPlayerUUID', { gameId: ctx.gameId, value: mtn.id })
        ctx.log('onPlayMana: giro', mtn.name)
      }
    },
    captureWhen(gv) {
      const me = (gv.players ?? []).find((p) => p?.controlled)
      const phoenix = Object.values(me?.battlefield ?? {}).find((c) => /phoenix of ash/i.test(c?.name ?? ''))
      if (!phoenix) return false
      const p1p1 = (phoenix.counters ?? []).some(
        (k) => /\+1\/\+1/.test(String(k?.name ?? '')) && Number(k?.count ?? 0) >= 1,
      )
      const ex = me?.exile ?? {}
      const exVals = Array.isArray(ex) ? ex : Object.values(ex)
      const exiledMountains = exVals.filter((c) => /mountain/i.test(String(c?.name ?? (typeof c === 'string' ? c : '')))).length
      return p1p1 && exiledMountains >= 3
    },
  }
}

export const drivers = { escape: makeEscapeDriver }

export const meta = {
  mechanic: 'escape',
  kind: 'game',
  assert: 'hasEscape',
  note: 'Phoenix of Ash ({1}{R}{R} 2/2 volar/prisa) lanzado desde el cementerio por su coste de escape {2}{R}{R} exiliando otras 3 cartas del cementerio (con exactamente 3 legales el motor las auto-elige sin GAME_TARGET: TargetImpl.tryToAutoChoose) y entrando con contador +1/+1 por EscapesWithAbility: la carta en el campo con +1/+1 + las 3 Montañas del coste en me.exile firman el escape (un hardcast no daría contador). Driver escape con cheatSetup.',
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await runRecorder(makeEscapeDriver())
}
