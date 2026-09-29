import { pathToFileURL } from 'node:url'
import { runRecorder } from '../rec-lib.mjs'

// Issue #1 — revelado del RIVAL: cuando el oponente busca en su biblioteca y
// revela (p. ej. Brightglass Gearhulk / Trinket Mage), su dueño ve el visor
// pero el rival dice que no le llega ningún popup. Este driver monta el caso
// sin tocar al humano: la SIM juega un mazo de Islas + Trinket Mage ({2}{U},
// ETB: busca un artefacto MV ≤ 1, LO REVELA y va a la mano) y el humano solo
// pasa. captureWhen exige una entrada de `GameView.revealed` con la carta
// revelada (Ornithopter/Memnite) — es decir, el revelado del rival llegando a
// MI vista. Si el frame no captura, el canal no lo está emitiendo.
//
// El visor del web (InfoWindows) pinta `game.revealed` automáticamente; este
// frame fija la forma real para el replay y el invariante.
const FOREST = { cardName: 'Forest', setCode: 'iko', cardNumber: '272' }
const ISLAND = { cardName: 'Island', setCode: 'iko', cardNumber: '263' }
const TRINKET = { cardName: 'Trinket Mage', setCode: 'ddu', cardNumber: '41' }
const ORNITHOPTER = { cardName: 'Ornithopter', setCode: 'm10', cardNumber: '216' }
const MEMNITE = { cardName: 'Memnite', setCode: 'som', cardNumber: '174' }

function humanDeck(name) {
  return { name, cards: [{ ...FOREST, amount: 60 }], sideboard: [] }
}

function simDeck(name) {
  return {
    name,
    cards: [
      { ...ISLAND, amount: 38 },
      { ...TRINKET, amount: 6 },
      { ...ORNITHOPTER, amount: 8 },
      { ...MEMNITE, amount: 6 },
    ],
    sideboard: [],
  }
}

function makeOpponentRevealDriver() {
  return {
    name: 'opponent-reveal',
    outFile: 'opponent-reveal.json',
    deck: humanDeck('Mage Web opponent reveal rec'),
    simDeck: simDeck('Mage Sim opponent reveal'),
    gameType: 'Constructed - Pioneer',
    maxMs: 300_000,
    _landTurn: -1,
    onSelect(ctx) {
      // Humano espectador de lujo: juega su tierra (mantiene la mano en 7, sin
      // descarte de limpieza) y pasa; la SIM hace todo.
      const turn = ctx.gv?.turn ?? 0
      if (turn !== this._landTurn) {
        if (ctx.playLand()) {
          this._landTurn = turn
          return
        }
      }
      ctx.pass()
    },
    onTarget(ctx, question) {
      if (/discard/i.test(String(question ?? ''))) {
        const hand = ctx.gv?.myHand ?? ctx.gv?.hand ?? {}
        return Object.keys(hand)[0] ?? false
      }
      return undefined
    },
    captureWhen(gv) {
      const entries = gv?.revealed ?? []
      if (entries.length > 0) {
        console.log('[opponent-reveal] revealed:', JSON.stringify(entries.map((e) => ({
          name: e?.name,
          cards: Object.values(e?.cards ?? {}).map((c) => c?.name),
        }))))
      }
      return entries.some((e) =>
        Object.values(e?.cards ?? {}).some((c) => /ornithopter|memnite|trinket mage/i.test(String(c?.name ?? ''))),
      )
    },
  }
}

export const drivers = { 'opponent-reveal': makeOpponentRevealDriver }

export const meta = {
  mechanic: 'opponent-reveal',
  kind: 'game',
  assert: 'hasOpponentReveal',
  note: 'Revelado del RIVAL (issue #1): la SIM juega Trinket Mage ({2}{U}; ETB busca un artefacto MV ≤ 1, lo revela y lo pone en su mano) y el humano (60 Bosques, solo pasa) captura el game view con la entrada de `GameView.revealed` del oponente. Fija que el revelado de una búsqueda ajena llega a MI vista (y por tanto el visor `InfoWindows` del web debe pintarlo): la entrada se llama como la carta fuente ("Trinket Mage") y trae el artefacto buscado (Ornithopter/Memnite) como CardView.',
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await runRecorder(makeOpponentRevealDriver())
}
