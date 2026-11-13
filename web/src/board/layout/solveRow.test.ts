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

describe('BRD-32: creatures prefer one line', () => {
  const creatures = (preferOneLine: boolean) => ({ id: 'creatures', items: Array.from({ length: 6 }, () => CARD), preferOneLine })

  it('BRD-32: keeps one line while its cards stay at least 75% of the two-line size', () => {
    expect(solveRow(row({ width: 700, height: 330, bands: [creatures(false)] })).bands[0].lines).toBe(2)
    const out = solveRow(row({ width: 700, height: 330, bands: [creatures(true)] }))
    expect(out.bands[0].lines).toBe(1)
    expect(out.bands[0].overflow).toBe(false)
  })

  it('BRD-32: wraps when one line would leave the cards much smaller', () => {
    expect(solveRow(row({ width: 700, height: 500, bands: [creatures(true)] })).bands[0].lines).toBe(2)
  })
})

describe('BRD-33: the planeswalker zone uses its own lines and the height below the row', () => {
  const creatures = { id: 'creatures', items: [CARD, CARD, CARD] }
  const zone = (count: number, extraHeight = 0) => ({
    id: 'marquee',
    items: Array.from({ length: count }, () => CARD),
    minWidthCards: 1,
    maxWidthNeed: true,
    fixedLines: count === 1 ? 1 : 2,
    extraHeight,
  })
  const solve = (count: number, extraHeight = 0) => {
    const out = solveRow(row({ width: 900, height: 200, bands: [creatures, zone(count, extraHeight)] }))
    return { out, band: out.bands.find((b) => b.id === 'marquee')! }
  }

  it('BRD-33: two cards stand one above the other and grow with the height of the row below', () => {
    const short = solve(2)
    const tall = solve(2, 200)
    expect(short.band.lines).toBe(2)
    expect(tall.band.lines).toBe(2)
    expect(tall.band.cardW).toBeGreaterThan(short.band.cardW)
    expect(tall.band.cardW).toBeLessThanOrEqual(tall.out.cardW)
  })

  it('BRD-33: five cards make three columns of two lines', () => {
    const { band } = solve(5, 200)
    expect(band.lines).toBe(2)
    expect(band.width).toBeGreaterThanOrEqual(3 * band.cardW)
    expect(band.width).toBeLessThan(4 * band.cardW)
  })
})

describe('BRD-35: the card size is chosen for even lines', () => {
  const wide = { a: 1.4, b: 0 }
  const items = [wide, wide, CARD, CARD, CARD, CARD, CARD, CARD, CARD, CARD]
  it('BRD-35: even lines may take smaller cards than free lines, and still fit the band', () => {
    const free = solveRow(row({ width: 520, height: 330, bands: [{ id: 'lands', items }] }))
    const even = solveRow(row({ width: 520, height: 330, bands: [{ id: 'lands', items, evenLines: true }] }))
    expect(even.bands[0].overflow).toBe(false)
    expect(even.cardW).toBeLessThanOrEqual(free.cardW)
    const cols = Math.ceil(items.length / even.bands[0].lines)
    const widest = Math.max(...Array.from({ length: even.bands[0].lines }, (_, l) => items.slice(l * cols, l * cols + cols).reduce((s, it) => s + it.a * even.cardW + it.b + 10, -10)))
    expect(widest + 2 * 8).toBeLessThanOrEqual(even.bands[0].width + 0.5)
  })
})

describe('BRD-33: the zone takes the line count that needs the least width', () => {
  const zone = (count: number, extraHeight: number) => ({
    id: 'marquee',
    items: Array.from({ length: count }, () => CARD),
    minWidthCards: 1,
    maxWidthNeed: true,
    fixedLines: count === 1 ? 1 : 2,
    extraHeight,
  })
  it('BRD-33: with room for four lines at close to the row size, four cards stand in one column', () => {
    const out = solveRow(row({ width: 900, height: 200, maxW: 120, bands: [{ id: 'creatures', items: [CARD, CARD] }, zone(4, 520)] }))
    const band = out.bands.find((b) => b.id === 'marquee')!
    expect(band.lines).toBe(4)
    expect(band.width).toBeLessThan(2 * band.cardW)
    expect(band.cardW).toBeGreaterThanOrEqual(out.cardW * 0.75)
  })
  it('BRD-33: without that room the four cards keep a 2×2 square', () => {
    const out = solveRow(row({ width: 900, height: 200, maxW: 120, bands: [{ id: 'creatures', items: [CARD, CARD] }, zone(4, 200)] }))
    expect(out.bands.find((b) => b.id === 'marquee')!.lines).toBe(2)
  })
})
