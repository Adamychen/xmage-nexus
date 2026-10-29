import { describe, expect, it } from 'vitest'
import { fitBand, settleBandCardW, type BandFitInput } from './bandFit'

function input(over: Partial<BandFitInput> = {}): BandFitInput {
  return {
    measuredW: 100,
    contentW: 500,
    itemCount: 5,
    gap: 10,
    availW: 1000,
    availH: 150,
    maxW: 100,
    minW: 46,
    ...over,
  }
}

describe('fitBand', () => {
  it('keeps the zone card width when everything fits', () => {
    expect(fitBand(input())).toEqual({ cardW: 100, lines: 1 })
  })

  it('shrinks to fit a single line before adding lines when height allows only one', () => {
    const fit = fitBand(input({ contentW: 1400, itemCount: 14, availH: 140 }))
    expect(fit.lines).toBe(1)
    expect(fit.cardW).toBeLessThan(100)
    expect(fit.cardW).toBeGreaterThanOrEqual(46)
  })

  it('never exceeds the zone card width', () => {
    expect(fitBand(input({ contentW: 100, itemCount: 1 })).cardW).toBe(100)
  })

  it('splits into two lines when that gives bigger cards than one line', () => {
    const one = fitBand(input({ contentW: 2400, itemCount: 24, availH: 140 }))
    const many = fitBand(input({ contentW: 2400, itemCount: 24, availH: 300 }))
    expect(many.lines).toBeGreaterThan(1)
    expect(many.cardW).toBeGreaterThan(one.cardW)
  })

  it('falls back to the floor on one line (horizontal scroll) when nothing fits', () => {
    const fit = fitBand(input({ contentW: 9000, itemCount: 90, availW: 400, availH: 150 }))
    expect(fit).toEqual({ cardW: 46, lines: 1 })
  })

  it('caps the floor at the zone width for tiny zones', () => {
    const fit = fitBand(input({ maxW: 40, contentW: 4000, itemCount: 40, availW: 300 }))
    expect(fit.cardW).toBe(40)
  })

  it('is stable: re-fitting at the chosen width yields the same width', () => {
    const first = fitBand(input({ contentW: 1400, itemCount: 14 }))
    const rescaled = 1400 * (first.cardW / 100)
    const second = fitBand(input({ measuredW: first.cardW, contentW: rescaled, itemCount: 14 }))
    expect(Math.abs(second.cardW - first.cardW)).toBeLessThanOrEqual(1)
  })

  it('ignores empty bands', () => {
    expect(fitBand(input({ itemCount: 0, contentW: 0 }))).toEqual({ cardW: 100, lines: 1 })
  })
})

describe('settleBandCardW', () => {
  it('BRD-21: a band that has to shrink by one pixel shrinks at once', () => {
    expect(settleBandCardW(65, 64, false)).toBe(64)
  })

  it('BRD-21: a band that gains only one pixel keeps its size', () => {
    expect(settleBandCardW(65, 66, false)).toBe(65)
  })

  it('BRD-21: a band that gains two pixels or more grows', () => {
    expect(settleBandCardW(65, 67, false)).toBe(67)
    expect(settleBandCardW(65, 80, false)).toBe(80)
  })

  it('BRD-21: a change of line count is always applied', () => {
    expect(settleBandCardW(65, 66, true)).toBe(66)
    expect(settleBandCardW(65, 64, true)).toBe(64)
  })

  it('BRD-21: a one-pixel A/B oscillation stays at the size it started from', () => {
    let applied = 65
    const seen: number[] = []
    for (const next of [65, 66, 65, 66]) {
      applied = settleBandCardW(applied, next, false)
      seen.push(applied)
    }
    expect(seen).toEqual([65, 65, 65, 65])
  })
})
