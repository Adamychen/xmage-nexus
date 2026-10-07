import { describe, expect, it } from 'vitest'
import { handDropIndex, moveHandCard, reconcileHandOrder } from './handOrder'

describe('handOrder', () => {
  it('keeps the player arrangement, drops cards that left and appends new ones', () => {
    expect(reconcileHandOrder(['c', 'a', 'b'], ['a', 'b', 'c'])).toEqual(['c', 'a', 'b'])
    expect(reconcileHandOrder(['c', 'a', 'b'], ['a', 'c'])).toEqual(['c', 'a'])
    expect(reconcileHandOrder(['c', 'a'], ['a', 'd', 'c', 'e'])).toEqual(['c', 'a', 'd', 'e'])
    expect(reconcileHandOrder([], ['x', 'y'])).toEqual(['x', 'y'])
  })

  it('moves a card to a clamped index', () => {
    expect(moveHandCard(['a', 'b', 'c'], 'a', 2)).toEqual(['b', 'c', 'a'])
    expect(moveHandCard(['a', 'b', 'c'], 'c', 0)).toEqual(['c', 'a', 'b'])
    expect(moveHandCard(['a', 'b', 'c'], 'b', 99)).toEqual(['a', 'c', 'b'])
    expect(moveHandCard(['a', 'b', 'c'], 'z', 0)).toEqual(['a', 'b', 'c'])
  })

  it('drops at the count of other cards left of the pointer', () => {
    expect(handDropIndex(5, [10, 20, 30])).toBe(0)
    expect(handDropIndex(25, [10, 20, 30])).toBe(2)
    expect(handDropIndex(99, [10, 20, 30])).toBe(3)
  })
})
