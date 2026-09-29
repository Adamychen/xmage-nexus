import { pathToFileURL } from 'node:url'
import { runRecorder } from '../rec-lib.mjs'

// P4 — Companion DISPONIBLE (issue #3): el frame `companion.json` captura el
// estado POST-pago (Lurrus ya en la mano), así que no fija la forma del wire
// que habilita la acción: `canPlayObjects` con el compañero en el bucket
// `other` (CompanionAbility extends SpecialAction, Zone.OUTSIDE).
//
// Este driver juega la misma partida que `companion.mjs` (Lurrus en el
// banquillo; 24 Bosques + 36 Grizzly Bears para que la condición Companion sea
// legal) pero se DETIENE antes de pagar: captura el primer game view en el que
// el id del compañero aparece en `canPlayObjects` con algún record de los
// buckets jugables. Es la forma que el visor del web debe ofrecer como clicable
// (clave del mapa = id de carta; record.id = id de habilidad, distinto).
const LURRUS = { cardName: 'Lurrus of the Dream-Den', setCode: 'iko', cardNumber: '226' }
const FOREST = { cardName: 'Forest', setCode: 'iko', cardNumber: '272' }
const GRIZZLY = { cardName: 'Grizzly Bears', setCode: 'LEA', cardNumber: '195' }

const PLAYABLE_BUCKETS = ['basicCastAbilities', 'basicPlayAbilities', 'other']

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

function myCompanionId(gv) {
  const me = (gv?.players ?? []).find((p) => p?.controlled)
  const name = String(me?.name ?? '')
  for (const entry of gv?.companion ?? []) {
    const owner = String(entry?.name ?? '')
    if (name && !owner.toLowerCase().includes(name.toLowerCase())) continue
    const id = Object.keys(entry?.cards ?? {})[0]
    if (id) return String(id)
  }
  return null
}

function makeCompanionAvailableDriver() {
  return {
    name: 'companion-available',
    outFile: 'companion-available.json',
    deck: companionDeck('Mage Web companion available rec'),
    simDeck: companionDeck('Mage Sim companion'),
    gameType: 'Constructed - Pioneer',
    maxMs: 300_000,
    _landTurn: -1,
    _cheated: false,
    onAsk(q) {
      if (/as your companion/i.test(String(q ?? ''))) return true
      return undefined
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
        ctx.log('onSelect: cheatSetup (2 Bosques al campo para poder pagar {3})')
        void ctx.cheatSetup({ battlefield: ['Forest', 'Forest'] })
        return
      }
      // Sin pagar: la captura ocurre en el GAME_SELECT/GAME_UPDATE que anuncia
      // la SpecialAction; no hay que ejecutarla.
      ctx.pass()
    },
    onPlayMana(ctx) {
      const forest = Object.values(ctx.me?.battlefield ?? {}).find((c) => !c.tapped && /forest/i.test(c?.name ?? ''))
      if (forest) ctx.sendAction('sendPlayerUUID', { gameId: ctx.gameId, value: forest.id })
    },
    captureWhen(gv) {
      const id = myCompanionId(gv)
      if (!id) return false
      const stats = gv?.canPlayObjects?.objects?.[id]
      if (!stats) return false
      const playable = PLAYABLE_BUCKETS.some((bucket) => (stats[bucket] ?? []).length > 0)
      if (!playable) return false
      const hand = Object.values(gv?.myHand ?? {})
      return !hand.some((c) => /lurrus/i.test(String(c?.name ?? '')))
    },
  }
}

export const drivers = { 'companion-available': makeCompanionAvailableDriver }

export const meta = {
  mechanic: 'companion-available',
  kind: 'game',
  assert: 'hasCompanionPlayable',
  note: 'Companion DISPONIBLE (Lurrus of the Dream-Den en el banquillo; mazo 24 Bosques + 36 Grizzly Bears, MV ≤ 2 para que la condición sea legal). Al inicializar el motor pregunta "Use Lurrus … as your companion?" (chooseUse) y el driver responde SÍ; el compañero queda en la zona de compañero (GameView.companion, RevealedView). El driver juega la tierra del turno + 2 Bosques por cheatSetup y se detiene SIN pagar: captura el primer game view en el que el id de la carta (clave de canPlayObjects.objects) aparece con un record de los buckets jugables [normalmente `other`, CompanionAbility extends SpecialAction] — la forma exacta que debe habilitar el clic del visor web (issue #3). El record.id es el id de la habilidad, DISTINTO de la clave: un cliente que compare ambos nunca ofrece la acción (bug que el frame fija). Captura: Lurrus aún en la zona de compañero (NO en la mano), canPlayObjects.objects[id] con bucket no vacío.',
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await runRecorder(makeCompanionAvailableDriver())
}
