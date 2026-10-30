import { describe, expect, it } from 'vitest'
import { spreadLayout } from './stackSpread'

const pile = (n: number, left = 100, width = 50, step = 7) =>
  Array.from({ length: n }, (_, i) => ({ left: left + i * step, width }))

describe('spreadLayout', () => {
  it('fans the pile out to the right of its first card', () => {
    const { dx, stripLeft, stripWidth } = spreadLayout(pile(3), 6, 1000)
    expect(dx).toEqual([0, 56 - 7, 112 - 14])
    expect(stripLeft).toBe(100)
    expect(stripWidth).toBe(162)
  })

  it('BRD-23: a fan at the band edge compresses and never starts left of its pile', () => {
    const { dx, stripLeft, stripWidth } = spreadLayout(pile(3, 900), 6, 1000)
    expect(stripLeft).toBe(900)
    expect(stripLeft + stripWidth).toBeCloseTo(1000)
    expect(dx[0]).toBe(0)
  })

  it('BRD-23: a fan never reaches back over the permanents before its pile', () => {
    const { stripLeft } = spreadLayout(pile(10, 900), 6, 1000)
    expect(stripLeft).toBe(900)
  })

  it('compresses the fan when the band is narrower than the spread pile', () => {
    const { dx, stripLeft, stripWidth } = spreadLayout(pile(10, 20), 6, 310)
    expect(stripLeft).toBe(20)
    expect(stripWidth).toBeCloseTo(290)
    const lefts = pile(10, 20).map((it, i) => it.left + dx[i])
    expect(lefts[9] + 50).toBeCloseTo(310)
  })

  it('handles an empty pile', () => {
    expect(spreadLayout([], 6, 100)).toEqual({ dx: [], stripLeft: 0, stripWidth: 0 })
  })
})
