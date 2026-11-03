import { describe, expect, it } from 'vitest'
import { solveRow, type RowInput } from './solveRow'

const CARD = { a: 1, b: 0 }

function row(over: Partial<RowInput> = {}): RowInput {
  return {
    width: 400,
    height: 200,
    bands: [],
    gap: 10,
    padX: 8,
    padY: 2,
    rowGap: 2,
    bandGap: 8,
    aspect: 1.4,
    minW: 46,
    maxW: 240,
    ...over,
  }
}

describe('BRD-2: the marquee band beside the creatures', () => {
  const creatures = Array.from({ length: 7 }, () => CARD)
  const marquee = { id: 'marquee', items: [CARD], minWidthCards: 1, maxWidthNeed: true, frameW: 3 }

  it('BRD-2: the marquee band is never narrower than one card plus padding and never wider than its card needs, while the creatures keep the rest', () => {
    const out = solveRow(row({ bands: [{ id: 'creatures', items: creatures }, marquee] }))
    const band = Object.fromEntries(out.bands.map((b) => [b.id, b]))
    expect(out.cardW).toBe(65)
    expect(band.marquee.width).toBeGreaterThanOrEqual(out.cardW + 2 * 8 + 3)
    expect(band.marquee.width).toBe(out.cardW + 2 * 8 + 3)
    expect(band.marquee.cardW).toBe(out.cardW)
    expect(band.creatures.width).toBe(400 - 8 - band.marquee.width)
  })

  it('BRD-2: in the floor case the marquee band still takes no more than its card needs', () => {
    const out = solveRow(row({ width: 400, height: 50, minW: 46, maxW: 46, bands: [{ id: 'creatures', items: [CARD] }, marquee] }))
    const band = Object.fromEntries(out.bands.map((b) => [b.id, b]))
    expect(out.cardW).toBe(46)
    expect(band.marquee.width).toBe(46 + 2 * 8 + 3)
    expect(band.marquee.overflow).toBe(false)
    expect(band.creatures.width).toBe(400 - 8 - band.marquee.width)
  })
})

describe('solveRow', () => {
  it('solveRow: leaves out a band without items and reports the others in input order', () => {
    const out = solveRow(
      row({
        bands: [
          { id: 'empty', items: [] },
          { id: 'lands', items: [CARD, CARD] },
          { id: 'others', items: [CARD] },
        ],
      }),
    )
    expect(out.bands.map((b) => b.id)).toEqual(['lands', 'others'])
  })

  it('solveRow: a single band that fits takes exactly the row width', () => {
    const out = solveRow(row({ bands: [{ id: 'creatures', items: [CARD, CARD] }] }))
    expect(out.bands).toHaveLength(1)
    expect(out.bands[0].width).toBe(400)
    expect(out.bands[0].overflow).toBe(false)
  })

  it('solveRow: a row with no bands is a row of the largest card width', () => {
    expect(solveRow(row({ bands: [] })).cardW).toBe(240)
  })
})
