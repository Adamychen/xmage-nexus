import type { ItemModel } from './itemModel'

export interface BandInput {
  id: string
  items: ItemModel[]
  minWidthCards?: number
  maxWidthNeed?: boolean
  padX?: number
  frameW?: number
  maxLines?: number
}

export interface RowInput {
  width: number
  height: number
  bands: BandInput[]
  gap: number
  padX: number
  padY: number
  rowGap: number
  bandGap: number
  aspect: number
  minW: number
  maxW: number
  maxLines?: number
}

export interface BandOut {
  id: string
  width: number
  cardW: number
  lines: number
  overflow: boolean
}

export interface RowOut {
  cardW: number
  bands: BandOut[]
}

const DEFAULT_MAX_LINES = 3
const EPS = 1e-6

interface Prepared {
  id: string
  items: ItemModel[]
  padX: number
  frameW: number
  maxLines: number
  minWidthCards: number
  maxWidthNeed: boolean
}

interface Measure {
  need: number
  lines: number
  fitting: boolean
}

function prepare(band: BandInput, row: RowInput, rowMaxLines: number): Prepared {
  return {
    id: band.id,
    items: band.items,
    padX: band.padX ?? row.padX,
    frameW: band.frameW ?? 0,
    maxLines: Math.max(1, band.maxLines ?? rowMaxLines),
    minWidthCards: band.minWidthCards ?? 0,
    maxWidthNeed: band.maxWidthNeed ?? false,
  }
}

function minMaxByLines(weights: number[], maxL: number): number[] {
  const n = weights.length
  const prefix = new Array<number>(n + 1).fill(0)
  for (let i = 0; i < n; i++) prefix[i + 1] = prefix[i] + weights[i]
  const out = [0, prefix[n]]
  let prev = prefix
  for (let L = 2; L <= maxL; L++) {
    const cur = new Array<number>(n + 1).fill(Infinity)
    for (let i = L; i <= n; i++) {
      let best = Infinity
      for (let k = L - 1; k < i; k++) {
        const v = Math.max(prev[k], prefix[i] - prefix[k])
        if (v < best) best = v
      }
      cur[i] = best
    }
    out.push(cur[n])
    prev = cur
  }
  return out
}

function measureBand(p: Prepared, c: number, row: RowInput): Measure {
  const maxL = Math.min(p.maxLines, p.items.length)
  let feasible = 0
  for (let L = 1; L <= maxL; L++) {
    if (L * c * row.aspect + (L - 1) * row.rowGap + 2 * row.padY > row.height + EPS) break
    feasible = L
  }
  const upTo = Math.max(feasible, 1)
  const weights = p.items.map((item) => item.a * c + item.b + row.gap)
  const sums = minMaxByLines(weights, upTo)
  const floorW = p.minWidthCards * c + 2 * p.padX + p.frameW
  let best = { need: Infinity, lines: 1 }
  for (let L = 1; L <= upTo; L++) {
    const natural = sums[L] - row.gap + 2 * p.padX + p.frameW
    const need = Math.ceil(Math.max(natural, floorW) - EPS)
    if (need < best.need) best = { need, lines: L }
  }
  return { need: best.need, lines: best.lines, fitting: feasible > 0 }
}

function distribute(total: number, weights: number[]): number[] {
  const n = weights.length
  if (n === 0) return []
  const sum = weights.reduce((s, w) => s + w, 0)
  const w = sum > 0 ? weights : weights.map(() => 1)
  const denom = sum > 0 ? sum : n
  const exact = w.map((x) => (total * x) / denom)
  const out = exact.map((x) => Math.floor(x))
  let remaining = total - out.reduce((s, x) => s + x, 0)
  const order = exact
    .map((x, i) => ({ i, frac: x - Math.floor(x) }))
    .sort((p, q) => q.frac - p.frac || p.i - q.i)
  for (let k = 0; remaining > 0 && k < order.length; k++, remaining--) out[order[k].i] += 1
  return out
}

function waterFill(total: number, needs: number[]): number[] {
  const widths = new Array<number>(needs.length).fill(0)
  let active = needs.map((_, i) => i)
  let remaining = total
  for (;;) {
    if (active.length === 0) break
    const share = remaining / active.length
    const fitting = active.filter((i) => needs[i] <= share)
    if (fitting.length === 0) break
    for (const i of fitting) {
      widths[i] = needs[i]
      remaining -= needs[i]
    }
    active = active.filter((i) => needs[i] > share)
  }
  if (active.length > 0) {
    const shares = distribute(remaining, active.map((i) => needs[i]))
    active.forEach((i, k) => {
      widths[i] = shares[k]
    })
  } else if (remaining > 0) {
    const extra = distribute(remaining, needs)
    extra.forEach((x, i) => {
      widths[i] += x
    })
  }
  return widths
}

/** The largest whole card width at which every band fits its lines in the row (BRD-25, BRD-26); the floor case overflows. */
export function solveRow(row: RowInput): RowOut {
  const rowMaxLines = row.maxLines ?? DEFAULT_MAX_LINES
  const bands = row.bands.filter((b) => b.items.length > 0).map((b) => prepare(b, row, rowMaxLines))
  const gaps = Math.max(0, bands.length - 1) * row.bandGap
  const total = Math.max(0, Math.floor(row.width - gaps))

  const measureAt = (c: number): Measure[] => bands.map((p) => measureBand(p, c, row))
  const fitsAt = (ms: Measure[]): boolean =>
    ms.every((m) => m.fitting) && ms.reduce((s, m) => s + m.need, 0) <= total

  const lo = Math.ceil(row.minW)
  const hi = Math.max(lo, Math.floor(row.maxW))
  const atLo = measureAt(lo)

  if (!fitsAt(atLo)) {
    const needs = atLo.map((m) => m.need)
    const widths = waterFill(total, needs)
    let surplus = 0
    bands.forEach((p, i) => {
      if (p.maxWidthNeed && widths[i] > needs[i]) {
        surplus += widths[i] - needs[i]
        widths[i] = needs[i]
      }
    })
    const eligible = bands.map((p, i) => (p.maxWidthNeed ? 0 : needs[i]))
    if (surplus > 0 && eligible.some((w) => w > 0)) {
      distribute(surplus, eligible).forEach((x, i) => {
        widths[i] += x
      })
    }
    return {
      cardW: lo,
      bands: bands.map((p, i) => ({
        id: p.id,
        width: widths[i],
        cardW: lo,
        lines: atLo[i].lines,
        overflow: needs[i] > widths[i],
      })),
    }
  }

  let cardW = lo
  let best = atLo
  const atHi = hi > lo ? measureAt(hi) : atLo
  if (hi > lo && fitsAt(atHi)) {
    cardW = hi
    best = atHi
  } else {
    let good = lo
    let bad = hi
    while (bad - good > 1) {
      const mid = Math.floor((good + bad) / 2)
      const at = measureAt(mid)
      if (fitsAt(at)) {
        good = mid
        best = at
      } else {
        bad = mid
      }
    }
    cardW = good
  }

  const needs = best.map((m) => m.need)
  const leftover = total - needs.reduce((s, x) => s + x, 0)
  const eligible = bands.map((p, i) => (p.maxWidthNeed ? 0 : needs[i]))
  const extra = eligible.some((w) => w > 0) ? distribute(leftover, eligible) : bands.map(() => 0)
  return {
    cardW,
    bands: bands.map((p, i) => ({
      id: p.id,
      width: needs[i] + extra[i],
      cardW,
      lines: best[i].lines,
      overflow: false,
    })),
  }
}
