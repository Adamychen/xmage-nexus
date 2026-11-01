import { describe, expect, it } from 'vitest'
import { solveBoardLayout, type BoardInput, type SeatInput } from './solveBoardLayout'
import { solveRow, type BandInput, type RowInput, type RowOut } from './solveRow'
import type { ItemModel } from './itemModel'

function mulberry32(seed: number): () => number {
  let s = seed >>> 0
  return () => {
    s = (s + 0x6d2b79f5) >>> 0
    let t = s
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function pick<T>(r: () => number, xs: readonly T[]): T {
  return xs[Math.floor(r() * xs.length)]
}

function randomItems(r: () => number, max: number): ItemModel[] {
  const n = Math.floor(r() * (max + 1))
  return Array.from({ length: n }, () => ({
    a: pick(r, [0, 0.28, 0.5625, 0.75, 1, 1, 1.4, 1.56]),
    b: pick(r, [0, 6, 14, 24, 52]),
  }))
}

function randomRow(r: () => number): RowInput {
  const aspect = pick(r, [1.4, 0.75, 1])
  const minW = pick(r, [38, 46])
  const padY = pick(r, [0, 2])
  const bands: BandInput[] = Array.from({ length: 1 + Math.floor(r() * 3) }, (_, i) => {
    const items = randomItems(r, 10)
    return {
      id: `b${i}`,
      items,
      ...(items.length > 0 && r() < 0.3 ? { minWidthCards: 1 } : {}),
    }
  })
  return {
    width: 60 + Math.floor(r() * 1140) + pick(r, [0, 0.5]),
    height: minW * aspect + 2 * padY + r() * 300,
    bands,
    gap: pick(r, [4, 6, 10]),
    padX: pick(r, [0, 2, 8]),
    padY,
    rowGap: pick(r, [0, 2]),
    bandGap: pick(r, [0, 4, 8, 10]),
    aspect,
    minW,
    maxW: Math.max(minW, pick(r, [240, 190, 280, 46 + Math.floor(r() * 200)])),
  }
}

function randomSeat(r: () => number, id: string, own: boolean): SeatInput {
  const compactPod = r() < 0.3
  const width = 200 + Math.floor(r() * 1000)
  return {
    id,
    own,
    rowBoxes: {
      creatures: { width, height: 20 + Math.floor(r() * 300) },
      permanents: { width, height: 20 + Math.floor(r() * 300) },
    },
    rows: {
      creatures: {
        bands: [{ id: 'creatures', items: randomItems(r, 12) }],
        gap: 10, padX: 8, padY: 2, rowGap: 2, bandGap: 8, maxLines: 3,
      },
      permanents: {
        bands: [
          { id: 'lands', items: randomItems(r, 8) },
          { id: 'others', items: randomItems(r, 8) },
        ],
        gap: 10, padX: 8, padY: 2, rowGap: 2, bandGap: 8, maxLines: 3,
      },
    },
    capW: r() < 0.2 ? 90 + Math.floor(r() * 100) : Infinity,
    compactPod,
  }
}

function randomBoard(r: () => number): BoardInput {
  const seats = Array.from({ length: 1 + Math.floor(r() * 4) }, (_, i) => randomSeat(r, `s${i}`, i === 0))
  return {
    layout: pick(r, ['standard', 'pod', 'arena', 'table'] as const),
    seats,
    aspect: pick(r, [1.4, 0.75]),
    opponentsCappedByOwn: r() < 0.5,
  }
}

function lineWidth(weights: number[], from: number, to: number, gap: number): number {
  let s = 0
  for (let i = from; i < to; i++) s += weights[i]
  return s + (to - from - 1) * gap
}

function bruteNatural(weights: number[], lines: number, gap: number): number {
  const n = weights.length
  let best = Infinity
  const cuts: number[] = []
  const walk = (start: number, left: number): void => {
    if (left === 0) {
      const bounds = [0, ...cuts, n]
      let max = 0
      for (let k = 0; k + 1 < bounds.length; k++) max = Math.max(max, lineWidth(weights, bounds[k], bounds[k + 1], gap))
      best = Math.min(best, max)
      return
    }
    for (let i = start; i <= n - left; i++) {
      cuts.push(i)
      walk(i + 1, left - 1)
      cuts.pop()
    }
  }
  walk(1, lines - 1)
  return best
}

function needOf(band: BandInput, cardW: number, row: RowInput, lines: number): number {
  const weights = band.items.map((item) => item.a * cardW + item.b)
  const padX = band.padX ?? row.padX
  const natural = bruteNatural(weights, lines, row.gap) + 2 * padX + (band.frameW ?? 0)
  const floor = (band.minWidthCards ?? 0) * cardW + 2 * padX + (band.frameW ?? 0)
  return Math.ceil(Math.max(natural, floor) - 1e-6)
}

describe('BRD-25: the same board in the same window always looks the same', () => {
  it('BRD-25: solving the same board twice gives deep-equal output', () => {
    const r = mulberry32(7)
    for (let i = 0; i < 60; i++) {
      const board = randomBoard(r)
      expect(solveBoardLayout(board)).toEqual(solveBoardLayout(structuredClone(board)))
    }
  })

  it('BRD-25: over 500 random rows, integer widths, a card width in range, lines in 1..3, the height respected and every band that does not overflow fits its need', () => {
    const r = mulberry32(42)
    for (let i = 0; i < 500; i++) {
      const row = randomRow(r)
      const out = solveRow(row)
      const lo = Math.ceil(row.minW)
      const hi = Math.max(lo, Math.floor(row.maxW))
      expect(Number.isInteger(out.cardW)).toBe(true)
      expect(out.cardW).toBeGreaterThanOrEqual(lo)
      expect(out.cardW).toBeLessThanOrEqual(hi)
      const used = row.bands.filter((b) => b.items.length > 0)
      expect(out.bands.length).toBe(used.length)
      if (used.length > 0) {
        const total = Math.floor(row.width - (used.length - 1) * row.bandGap)
        expect(out.bands.reduce((s, b) => s + b.width, 0)).toBe(Math.max(0, total))
      }
      out.bands.forEach((band, k) => {
        const input = used[k]
        expect(Number.isInteger(band.width)).toBe(true)
        expect(band.lines).toBeGreaterThanOrEqual(1)
        expect(band.lines).toBeLessThanOrEqual(3)
        expect(band.lines).toBeLessThanOrEqual(input.items.length)
        expect(band.lines * out.cardW * row.aspect + (band.lines - 1) * row.rowGap + 2 * row.padY).toBeLessThanOrEqual(row.height + 1e-6)
        if (!band.overflow) {
          expect(needOf(input, out.cardW, row, band.lines)).toBeLessThanOrEqual(band.width)
        }
      })
    }
  })

  it('BRD-25: in the floor case every band that does not overflow is at least its need, and overflow is exactly need above width', () => {
    const r = mulberry32(2024)
    let floors = 0
    for (let i = 0; i < 400; i++) {
      const row = randomRow(r)
      const narrow: RowInput = { ...row, width: 40 + Math.floor(r() * 160) }
      const out = solveRow(narrow)
      if (out.cardW !== Math.ceil(narrow.minW)) continue
      floors++
      const used = narrow.bands.filter((b) => b.items.length > 0)
      out.bands.forEach((band, k) => {
        const need = needOf(used[k], out.cardW, narrow, band.lines)
        expect(band.overflow).toBe(need > band.width)
        if (!band.overflow) expect(band.width).toBeGreaterThanOrEqual(need)
      })
    }
    expect(floors).toBeGreaterThan(50)
  })

  it('BRD-25: a wider or a taller row never yields a smaller row card width', () => {
    const r = mulberry32(99)
    for (let i = 0; i < 300; i++) {
      const row = randomRow(r)
      const base = solveRow(row).cardW
      expect(solveRow({ ...row, width: row.width + 1 + Math.floor(r() * 200) }).cardW).toBeGreaterThanOrEqual(base)
      expect(solveRow({ ...row, height: row.height + 1 + Math.floor(r() * 200) }).cardW).toBeGreaterThanOrEqual(base)
    }
  })

  it('BRD-25: adding an item to a band never yields a larger row card width', () => {
    const r = mulberry32(5)
    for (let i = 0; i < 300; i++) {
      const row = randomRow(r)
      const populated = row.bands.map((b, k) => ({ b, k })).filter(({ b }) => b.items.length > 0)
      if (populated.length === 0) continue
      const target = pick(r, populated).k
      const extra = { a: pick(r, [0.28, 1, 1.4]), b: pick(r, [0, 14, 24]) }
      const grown = row.bands.map((b, k) => (k === target ? { ...b, items: [...b.items, extra] } : b))
      expect(solveRow({ ...row, bands: grown }).cardW).toBeLessThanOrEqual(solveRow(row).cardW)
    }
  })

  it('BRD-25: 1000 solves of a 60-item row over 3 bands take under 200 ms', () => {
    const items = (n: number): ItemModel[] => Array.from({ length: n }, (_, i) => ({ a: i % 2 ? 1 : 0.28, b: i % 3 ? 0 : 24 }))
    const row: RowInput = {
      width: 1000,
      height: 200,
      bands: [
        { id: 'lands', items: items(20) },
        { id: 'others', items: items(20) },
        { id: 'marquee', items: items(20), minWidthCards: 1, maxWidthNeed: true, frameW: 3 },
      ],
      gap: 10, padX: 8, padY: 2, rowGap: 2, bandGap: 8, aspect: 1.4, minW: 46, maxW: 240,
    }
    const started = performance.now()
    for (let i = 0; i < 1000; i++) solveRow(row)
    expect(performance.now() - started).toBeLessThan(200)
  })

  it('BRD-25: an opponent seat never gets a row card width larger than the own seat largest row card width when capped', () => {
    const r = mulberry32(3)
    for (let i = 0; i < 100; i++) {
      const own = randomSeat(r, 'own', true)
      const opp = randomSeat(r, 'opp', false)
      const board: BoardInput = { layout: 'table', seats: [opp, own], aspect: 1.4, opponentsCappedByOwn: true }
      const [oppOut, ownOut] = solveBoardLayout(board).seats
      const ownLargest = Math.max(ownOut.rows.creatures.cardW, ownOut.rows.permanents.cardW)
      expect(oppOut.zoneCardW).toBeLessThanOrEqual(ownLargest)
      expect(oppOut.rows.creatures.cardW).toBeLessThanOrEqual(ownLargest)
      expect(oppOut.rows.permanents.cardW).toBeLessThanOrEqual(ownLargest)
    }
  })

  it('BRD-25: with opponentsCappedByOwn off, every seat is solved on its own', () => {
    const r = mulberry32(11)
    const own = randomSeat(r, 'own', true)
    const opp = randomSeat(r, 'opp', false)
    const together = solveBoardLayout({ layout: 'arena', seats: [own, opp], aspect: 1.4, opponentsCappedByOwn: false })
    const alone = solveBoardLayout({ layout: 'arena', seats: [opp], aspect: 1.4, opponentsCappedByOwn: false })
    expect(together.seats[1]).toEqual(alone.seats[0])
  })

  it('BRD-25: the zone card width comes from the seat height and the seat cap', () => {
    const seat: SeatInput = {
      id: 'own',
      own: true,
      rowBoxes: { creatures: { width: 900, height: 172 }, permanents: { width: 900, height: 172 } },
      rows: {
        creatures: { bands: [], gap: 10, padX: 8, padY: 2, rowGap: 2, bandGap: 8 },
        permanents: { bands: [], gap: 10, padX: 8, padY: 2, rowGap: 2, bandGap: 8 },
      },
      capW: Infinity,
      compactPod: false,
    }
    expect(solveBoardLayout({ layout: 'standard', seats: [seat], aspect: 1.4, opponentsCappedByOwn: false }).seats[0].zoneCardW).toBe(120)
    expect(solveBoardLayout({ layout: 'standard', seats: [{ ...seat, capW: 100 }], aspect: 1.4, opponentsCappedByOwn: false }).seats[0].zoneCardW).toBe(100)
  })
})

describe('BRD-26: bands that share a row share it by what they hold', () => {
  it('BRD-26: seven creatures beside a planeswalker marquee on a 305 px by 85 px row are not left at the floor while the marquee has room', () => {
    const seat: SeatInput = {
      id: 'own',
      own: true,
      rowBoxes: { creatures: { width: 305, height: 85 }, permanents: { width: 305, height: 85 } },
      rows: {
        creatures: {
          bands: [
            { id: 'creatures', items: cardItems(7) },
            { id: 'marquee', items: cardItems(1), minWidthCards: 1, maxWidthNeed: true, frameW: 3 },
          ],
          gap: 10, padX: 8, padY: 2, rowGap: 2, bandGap: 8, maxLines: 3,
        },
        permanents: { bands: [], gap: 10, padX: 8, padY: 2, rowGap: 2, bandGap: 8, maxLines: 3 },
      },
      capW: Infinity,
      compactPod: false,
    }
    const out = solveBoardLayout({ layout: 'table', seats: [seat], aspect: 0.75, opponentsCappedByOwn: false }).seats[0]
    const [creatures, marquee] = out.rows.creatures.bands
    expect(out.rows.creatures.cardW).toBe(46)
    expect(creatures.cardW).toBe(marquee.cardW)
    expect(creatures.width).toBeGreaterThan(38)
    expect(creatures.lines).toBe(2)
    expect(marquee.width).toBe(marquee.cardW + 2 * 8 + 3)
    expect(creatures.width + marquee.width).toBe(305 - 8)
    expect(creatures.overflow).toBe(false)
  })

  it('BRD-26: lands with two piles and the others with one pile share one card width, the leftover in proportion to need', () => {
    const pile = (a: number, b: number): ItemModel => ({ a, b })
    const row: RowInput = {
      width: 500,
      height: 300,
      bands: [
        { id: 'lands', items: [pile(1.56, 0), pile(1.56, 0)] },
        { id: 'others', items: [pile(1, 24)] },
      ],
      gap: 10, padX: 8, padY: 2, rowGap: 2, bandGap: 10, aspect: 1.4, minW: 46, maxW: 240,
    }
    const out = solveRow(row)
    const [lands, others] = out.bands
    expect(out.cardW).toBe(105)
    expect(lands.cardW).toBe(others.cardW)
    expect(lands.lines).toBe(2)
    expect(others.lines).toBe(1)
    const needLands = 180
    const needOthers = 145
    expect(lands.width + others.width).toBe(500 - 10)
    expect(Math.abs(lands.width - (490 * needLands) / (needLands + needOthers))).toBeLessThan(1)
    expect(Math.abs(others.width - (490 * needOthers) / (needLands + needOthers))).toBeLessThan(1)
  })

  it('BRD-26: when not even the floor fits, the row stays at the floor and only the bands whose need exceeds their width overflow', () => {
    const row: RowInput = {
      width: 120,
      height: 200,
      bands: [
        { id: 'big', items: cardItems(12) },
        { id: 'small', items: cardItems(1) },
      ],
      gap: 10, padX: 8, padY: 2, rowGap: 2, bandGap: 8, aspect: 1.4, minW: 46, maxW: 240,
    }
    const out = solveRow(row)
    expect(out.cardW).toBe(46)
    out.bands.forEach((band) => {
      const input = row.bands.find((b) => b.id === band.id)!
      const need = needOf(input, 46, row, band.lines)
      if (band.overflow) expect(need).toBeGreaterThan(band.width)
      else expect(need).toBeLessThanOrEqual(band.width)
    })
    expect(out.bands.some((b) => b.overflow)).toBe(true)
  })

  it('BRD-26: in the floor case a band that fits keeps its need and only the bands that do not fit overflow', () => {
    const row: RowInput = {
      width: 200,
      height: 200,
      bands: [
        { id: 'small', items: cardItems(1) },
        { id: 'big', items: cardItems(12) },
      ],
      gap: 10, padX: 8, padY: 2, rowGap: 2, bandGap: 8, aspect: 1.4, minW: 46, maxW: 240,
    }
    const out = solveRow(row)
    const [small, big] = out.bands
    expect(out.cardW).toBe(46)
    expect(small.width).toBe(needOf(row.bands[0], 46, row, small.lines))
    expect(small.width).toBe(62)
    expect(small.overflow).toBe(false)
    expect(big.lines).toBe(2)
    expect(big.width).toBe(200 - 8 - 62)
    expect(big.overflow).toBe(true)
  })
})

function cardItems(n: number): ItemModel[] {
  return Array.from({ length: n }, () => ({ a: 1, b: 0 }))
}

function plainSeat(id: string, own: boolean, box: { width: number; height: number }, creatures: number, permanents: number, capW = Infinity): SeatInput {
  const rowH = (box.height - 56) / 2
  return {
    id,
    own,
    rowBoxes: { creatures: { width: box.width, height: rowH }, permanents: { width: box.width, height: rowH } },
    rows: {
      creatures: { bands: [{ id: 'creatures', items: cardItems(creatures) }], gap: 10, padX: 8, padY: 2, rowGap: 2, bandGap: 8, maxLines: 3 },
      permanents: { bands: permanents > 0 ? [{ id: 'others', items: cardItems(permanents) }] : [], gap: 10, padX: 8, padY: 2, rowGap: 2, bandGap: 8, maxLines: 3 },
    },
    capW,
    compactPod: false,
  }
}

describe('BRD-3: opponents never outgrow your own cards', () => {
  it('BRD-3: with the own cap on, a focused and an unfocused opponent are never larger than the largest cards of your own board', () => {
    const focused = plainSeat('focused', false, { width: 700, height: 600 }, 2, 1)
    const unfocused = plainSeat('unfocused', false, { width: 700, height: 600 }, 2, 1, 120)
    for (const own of [plainSeat('own', true, { width: 400, height: 300 }, 14, 6), plainSeat('own', true, { width: 400, height: 300 }, 14, 0)]) {
      const board = { layout: 'arena' as const, seats: [own, focused, unfocused], aspect: 1.4, opponentsCappedByOwn: true }
      const [ownOut, focusedOut, unfocusedOut] = solveBoardLayout(board).seats
      const populated = [ownOut.rows.creatures, own.rows.permanents.bands.length > 0 ? ownOut.rows.permanents : null].filter(
        (r): r is RowOut => r !== null,
      )
      const ownLargest = Math.max(...populated.map((r) => r.cardW))
      for (const opp of [focusedOut, unfocusedOut]) {
        expect(opp.zoneCardW).toBeLessThanOrEqual(ownLargest)
        expect(opp.rows.creatures.cardW).toBeLessThanOrEqual(ownLargest)
        expect(opp.rows.permanents.cardW).toBeLessThanOrEqual(ownLargest)
      }
      const free = solveBoardLayout({ ...board, opponentsCappedByOwn: false }).seats[1]
      expect(free.zoneCardW).toBeGreaterThan(ownLargest)
    }
  })
})
