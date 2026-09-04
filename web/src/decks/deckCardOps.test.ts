import { describe, expect, it } from 'vitest'
import {
  deckCardKey, moveOneBetween, incrementInList, decrementInList, removeFromList,
  mergeIntoList, insertOrIncrement, addSearchResult, applyPrinting, replaceBasicLands,
  stripMetaFromSearch, stripMetaFromJson,
} from './deckCardOps'
import type { DeckCard } from '../lobby/decks'

const bolt = (over: Partial<DeckCard> = {}): DeckCard => ({
  cardName: 'Lightning Bolt', setCode: 'M10', cardNumber: '146', amount: 4, ...over,
})

describe('deckCardKey', () => {
  it('compone set:número:nombre', () => {
    expect(deckCardKey(bolt())).toBe('M10:146:Lightning Bolt')
  })
})

describe('moveOneBetween', () => {
  it('mueve una copia y la añade al destino', () => {
    const [from, to] = moveOneBetween([bolt()], [], 'M10:146:Lightning Bolt')
    expect(from[0].amount).toBe(3)
    expect(to).toEqual([{ ...bolt(), amount: 1 }])
  })
  it('elimina el origen cuando era la última copia', () => {
    const [from, to] = moveOneBetween([bolt({ amount: 1 })], [], 'M10:146:Lightning Bolt')
    expect(from).toEqual([])
    expect(to[0].amount).toBe(1)
  })
  it('devuelve las listas intactas con clave desconocida', () => {
    const from = [bolt()]
    const [f, t] = moveOneBetween(from, [], 'XXX:0:Nope')
    expect(f).toBe(from)
    expect(t).toEqual([])
  })
})

describe('increment/decrement/remove', () => {
  it('increment topa en 99', () => {
    expect(incrementInList([bolt({ amount: 99 })], 'M10:146:Lightning Bolt')[0].amount).toBe(99)
    expect(incrementInList([bolt({ amount: 1 })], 'M10:146:Lightning Bolt')[0].amount).toBe(2)
  })
  it('decrement elimina al llegar a 0', () => {
    expect(decrementInList([bolt({ amount: 1 })], 'M10:146:Lightning Bolt')).toEqual([])
    expect(decrementInList([bolt({ amount: 2 })], 'M10:146:Lightning Bolt')[0].amount).toBe(1)
  })
  it('remove filtra por clave', () => {
    expect(removeFromList([bolt()], 'M10:146:Lightning Bolt')).toEqual([])
  })
})

describe('mergeIntoList', () => {
  it('suma cantidades y añade nuevas con tope 99', () => {
    const merged = mergeIntoList(
      [bolt({ amount: 98 })],
      [bolt({ amount: 5 }), { cardName: 'Mountain', setCode: 'M10', cardNumber: '234', amount: 10 }],
    )
    expect(merged.find((c) => c.cardName === 'Lightning Bolt')!.amount).toBe(99)
    expect(merged.find((c) => c.cardName === 'Mountain')!.amount).toBe(10)
  })
})

describe('insertOrIncrement', () => {
  it('añade carta nueva con amount 1', () => {
    const { list, replacedOldKey } = insertOrIncrement([], { cardName: 'Bolt', setCode: 'M10', cardNumber: '146' }, new Set())
    expect(list).toEqual([{ cardName: 'Bolt', setCode: 'M10', cardNumber: '146', amount: 1 }])
    expect(replacedOldKey).toBeNull()
  })
  it('suma 1 si ya existe la impresión', () => {
    const { list } = insertOrIncrement([bolt({ amount: 1 })], { cardName: 'Lightning Bolt', setCode: 'M10', cardNumber: '146' }, new Set())
    expect(list[0].amount).toBe(2)
  })
  it('reemplaza la impresión marcada por el servidor y devuelve la clave vieja', () => {
    const flagged = new Set(['Lightning Bolt|M10|146'])
    const { list, replacedOldKey } = insertOrIncrement(
      [bolt()], { cardName: 'Lightning Bolt', setCode: 'LEA', cardNumber: '161' }, flagged,
    )
    expect(list[0]).toMatchObject({ setCode: 'LEA', cardNumber: '161', amount: 4 })
    expect(replacedOldKey).toBe('M10:146:Lightning Bolt')
  })
})

describe('addSearchResult', () => {
  const search = {
    name: 'Lightning Bolt', set: 'm10', collector_number: '146',
    mana_cost: '{R}', cmc: 1, type_line: 'Instant', colors: ['R'],
  } as never
  it('añade normalizando set a mayúsculas', () => {
    const { cards, card } = addSearchResult([], search)
    expect(cards).toEqual([bolt({ amount: 1 })])
    expect(card).toMatchObject({ setCode: 'M10', cardNumber: '146' })
  })
  it('suma si ya existe', () => {
    expect(addSearchResult([bolt({ amount: 1 })], search).cards[0].amount).toBe(2)
  })
})

describe('applyPrinting', () => {
  it('cambia impresión en main y side conservando cantidades', () => {
    const side = [bolt({ amount: 2 })]
    const { cards, sideboard, printing } = applyPrinting([bolt()], side, bolt(), 'LEA', '161')
    expect(printing).toEqual({ setCode: 'LEA', cardNumber: '161' })
    expect(cards[0]).toMatchObject({ setCode: 'LEA', cardNumber: '161', amount: 4 })
    expect(sideboard[0]).toMatchObject({ setCode: 'LEA', cardNumber: '161', amount: 2 })
  })
  it('preserva el case que devuelva normalizeDeckCard (igual que el original)', () => {
    const { printing } = applyPrinting([bolt()], [], bolt(), 'lea', '161')
    expect(printing).toEqual({ setCode: 'lea', cardNumber: '161' })
  })
})

describe('replaceBasicLands', () => {
  it('sustituye básicas por la base sugerida y conserva el resto', () => {
    const next = replaceBasicLands(
      [bolt(), { cardName: 'Mountain', setCode: 'M10', cardNumber: '234', amount: 20 }],
      [{ name: 'Island', setCode: 'M10', cardNumber: '230', amount: 18 }],
    )
    expect(next.find((c) => c.cardName === 'Lightning Bolt')).toBeTruthy()
    expect(next.find((c) => c.cardName === 'Mountain')).toBeUndefined()
    expect(next.find((c) => c.cardName === 'Island')!.amount).toBe(18)
  })
})

describe('strip meta builders', () => {
  it('stripMetaFromSearch mapea campos de búsqueda', () => {
    const meta = stripMetaFromSearch({
      name: 'Bolt', mana_cost: '{R}', cmc: 1, printed_type_line: 'Instant',
      colors: ['R'],
    } as never)
    expect(meta).toMatchObject({ manaCost: '{R}', cmc: 1, typeLine: 'Instant', colors: ['R'] })
  })
  it('stripMetaFromJson prefiere cara impresa y tolera ausencias', () => {
    const meta = stripMetaFromJson({ cmc: 3, card_faces: [{ mana_cost: '{1}{R}' }] })
    expect(meta).toMatchObject({ manaCost: '{1}{R}', cmc: 3, imageUrl: null })
  })
})
