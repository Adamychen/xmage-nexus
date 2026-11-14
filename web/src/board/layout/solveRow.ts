import type { ItemModel } from './itemModel'

export interface BandInput {
  id: string
  items: ItemModel[]
  minWidthCards?: number
  maxWidthNeed?: boolean
  padX?: number
  frameW?: number
  maxLines?: number
  /** BRD-33: at least these many lines, more while the cards keep the row's size; the band's own card width fits its height. */
  fixedLines?: number
  /** BRD-32: height the fixed lines may use below the row (the band reaches into the next row). */
  extraHeight?: number
  /** BRD-32: one line while that keeps the cards at least PREFER_ONE_LINE_RATIO of the multi-line size. */
  preferOneLine?: boolean
  /** BRD-35: lines hold the same count (the last one may hold fewer), so the card size is chosen for even lines. */
  evenLines?: boolean
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
export const PREFER_ONE_LINE_RATIO = 0.75
/**
 * BRD-50: how much bigger than the row's own card size a band may draw its cards when it grows
 * into the room its lines leave. The height alone would let a band of one line be twice the size
 * of a band of two beside it, which stops reading as one board, so the growth stays a third.
 */
export const BAND_GROWTH_LIMIT = 1.35
const EPS = 1e-6

interface Prepared {
  id: string
  items: ItemModel[]
  padX: number
  frameW: number
  maxLines: number
  minWidthCards: number
  maxWidthNeed: boolean
  fixedLines: number
  extraHeight: number
  evenLines: boolean
}

interface Measure {
  need: number
  lines: number
  fitting: boolean
  cardW?: number
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
    fixedLines: band.fixedLines ?? 0,
    extraHeight: band.extraHeight ?? 0,
    evenLines: band.evenLines ?? false,
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

/** BRD-33: the zone takes at least `fixedLines` lines and, among the line counts its height holds
 *  with cards of at least PREFER_ONE_LINE_RATIO of the row's size, the one that needs the least width. */
function measureFixedLines(p: Prepared, c: number, row: RowInput): Measure {
  const room = row.height + p.extraHeight - 2 * row.padY
  const atLines = (lines: number): Measure => {
    const byHeight = Math.floor((room - (lines - 1) * row.rowGap) / (lines * row.aspect) + EPS)
    const cardW = Math.max(1, Math.min(c, byHeight))
    const weights = p.items.map((item) => item.a * cardW + item.b + row.gap)
    const sums = evenLineSums(weights, lines)
    const natural = sums[lines] - row.gap + 2 * p.padX + p.frameW
    const need = Math.ceil(Math.max(natural, p.minWidthCards * cardW + 2 * p.padX + p.frameW) - EPS)
    return { need, lines, fitting: true, cardW }
  }
  const first = Math.max(1, Math.min(p.items.length, p.fixedLines))
  let best = atLines(first)
  const n = p.items.length
  for (let lines = first + 1; lines <= n; lines++) {
    if (Math.ceil(n / Math.ceil(n / lines)) !== lines) continue
    const m = atLines(lines)
    if (m.cardW! < c * PREFER_ONE_LINE_RATIO) break
    if (m.need < best.need || (m.need === best.need && m.cardW! > best.cardW!)) best = m
  }
  return best
}

/** BRD-35: for each line count, the widest line when the items are cut into lines of equal count. */
function evenLineSums(weights: number[], maxL: number): number[] {
  const out = [0]
  for (let L = 1; L <= maxL; L++) {
    const cols = Math.ceil(weights.length / L)
    let widest = 0
    for (let i = 0; i < weights.length; i += cols) widest = Math.max(widest, weights.slice(i, i + cols).reduce((s, w) => s + w, 0))
    out.push(widest)
  }
  return out
}

/** The width the band needs at each line count, indexed by it: the row's height decides how
 *  many lines it may take, and the entries above that are missing. */
function lineNeeds(p: Prepared, c: number, row: RowInput): { needs: number[]; fitting: boolean } {
  const maxL = Math.min(p.maxLines, p.items.length)
  let feasible = 0
  for (let L = 1; L <= maxL; L++) {
    if (L * c * row.aspect + (L - 1) * row.rowGap + 2 * row.padY > row.height + EPS) break
    feasible = L
  }
  const upTo = Math.max(feasible, 1)
  const weights = p.items.map((item) => item.a * c + item.b + row.gap)
  const sums = p.evenLines ? evenLineSums(weights, upTo) : minMaxByLines(weights, upTo)
  const floorW = p.minWidthCards * c + 2 * p.padX + p.frameW
  const needs = [Infinity]
  for (let L = 1; L <= upTo; L++) {
    const natural = sums[L] - row.gap + 2 * p.padX + p.frameW
    needs.push(Math.ceil(Math.max(natural, floorW) - EPS))
  }
  return { needs, fitting: feasible > 0 }
}

function measureBand(p: Prepared, c: number, row: RowInput): Measure {
  if (p.fixedLines > 0) return measureFixedLines(p, c, row)
  const { needs, fitting } = lineNeeds(p, c, row)
  let best = { need: Infinity, lines: 1 }
  for (let L = 1; L < needs.length; L++) {
    if (needs[L] < best.need) best = { need: needs[L], lines: L }
  }
  return { need: best.need, lines: best.lines, fitting }
}

/**
 * BRD-48: a row with width to spare spends it on fewer lines rather than on empty space at its
 * far side. The cards keep the width already solved, so a band only unwraps when the slack it
 * finds pays for it; the cheapest unwrap goes first, so the slack frees as many bands as it can.
 */
function fewerLines(bands: Prepared[], best: Measure[], cardW: number, total: number, row: RowInput): Measure[] {
  const tables = bands.map((p) => (p.fixedLines > 0 ? null : lineNeeds(p, cardW, row).needs))
  const out = best.slice()
  const fewest = (table: number[], lines: number): number => {
    for (let L = 1; L < Math.min(lines, table.length); L++) {
      if (Number.isFinite(table[L])) return L
    }
    return lines
  }
  const order = bands
    .map((_, i) => i)
    .filter((i) => tables[i] !== null && out[i].lines > 1)
    .map((i) => ({ i, cost: tables[i]![fewest(tables[i]!, out[i].lines)] - out[i].need }))
    .filter((x) => x.cost > 0)
    .sort((a, b) => a.cost - b.cost || a.i - b.i)
  for (const { i } of order) {
    const table = tables[i]!
    const others = out.reduce((sum, m, j) => (j === i ? sum : sum + m.need), 0)
    for (let L = 1; L < Math.min(out[i].lines, table.length); L++) {
      if (Number.isFinite(table[L]) && others + table[L] <= total) {
        out[i] = { ...out[i], need: table[L], lines: L }
        break
      }
    }
  }
  return out
}

/**
 * BRD-50: a band that ends up with fewer lines than the row is tall for grows its own cards into
 * the room it is leaving: the row's height decides how big a card may be at that many lines, the
 * width still free decides how big it can afford to be, and the zone's card size caps both. The
 * band with the fewest lines is served first, because it is the one sitting in the most air.
 */
function biggerCards(bands: Prepared[], spread: Measure[], cardW: number, total: number, row: RowInput): Measure[] {
  const out = spread.slice()
  let used = out.reduce((sum, m) => sum + m.need, 0)
  // A couple of pixels per band stay unspent: a band drawn to the last pixel of its need starts
  // scrolling on the first rounding of a card's margin (BRD-27).
  const budget = total - 2 * bands.length
  const order = bands
    .map((_, i) => i)
    .filter((i) => bands[i].fixedLines === 0 && !bands[i].maxWidthNeed)
    .sort((a, b) => out[a].lines - out[b].lines || a - b)
  for (const i of order) {
    const p = bands[i]
    const lines = out[i].lines
    const own = out[i].cardW ?? cardW
    const tall = row.height - (lines - 1) * row.rowGap - 2 * row.padY
    const ceiling = Math.min(
      Math.floor(row.maxW),
      Math.floor(tall / (lines * row.aspect) + EPS),
      Math.floor(cardW * BAND_GROWTH_LIMIT),
    )
    if (ceiling <= own) continue
    const needAt = (c: number): number => lineNeeds(p, c, row).needs[lines] ?? Infinity
    let good = own
    let bad = ceiling + 1
    while (bad - good > 1) {
      const mid = Math.floor((good + bad) / 2)
      const need = needAt(mid)
      if (Number.isFinite(need) && used - out[i].need + need <= budget) good = mid
      else bad = mid
    }
    if (good <= own) continue
    const need = needAt(good)
    used += need - out[i].need
    out[i] = { ...out[i], need, cardW: good }
  }
  return out
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

/** The largest whole card width at which every band fits its lines in the row (BRD-25, BRD-26); the floor case overflows.
 *  A band that prefers one line keeps it while the cards stay close to the multi-line size (BRD-32). */
export function solveRow(row: RowInput): RowOut {
  const full = solveRowCore(row)
  const prefer = new Set(row.bands.filter((b) => b.preferOneLine).map((b) => b.id))
  if (prefer.size === 0 || !full.bands.some((b) => prefer.has(b.id) && b.lines > 1)) return full
  const single = solveRowCore({ ...row, bands: row.bands.map((b) => (prefer.has(b.id) ? { ...b, maxLines: 1 } : b)) })
  if (single.bands.some((b) => b.overflow)) return full
  return single.cardW >= full.cardW * PREFER_ONE_LINE_RATIO ? single : full
}

function solveRowCore(row: RowInput): RowOut {
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
        cardW: atLo[i].cardW ?? lo,
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

  const spread = biggerCards(bands, fewerLines(bands, best, cardW, total, row), cardW, total, row)
  const needs = spread.map((m) => m.need)
  const leftover = total - needs.reduce((s, x) => s + x, 0)
  const eligible = bands.map((p, i) => (p.maxWidthNeed ? 0 : needs[i]))
  const extra = eligible.some((w) => w > 0) ? distribute(leftover, eligible) : bands.map(() => 0)
  return {
    cardW,
    bands: bands.map((p, i) => ({
      id: p.id,
      width: needs[i] + extra[i],
      cardW: spread[i].cardW ?? cardW,
      lines: spread[i].lines,
      overflow: false,
    })),
  }
}
