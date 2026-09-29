import { describe, expect, it } from 'vitest'
import { crossZonePlayables } from '../board/crossZone'
import { makeCard, makeGameView, makePlayer } from '../__fixtures__/gameViews'
import type { GameView } from '../net/types'

/** La "ray" cross-zone: derivada de canPlayObjects, filtrando mano y
 *  battlefield (los permanents en juego se juegan por el tablero, no por
 *  el rayo). El pago de maná (basicManaAbilities) queda fuera.
 *
 *  Forma del wire real: la clave de `objects` es el id del objeto (carta) y
 *  `record.id` es el id de la habilidad (UUID distinto), así que la
 *  jugabilidad NO puede depender de `record.id === clave` (frames reales:
 *  always-attack.json; regresión del issue #2). */

function viewWithCrossZone(stats: GameView['canPlayObjects']): GameView {
  return makeGameView({
    players: [
      makePlayer({
        playerId: 'me',
        name: 'Me',
        controlled: true,
        graveyard: { 'g-1': { name: 'Grave One', manaValue: 1, expansionSetCode: 'T', cardNumber: '0', parentId: 'g-1', id: 'g-1' } },
        exile: { 'e-1': { name: 'Exile One', manaValue: 1, expansionSetCode: 'T', cardNumber: '0', parentId: 'e-1', id: 'e-1' } },
       }),
     ],
    myHand: { 'h-1': { name: 'Hand One', manaValue: 1, expansionSetCode: 'T', cardNumber: '0', parentId: 'h-1', id: 'h-1' } },
    canPlayObjects: stats,
    })
}

/** Registro con la forma real: ability id ≠ clave del objeto. */
const record = (value: string, id = 'ability-uuid') => ({ id, value })

describe('crossZonePlayables', () => {
  it('no devuelve nada sin canPlayObjects', () => {
    expect(crossZonePlayables(makeGameView({}))).toEqual([])
    expect(crossZonePlayables(null)).toEqual([])
   })

  it('excluye las cartas de la mano (se juegan por la mano, no por el rayo)', () => {
    const out = crossZonePlayables(viewWithCrossZone({ objects: { 'h-1': { basicCastAbilities: [record('cast')] } } }))
    expect(out).toEqual([])
    })

  it('lista una carta jugable desde el cementerio con la metadata resuelta de la zona', () => {
    const out = crossZonePlayables(viewWithCrossZone({ objects: { 'g-1': { other: [record('other', 'ability-g')] } } }))
    expect(out).toHaveLength(1)
    expect(out[0].id).toBe('g-1')
    expect(out[0].zone).toBe('graveyard')
    expect(out[0].card.name).toBe('Grave One')
    })

  it('lista una carta jugable desde exilio aunque el id del record sea el de la habilidad (issue #2)', () => {
    const out = crossZonePlayables(viewWithCrossZone({ objects: { 'e-1': { basicCastAbilities: [record('Cast from exile', 'b0325f02-df86-4962-8e72-5e3a1fc65224')] } } }))
    expect(out[0].zone).toBe('exile')
    expect(out[0].card.name).toBe('Exile One')
    })

  it('usa el value del record como fallback cuando no hay metadata de zona', () => {
    const out = crossZonePlayables(viewWithCrossZone({ objects: { 'x-9': { basicCastAbilities: [record('Cast from anywhere', 'ability-x')] } } }))
    expect(out[0].id).toBe('x-9')
    expect(out[0].value).toBe('Cast from anywhere')
    expect(out[0].card.name).toBe('Cast from anywhere')
    })

  it('excluye basicManaAbilities (pago de maná, no es un lanzamiento)', () => {
    const out = crossZonePlayables(viewWithCrossZone({ objects: { 'p-1': { basicManaAbilities: [record('mana', 'ability-p')] } } }))
    expect(out).toEqual([])
    })

  it('incluye la carta si viene solo en basicPlayAbilities o basicCastAbilities', () => {
    const out = crossZonePlayables(viewWithCrossZone({ objects: { 'g-1': { basicPlayAbilities: [record('play', 'ability-g')] } } }))
    expect(out[0].id).toBe('g-1')
    })

  it('resuelve el compañero desde game.companion con la carta real y zona companion', () => {
    const game = makeGameView({
      // El frame real companion-available.json trae al compañero TAMBIÉN en el
      // banquillo del dueño (viene de ahí): la zona canónica es companion.
      players: [makePlayer({
        playerId: 'me',
        name: 'Me',
        controlled: true,
        sideboard: { 'c-1': makeCard({ name: 'Lurrus of the Dream-Den', parentId: 'c-1' }) },
      })],
      companion: [{ name: 'Me', cards: { 'c-1': makeCard({ name: 'Lurrus of the Dream-Den', parentId: 'c-1' }) } }],
      canPlayObjects: { objects: { 'c-1': { other: [record('Pay {3} to put Lurrus into your hand', 'ability-c')] } } },
    })
    const out = crossZonePlayables(game)
    expect(out).toHaveLength(1)
    expect(out[0].id).toBe('c-1')
    expect(out[0].zone).toBe('companion')
    expect(out[0].card.name).toBe('Lurrus of the Dream-Den')
  })
})
