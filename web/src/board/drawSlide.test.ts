import { describe, expect, it } from 'vitest'
import { drawnCardIds, drawOffset } from './drawSlide'

function rect(left: number, top: number, width: number, height: number): DOMRect {
  return { left, top, width, height, right: left + width, bottom: top + height, x: left, y: top, toJSON: () => ({}) } as DOMRect
}

describe('drawnCardIds', () => {
  it('reports nothing on the first frame (the opening hand)', () => {
    expect(drawnCardIds([], ['a', 'b', 'c'])).toEqual([])
  })

  it('reports a card added while the rest of the hand stays', () => {
    expect(drawnCardIds(['a', 'b'], ['a', 'b', 'c'])).toEqual(['c'])
  })

  it('reports a draw that happens alongside a cast', () => {
    expect(drawnCardIds(['a', 'b', 'c'], ['b', 'c', 'd'])).toEqual(['d'])
  })

  it('reports nothing on a full hand refresh (mulligan, hand switch)', () => {
    expect(drawnCardIds(['a', 'b'], ['x', 'y', 'z'])).toEqual([])
  })

  it('reports nothing when no card was added', () => {
    expect(drawnCardIds(['a', 'b'], ['a'])).toEqual([])
    expect(drawnCardIds(['a', 'b'], ['a', 'b'])).toEqual([])
  })
})

describe('drawOffset', () => {
  it('returns the distance from the slot center back to the anchor center', () => {
    expect(drawOffset(rect(100, 0, 40, 40), rect(300, 200, 100, 140))).toEqual({ dx: 120 - 350, dy: 20 - 270 })
  })
})
