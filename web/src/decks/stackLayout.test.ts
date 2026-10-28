import { describe, expect, it } from 'vitest'
import type { StackItem } from './ArenaCardStacks'
import { layoutStack } from './stackLayout'
import type { DeckCard } from '../lobby/decks'

function item(name: string, amount: number): StackItem {
  const card: DeckCard = { cardName: name, setCode: 'LEA', cardNumber: name, amount }
  return { key: `LEA:${name}:${name}`, card }
}

const opts = { peek: 34, copyOffset: 5, cardHeight: 250 }

describe('layoutStack', () => {
  it('DCK-8: separate draws one entry per copy, each copyOffset below the previous copy of the same card', () => {
    const { cards } = layoutStack([item('Mountain', 3)], { copies: 'separate', ...opts })
    expect(cards.map((c) => c.top)).toEqual([0, 5, 10])
    expect(cards.map((c) => c.amount)).toEqual([3, 3, 3])
  })

  it('DCK-8: separate puts the next distinct card a peek below the last copy', () => {
    const { cards } = layoutStack([item('Mountain', 3), item('Island', 2)], { copies: 'separate', ...opts })
    expect(cards.map((c) => c.top)).toEqual([0, 5, 10, 10 + 34, 10 + 34 + 5])
  })

  it('DCK-8: separate marks only the last copy of each card as front', () => {
    const { cards } = layoutStack([item('Mountain', 3), item('Island', 2)], { copies: 'separate', ...opts })
    expect(cards.map((c) => c.front)).toEqual([false, false, true, false, true])
    expect(cards.map((c) => c.itemKey)).toEqual([
      'LEA:Mountain:Mountain', 'LEA:Mountain:Mountain', 'LEA:Mountain:Mountain',
      'LEA:Island:Island', 'LEA:Island:Island',
    ])
  })

  it('DCK-8: separate gives every copy its own key and a stacking order that rises with the position', () => {
    const { cards } = layoutStack([item('Mountain', 2), item('Island', 1)], { copies: 'separate', ...opts })
    expect(new Set(cards.map((c) => c.key)).size).toBe(cards.length)
    expect(cards.map((c) => c.z)).toEqual([0, 1, 2])
  })

  it('DCK-8: together draws one entry per card, a peek apart, all front', () => {
    const { cards } = layoutStack([item('Mountain', 20), item('Island', 4)], { copies: 'together', ...opts })
    expect(cards.map((c) => c.key)).toEqual(['LEA:Mountain:Mountain', 'LEA:Island:Island'])
    expect(cards.map((c) => c.top)).toEqual([0, 34])
    expect(cards.map((c) => c.front)).toEqual([true, true])
    expect(cards.map((c) => c.amount)).toEqual([20, 4])
  })

  it('DCK-8: the height is the last top plus one card, and zero for an empty stack', () => {
    expect(layoutStack([item('Mountain', 3)], { copies: 'separate', ...opts }).height).toBe(10 + 250)
    expect(layoutStack([item('Mountain', 20), item('Island', 4)], { copies: 'together', ...opts }).height).toBe(34 + 250)
    expect(layoutStack([], { copies: 'separate', ...opts })).toEqual({ cards: [], height: 0 })
  })
})
