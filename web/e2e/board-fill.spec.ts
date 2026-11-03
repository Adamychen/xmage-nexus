import type { Page } from '@playwright/test'
import { test, expect } from './fixtures'
import { fakeOnly } from './support/fake-mode'
import { dismissSetupWizard } from './support/start-game'
import { CARD_STYLES, DENSE, LAYOUT_SETTINGS, LAYOUTS, SEAT_COUNTS, boardGame, drawBoard, settleAndCount, type CardStyle, type Layout } from './support/board-geometry'

fakeOnly()

test.use({ launchOptions: { ignoreDefaultArgs: ['--hide-scrollbars'] } })

const VIEWPORTS = [
  { width: 1000, height: 900 },
  { width: 1600, height: 900 },
]
const CAP_TOLERANCE_PX = 2
const FULL_WIDTH = 0.85
const FULL_HEIGHT = 0.75
const SCROLLABLE_EDGE_PX = 1

interface BandFill {
  id: string
  cardW: number
  cardH: number
  lines: number
  innerW: number
  innerH: number
  contentW: number
  overflow: boolean
}

interface RowFill {
  seat: string
  row: string
  own: boolean
  compact: boolean
  compactPod: boolean
  cardW: number
  innerW: number
  innerH: number
  bands: BandFill[]
}

interface SeatFill {
  seat: string
  own: boolean
  compact: boolean
  compactPod: boolean
  cap: number
  rows: RowFill[]
}

async function measure(page: Page, cappedByOwn: boolean): Promise<SeatFill[]> {
  return page.evaluate((opts: { cappedByOwn: boolean; edge: number }) => {
    const num = (value: string) => parseFloat(value) || 0
    const innerW = (el: HTMLElement) => {
      const cs = getComputedStyle(el)
      return el.clientWidth - num(cs.paddingLeft) - num(cs.paddingRight)
    }
    const innerH = (el: HTMLElement) => {
      const cs = getComputedStyle(el)
      return el.clientHeight - num(cs.paddingTop) - num(cs.paddingBottom)
    }
    const cardWOf = (band: HTMLElement) => {
      const set = num(band.style.getPropertyValue('--card-w'))
      if (set > 0) return set
      const slot = band.querySelector<HTMLElement>('.card-slot')
      return slot ? slot.offsetWidth : 0
    }
    const contentWOf = (band: HTMLElement) => {
      const gap = num(getComputedStyle(band).columnGap)
      const lines = new Map<number, number>()
      const counts = new Map<number, number>()
      for (const kid of Array.from(band.children) as HTMLElement[]) {
        const cs = getComputedStyle(kid)
        const width = kid.offsetWidth + num(cs.marginLeft) + num(cs.marginRight)
        lines.set(kid.offsetTop, (lines.get(kid.offsetTop) ?? 0) + width)
        counts.set(kid.offsetTop, (counts.get(kid.offsetTop) ?? 0) + 1)
      }
      let widest = 0
      for (const [top, width] of lines) widest = Math.max(widest, width + ((counts.get(top) ?? 1) - 1) * gap)
      return widest
    }
    const bandOf = (band: HTMLElement): BandFill => {
      const slot = band.querySelector<HTMLElement>('.card-slot')
      return {
        id: band.dataset.testid ?? [...band.classList].filter((c) => /band|marquee|commander/.test(c)).join('.'),
        cardW: cardWOf(band),
        cardH: slot ? slot.offsetHeight : 0,
        lines: Number(band.getAttribute('data-band-lines')) || 1,
        innerW: innerW(band),
        innerH: innerH(band),
        contentW: contentWOf(band),
        overflow: band.scrollWidth > band.clientWidth + opts.edge,
      }
    }
    const zones = [...document.querySelectorAll<HTMLElement>('.board-zone')].filter(
      (zone) => !zone.classList.contains('empty') && !zone.classList.contains('seat-strip'),
    )
    const rowsOf = (zone: HTMLElement) => {
      const own = zone.classList.contains('player-zone')
      const compact = zone.classList.contains('card-style-compact')
      const compactPod = zone.classList.contains('compact-pod')
      const rows: RowFill[] = []
      for (const row of Array.from(zone.querySelectorAll<HTMLElement>(':scope > .bz-row')) as HTMLElement[]) {
        if (row.classList.contains('bz-status-row')) continue
        const bands = (Array.from(row.querySelectorAll<HTMLElement>(':scope > .bz-band, :scope > .bz-marquee, :scope > .bz-commander')) as HTMLElement[]).filter(
          (band) => band.children.length > 0,
        )
        if (bands.length === 0) continue
        const rowFill = bands.map(bandOf)
        rows.push({
          seat: zone.dataset.playerId ?? '',
          row: row.classList.contains('bz-creatures-row') ? 'creatures' : 'permanents',
          own,
          compact,
          compactPod,
          cardW: Math.max(...rowFill.map((b) => b.cardW)),
          innerW: innerW(row),
          innerH: innerH(row),
          bands: rowFill,
        })
      }
      return { own, compact, compactPod, zone, rows }
    }
    const seats = zones.map(rowsOf)
    const ownLargest = Math.max(
      0,
      ...seats.filter((s) => s.own).flatMap((s) => s.rows.map((r) => r.cardW)),
    )
    return seats.map((s) => {
      const tallest = Math.max(
        ...(['.bz-creatures-row', '.bz-permanents-row'] as const).map((sel) => {
          const row = s.zone.querySelector<HTMLElement>(`:scope > ${sel}`)
          return row ? row.clientHeight : 0
        }),
      )
      const aspect = s.compact ? 0.75 : 1.4
      const maxConst = s.compact ? (s.own ? 230 : 190) : s.own ? 280 : 240
      const heightCap = Math.floor(Math.max(28, tallest - (s.compactPod ? 2 : 4)) / aspect)
      const oppCap = !s.own && opts.cappedByOwn && ownLargest > 0 ? ownLargest : Infinity
      return {
        seat: s.zone.dataset.playerId ?? '',
        own: s.own,
        compact: s.compact,
        compactPod: s.compactPod,
        cap: Math.min(maxConst, heightCap, oppCap),
        rows: s.rows,
      }
    })
  }, { cappedByOwn, edge: SCROLLABLE_EDGE_PX })
}

function violations(seats: SeatFill[], layout: Layout): string[] {
  const out: string[] = []
  for (const seat of seats) {
    const cap = seat.cap
    for (const row of seat.rows) {
      const floor = row.compactPod ? 38 : 46
      if (row.cardW >= cap - CAP_TOLERANCE_PX) continue
      const full = row.bands.some((band) => {
        const widthFull = band.overflow
          ? row.cardW <= floor + CAP_TOLERANCE_PX
          : band.contentW >= FULL_WIDTH * band.innerW
        const heightFull = band.lines * band.cardH >= FULL_HEIGHT * row.innerH
        return widthFull || heightFull
      })
      if (!full) {
        const widest = row.bands.reduce((a, b) => (b.contentW > a.contentW ? b : a))
        out.push(
          `${layout} ${seat.own ? 'own' : 'opponent'} ${seat.seat} ${row.row} row: cards ${row.cardW} px, seat cap ${cap} px, ` +
            `widest band ${widest.id} content ${Math.round(widest.contentW)}/${Math.round(widest.innerW)} px, ` +
            `lines×card ${Math.max(...row.bands.map((b) => b.lines * b.cardH))}/${Math.round(row.innerH)} px`,
        )
      }
    }
  }
  return out
}

for (const layout of LAYOUTS) {
  for (const seats of SEAT_COUNTS) {
    for (const style of CARD_STYLES as CardStyle[]) {
      for (const viewport of VIEWPORTS) {
        const label = `the ${layout} board with ${seats} seats and ${style} cards at ${viewport.width}x${viewport.height}`
        test(`BRD-26: a row's cards are as large as its room allows, ${label}`, async ({ page }) => {
          test.setTimeout(120_000)
          const game = boardGame(seats, DENSE)
          const settings = { ...LAYOUT_SETTINGS[layout], cardStyle: style }
          await page.setViewportSize(viewport)
          await page.goto('/')
          await dismissSetupWizard(page)
          await drawBoard(page, game, settings)
          await page.mouse.move(1, 1)
          await settleAndCount(page)
          const cappedByOwn = layout === 'arena' || layout === 'table'
          const found = violations(await measure(page, cappedByOwn), layout)
          expect(found, 'rows whose cards could be larger but no band fills its room').toEqual([])
        })
      }
    }
  }
}
