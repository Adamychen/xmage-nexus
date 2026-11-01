import { CLASSIC_CARD_ASPECT, COMPACT_CARD_ASPECT } from '../compactCard'
import { itemModel, type ItemKind } from './itemModel'
import { BOARD_RELAYOUT_EVENT } from './relayout'
import { solveBoardLayout, type BoardLayoutKind, type RowSpec, type SeatInput, type SeatOut } from './solveBoardLayout'
import type { BandOut } from './solveRow'

export interface BandRegistration {
  id: string
  el: HTMLElement
  items: ItemKind[]
  minWidthCards?: number
  maxWidthNeed?: boolean
  frameW?: number
  maxLines?: number
}

export interface SeatRegistration {
  seat: HTMLElement
  creaturesRow: HTMLElement
  permanentsRow: HTMLElement
  own: boolean
  compactPod: boolean
  compact: boolean
  tilted: boolean
  rows: { creatures: BandRegistration[]; permanents: BandRegistration[] }
}

export interface LayoutOptions {
  layout: BoardLayoutKind
  opponentsCappedByOwn: boolean
}

const tokens = new WeakMap<Element, number>()
let tokenCount = 0

function tokenOf(el: Element | null): number {
  if (!el) return 0
  let token = tokens.get(el)
  if (token === undefined) {
    tokenCount += 1
    token = tokenCount
    tokens.set(el, token)
  }
  return token
}

export function registrationSignature(reg: SeatRegistration): string {
  const band = (b: BandRegistration) => [b.id, tokenOf(b.el), b.items, b.minWidthCards, b.maxWidthNeed, b.frameW, b.maxLines]
  return JSON.stringify([
    tokenOf(reg.seat),
    tokenOf(reg.creaturesRow),
    tokenOf(reg.permanentsRow),
    reg.own,
    reg.compactPod,
    reg.compact,
    reg.tilted,
    reg.rows.creatures.map(band),
    reg.rows.permanents.map(band),
  ])
}

function num(value: string): number {
  const n = parseFloat(value)
  return Number.isFinite(n) ? n : 0
}

function validBox(box: { width: number; height: number }): boolean {
  return box.width > 0 && box.height > 0
}

function contentBox(el: HTMLElement): { width: number; height: number } {
  const cs = getComputedStyle(el)
  return {
    width: el.clientWidth - num(cs.paddingLeft) - num(cs.paddingRight),
    height: el.clientHeight - num(cs.paddingTop) - num(cs.paddingBottom),
  }
}

function inFlow(bands: BandRegistration[]): BandRegistration[] {
  return bands.filter((b) => getComputedStyle(b.el).position !== 'absolute')
}

function rowSpec(bands: BandRegistration[], reg: SeatRegistration): RowSpec {
  if (bands.length === 0) return { bands: [], gap: 0, padX: 0, padY: 0, rowGap: 0, bandGap: 0 }
  const styles = bands.map((b) => getComputedStyle(b.el))
  const bandGap = num(getComputedStyle(bands[0].el.parentElement ?? bands[0].el).columnGap)
  return {
    bands: bands.map((b, i) => ({
      id: b.id,
      items: b.items.map((item) => itemModel(item, { compact: reg.compact, tilted: reg.tilted })),
      minWidthCards: b.minWidthCards,
      maxWidthNeed: b.maxWidthNeed,
      padX: (num(styles[i].paddingLeft) + num(styles[i].paddingRight)) / 2,
      frameW: b.frameW,
      maxLines: b.maxLines,
    })),
    gap: Math.max(...styles.map((cs) => num(cs.columnGap))),
    padX: 0,
    padY: Math.max(...styles.map((cs) => num(cs.paddingTop))),
    rowGap: Math.max(...styles.map((cs) => num(cs.rowGap))),
    bandGap,
  }
}

function px(value: number): string {
  return `${value}px`
}

function setVar(el: HTMLElement, name: string, value: string): boolean {
  if (el.style.getPropertyValue(name) === value) return false
  el.style.setProperty(name, value)
  return true
}

function setAttr(el: HTMLElement, name: string, value: string | null): boolean {
  if (el.getAttribute(name) === value) return false
  if (value === null) el.removeAttribute(name)
  else el.setAttribute(name, value)
  return true
}

function writeBand(el: HTMLElement, band: BandOut): boolean {
  let changed = setVar(el, '--card-w', px(band.cardW))
  if (el.style.flexBasis !== px(band.width) || el.style.flexGrow !== '0' || el.style.flexShrink !== '0') {
    el.style.flex = `0 0 ${band.width}px`
    changed = true
  }
  changed = setAttr(el, 'data-band-lines', band.lines > 1 ? String(band.lines) : null) || changed
  changed = setAttr(el, 'data-band-overflow', band.overflow ? '' : null) || changed
  return changed
}

function clearBand(el: HTMLElement): boolean {
  let changed = false
  if (el.style.getPropertyValue('--card-w') !== '') {
    el.style.removeProperty('--card-w')
    changed = true
  }
  if (el.style.flexBasis !== '') {
    el.style.removeProperty('flex')
    el.style.removeProperty('flex-basis')
    el.style.removeProperty('flex-grow')
    el.style.removeProperty('flex-shrink')
    changed = true
  }
  changed = setAttr(el, 'data-band-lines', null) || changed
  changed = setAttr(el, 'data-band-overflow', null) || changed
  return changed
}

function writeSeat(reg: SeatRegistration, out: SeatOut): boolean {
  let changed = setVar(reg.seat, '--zone-card-w', px(out.zoneCardW))
  changed = setVar(reg.seat, '--card-w', px(out.zoneCardW)) || changed
  const rows = [
    [reg.rows.creatures, out.rows.creatures.bands],
    [reg.rows.permanents, out.rows.permanents.bands],
  ] as const
  for (const [regs, outs] of rows) {
    const solved = new Map(outs.map((band) => [band.id, band]))
    for (const band of regs) {
      const result = solved.get(band.id)
      changed = (result ? writeBand(band.el, result) : clearBand(band.el)) || changed
    }
  }
  return changed
}

/**
 * Holds every registered seat of one board and lays them out with the pure
 * solver (BRD-25). One ResizeObserver watches the board, the seats and their
 * status rows; any change schedules a single animation frame that measures the
 * inputs, solves once and writes only the values that differ.
 */
export class BoardLayoutEngine {
  private seats = new Map<string, SeatRegistration>()
  private board: HTMLElement | null = null
  private observed = new Set<Element>()
  private ro: ResizeObserver | null = null
  private frame: number | null = null
  private options: LayoutOptions
  onSolved: ((ownCardW: number | undefined) => void) | null = null
  private listening = false
  private readonly relayout = () => this.schedule()

  constructor(options: LayoutOptions) {
    this.options = options
  }

  configure(options: LayoutOptions): void {
    if (options.layout === this.options.layout && options.opponentsCappedByOwn === this.options.opponentsCappedByOwn) return
    this.options = options
    this.schedule()
  }

  setBoard(el: HTMLElement | null): void {
    if (el === this.board) return
    this.board = el
    this.sync()
    this.schedule()
  }

  register(key: string, reg: SeatRegistration): void {
    this.seats.set(key, reg)
    this.sync()
    this.schedule()
  }

  unregister(key: string): void {
    if (!this.seats.delete(key)) return
    this.sync()
    this.schedule()
  }

  schedule(): void {
    if (this.frame !== null || typeof requestAnimationFrame === 'undefined') return
    this.frame = requestAnimationFrame(() => {
      this.frame = null
      this.flush()
    })
  }

  flush(): boolean {
    const measured: Array<{ reg: SeatRegistration; input: SeatInput }> = []
    for (const [key, reg] of this.seats) {
      const rowBoxes = { creatures: contentBox(reg.creaturesRow), permanents: contentBox(reg.permanentsRow) }
      if (!validBox(rowBoxes.creatures) || !validBox(rowBoxes.permanents)) continue
      measured.push({
        reg,
        input: {
          id: key,
          own: reg.own,
          rowBoxes,
          compactPod: reg.compactPod,
          rows: { creatures: rowSpec(inFlow(reg.rows.creatures), reg), permanents: rowSpec(inFlow(reg.rows.permanents), reg) },
          capW: Infinity,
        },
      })
    }
    if (measured.length === 0) {
      this.onSolved?.(undefined)
      return false
    }
    const out = solveBoardLayout({
      layout: this.options.layout,
      seats: measured.map((m) => m.input),
      aspect: measured[0].reg.compact ? COMPACT_CARD_ASPECT : CLASSIC_CARD_ASPECT,
      opponentsCappedByOwn: this.options.opponentsCappedByOwn,
    })
    let changed = false
    let own: number | undefined
    out.seats.forEach((seatOut, i) => {
      const { reg } = measured[i]
      changed = writeSeat(reg, seatOut) || changed
      if (reg.own && own === undefined) own = seatOut.zoneCardW
    })
    this.onSolved?.(own)
    if (changed) window.dispatchEvent(new Event(BOARD_RELAYOUT_EVENT))
    return changed
  }

  dispose(): void {
    if (this.frame !== null && typeof cancelAnimationFrame !== 'undefined') cancelAnimationFrame(this.frame)
    this.frame = null
    if (this.listening) window.removeEventListener(BOARD_RELAYOUT_EVENT, this.relayout)
    this.listening = false
    this.ro?.disconnect()
    this.ro = null
    this.observed.clear()
    this.seats.clear()
    this.board = null
  }

  private sync(): void {
    if (!this.listening && typeof window !== 'undefined') {
      window.addEventListener(BOARD_RELAYOUT_EVENT, this.relayout)
      this.listening = true
    }
    if (typeof ResizeObserver === 'undefined') return
    this.ro ??= new ResizeObserver(() => this.schedule())
    const wanted = new Set<Element>()
    if (this.board) wanted.add(this.board)
    for (const reg of this.seats.values()) {
      wanted.add(reg.seat)
      wanted.add(reg.creaturesRow)
      wanted.add(reg.permanentsRow)
    }
    for (const el of this.observed) {
      if (!wanted.has(el)) {
        this.ro.unobserve(el)
        this.observed.delete(el)
      }
    }
    for (const el of wanted) {
      if (!this.observed.has(el)) {
        this.ro.observe(el)
        this.observed.add(el)
      }
    }
  }
}
