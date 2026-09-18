import { pathToFileURL } from 'node:url'
import { runRecorder } from '../rec-lib.mjs'

// P4 — Companion revelado (§3.1/G12-2): Lurrus of the Dream-Den va en el
// BANQUILLO del mazo (la condición Companion exige que cada permanente del
// mazo tenga MV ≤ 2: 24 Bosques + 36 Grizzly Bears valen). Al arrancar la
// partida el motor pregunta "Use Lurrus … as your companion?" (chooseUse,
// GameImpl.init) → el driver responde SÍ y la carta queda en la zona de
// compañero (GameView.companion, RevealedView) con la SpecialAction de pagar
// {3} ofrecida en canPlayObjects (CompanionAbility extends SpecialAction).
//
// El SIM lleva el MISMO mazo con Lurrus en el banquillo para que el frame
// pruebe también "visible en zona del rival": tras pagar {3} la copia propia
// pasa a la mano y la del SIM sigue en su zona de compañero.
const LURRUS = { cardName: 'Lurrus of the Dream-Den', setCode: 'iko', cardNumber: '226' }
const FOREST = { cardName: 'Forest', setCode: 'iko', cardNumber: '272' }
const GRIZZLY = { cardName: 'Grizzly Bears', setCode: 'LEA', cardNumber: '195' }

function companionDeck(name) {
  return {
    name,
    cards: [
      { ...FOREST, amount: 24 },
      { ...GRIZZLY, amount: 36 },
    ],
    sideboard: [LURRUS],
  }
}

function makeCompanionDriver() {
  return {
    name: 'companion',
    outFile: 'companion.json',
    deck: companionDeck('Mage Web companion rec'),
    simDeck: companionDeck('Mage Sim companion'),
    gameType: 'Constructed - Pioneer',
    maxMs: 300_000,
    _landTurn: -1,
    _cheated: false,
    _paid: false,
    // El motor pregunta por CADA compañero legal del banquillo al inicializar.
    onAsk(q) {
      if (/as your companion/i.test(String(q ?? ''))) return true
      return undefined
    },
    // Zona de compañero propia: la entrada se llama "<nombre>'s companion".
    myCompanionId(ctx) {
      const me = ctx.me
      const name = String(me?.name ?? '')
      for (const entry of ctx.gv?.companion ?? []) {
        const owner = String(entry?.name ?? '')
        if (name && !owner.toLowerCase().includes(name.toLowerCase())) continue
        const cards = entry?.cards ?? {}
        const id = Object.keys(cards)[0] ?? cards?.id
        if (id) return String(id)
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
          ctx.log('onSelect: tierra T', turn)
          return
        }
      }
      if (!this._cheated) {
        this._cheated = true
        ctx.log('onSelect: cheatSetup (2 Bosques al campo para pagar {3})')
        void ctx.cheatSetup({ battlefield: ['Forest', 'Forest'] })
        return
      }
      if (!this._paid && ctx.untappedMana() >= 3) {
        const id = this.myCompanionId(ctx)
        if (id) {
          this._paid = true
          ctx.log('onSelect: pago {3} del compañero (click en la carta)')
          ctx.sendAction('sendPlayerUUID', { gameId: ctx.gameId, value: id })
          return
        }
      }
      ctx.pass()
    },
    onPlayMana(ctx) {
      const forest = Object.values(ctx.me?.battlefield ?? {}).find((c) => !c.tapped && /forest/i.test(c?.name ?? ''))
      if (forest) {
        ctx.sendAction('sendPlayerUUID', { gameId: ctx.gameId, value: forest.id })
        ctx.log('onPlayMana: giro', forest.name)
      }
    },
    captureWhen(gv) {
      if (!this._paid) return false
      const hand = Object.values(gv?.myHand ?? gv?.hand ?? {})
      return hand.some((c) => /lurrus/i.test(c?.name ?? ''))
    },
  }
}

export const drivers = { companion: makeCompanionDriver }

export const meta = {
  mechanic: 'companion',
  kind: 'game',
  assert: 'hasCompanion',
  note: 'Companion revelado (Lurrus of the Dream-Den en el BANQUILLO; mazo 24 Bosques + 36 Grizzly Bears, todos los permanentes MV ≤ 2 para que la condición Companion sea legal). Al inicializar, el motor pregunta "Use Lurrus … as your companion?" (chooseUse) y el driver responde SÍ; la carta queda en la zona de compañero (GameView.companion, RevealedView) con la SpecialAction de pagar {3} (CompanionAbility extends SpecialAction). El driver clica la carta desde la zona para pagar {3} (con 3 Bosques: la tierra del turno + 2 cheateados) y la copia propia pasa a la mano; el SIM lleva el mismo mazo con Lurrus para que la entrada del rival siga visible en la zona de compañero. Captura: Lurrus en mi mano + zona de compañero ajena aún poblada + vida sin cambios.',
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await runRecorder(makeCompanionDriver())
}
