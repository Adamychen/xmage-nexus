import { expect, type Page } from '@playwright/test'
import { richCommanderGame, showGame } from './rich-game'
import { dismissSetupWizard } from './start-game'

type Rec = Record<string, unknown>

export type Layout = 'standard' | 'pod' | 'arena' | 'table'
export type CardStyle = 'classic' | 'compact'

export const LAYOUT_SETTINGS: Record<Layout, Rec> = {
  standard: { gameUi: 'v1', boardLayout: 'standard', boardLayoutManual: true },
  pod: { gameUi: 'v1', boardLayout: 'pod', boardLayoutManual: true },
  arena: { gameUi: 'v1', boardLayout: 'arena', boardLayoutManual: true },
  table: { gameUi: 'v2', boardLayout: 'arena', boardLayoutManual: true },
}
export const LAYOUTS = Object.keys(LAYOUT_SETTINGS) as Layout[]
export const SEAT_COUNTS = [2, 4]
export const CARD_STYLES: CardStyle[] = ['classic', 'compact']

export const BOARD_SELECTOR = '[data-testid$="-board"]'
export const MAX_BOARD_CHANGES = 0
const CALM_FRAMES = 30
const SETTLE_CAP_MS = 2000
const WINDOW_MS = 500
const FLOOR_W = 46
const FLOOR_W_COMPACT_POD = 38

export interface BoardSpec {
  walkers: number
  creatures: number
  lands: number
  landNames: string[]
  treasures: number
  saga: boolean
  rock: boolean
  aura: boolean
}

const BASICS = ['Forest', 'Island', 'Swamp', 'Mountain', 'Plains']

export const DENSE: BoardSpec = { walkers: 1, creatures: 7, lands: 9, landNames: ['Forest', 'Island'], treasures: 4, saga: false, rock: false, aura: false }

export const SIZES: Record<'medium' | 'large' | 'dense', BoardSpec> = {
  medium: { walkers: 1, creatures: 6, lands: 7, landNames: BASICS, treasures: 3, saga: true, rock: true, aura: false },
  large: { walkers: 3, creatures: 10, lands: 12, landNames: BASICS, treasures: 6, saga: false, rock: false, aura: true },
  dense: DENSE,
}
export type Size = keyof typeof SIZES

function perm(id: string, name: string, types: string[], extra: Rec = {}): Rec {
  return { id, parentId: id, name, displayName: name, cardTypes: types, manaValue: 3, expansionSetCode: '', cardNumber: '0', ...extra }
}

function battlefield(owner: string, spec: BoardSpec): Record<string, Rec> {
  const cards: Rec[] = []
  for (let i = 0; i < spec.walkers; i++) cards.push(perm(`${owner}-walker${i}`, `Jace ${i}`, ['PLANESWALKER'], { loyalty: '3' }))
  if (spec.saga) cards.push(perm(`${owner}-saga`, 'Saga of Ancient Lore', ['ENCHANTMENT', 'SAGA']))
  if (spec.rock) cards.push(perm(`${owner}-rock`, 'Sol Ring', ['ARTIFACT']))
  for (let i = 0; i < spec.treasures; i++) cards.push({ ...perm(`${owner}-treasure${i}`, 'Treasure', ['ARTIFACT']), isToken: true })
  for (let i = 0; i < spec.creatures; i++) {
    const attachments = spec.aura && i === 0 ? [`${owner}-aura`] : []
    cards.push(perm(`${owner}-bear${i}`, `Bear ${i}`, ['CREATURE'], { power: '2', toughness: '2', attachments }))
  }
  if (spec.aura) cards.push(perm(`${owner}-aura`, 'Pacifism', ['ENCHANTMENT']))
  for (let i = 0; i < spec.lands; i++) {
    cards.push(perm(`${owner}-land${i}`, spec.landNames[i % spec.landNames.length], ['LAND'], { manaValue: 0 }))
  }
  return Object.fromEntries(cards.map((card) => [String(card.id), card]))
}

export function boardGame(seats: number, spec: BoardSpec): Rec {
  const game = richCommanderGame() as { players: Rec[] }
  const players = game.players.slice(0, seats).map((player, index) =>
    index < 2 ? { ...player, battlefield: battlefield(String(index), spec) } : player,
  )
  return { ...game, players }
}

export async function resizeBoard(page: Page, viewport: { width: number; height: number }): Promise<void> {
  await page.mouse.move(1, 1)
  await page.setViewportSize(viewport)
}

const loaded = new WeakSet<Page>()

export async function loadApp(page: Page): Promise<void> {
  await page.goto('/')
  if (loaded.has(page)) return
  loaded.add(page)
  await dismissSetupWizard(page)
}

export async function openBoard(page: Page, viewport: { width: number; height: number }, game: Rec, settings: Rec): Promise<void> {
  await resizeBoard(page, viewport)
  await loadApp(page)
  await drawBoard(page, game, settings)
}

export async function drawBoard(page: Page, game: Rec, settings: Rec): Promise<void> {
  await page.mouse.move(1, 1)
  await showGame(page, game, settings)
  await expect(page.locator(BOARD_SELECTOR).first()).toBeVisible({ timeout: 10_000 })
}

export interface Settle {
  settled: boolean
  changes: number
}

export async function settleAndCount(page: Page): Promise<Settle> {
  await page.waitForFunction(() => [...document.images].every((img) => img.complete), undefined, { timeout: 20_000 })
  const settled = await page.evaluate(
    (opts: { selector: string; calmFrames: number; capMs: number; windowMs: number }) =>
      new Promise<Settle>((resolve) => {
        const board = document.querySelector(opts.selector)
        if (!board) {
          resolve({ settled: false, changes: -1 })
          return
        }
        const SIZING_STYLE = ['--card-w', '--zone-card-w', 'flex', 'flex-grow']
        const SIZING_ATTRS = ['data-band-lines', 'data-band-overflow']
        const probe = document.createElement('div')
        const sizingOf = (name: string, raw: string | null): string => {
          if (name !== 'style') return raw ?? ''
          probe.setAttribute('style', raw ?? '')
          return SIZING_STYLE.map((prop) => probe.style.getPropertyValue(prop)).join('|')
        }
        const known = new Map<Element, Map<string, string>>()
        let total = 0
        const mo = new MutationObserver((records) => {
          const touched = new Map<Element, Set<string>>()
          for (const record of records) {
            const name = record.attributeName
            if (!name || (name !== 'style' && !SIZING_ATTRS.includes(name))) continue
            const el = record.target as Element
            if (el.closest('.flying-cards-overlay')) continue
            let prev = known.get(el)
            if (!prev) {
              prev = new Map()
              known.set(el, prev)
            }
            if (!prev.has(name)) prev.set(name, sizingOf(name, record.oldValue))
            const names = touched.get(el) ?? new Set<string>()
            names.add(name)
            touched.set(el, names)
          }
          for (const [el, names] of touched) {
            const prev = known.get(el) as Map<string, string>
            for (const name of names) {
              const now = sizingOf(name, el.getAttribute(name))
              if (now === prev.get(name)) continue
              prev.set(name, now)
              total++
            }
          }
        })
        mo.observe(board, {
          attributes: true,
          attributeOldValue: true,
          subtree: true,
          attributeFilter: ['style', ...SIZING_ATTRS],
        })
        const started = performance.now()
        let calm = 0
        let last = 0
        const frame = () => {
          if (total === last) calm++
          else {
            calm = 0
            last = total
          }
          if (calm >= opts.calmFrames || performance.now() - started > opts.capMs) {
            const settled = calm >= opts.calmFrames
            const base = total
            setTimeout(() => {
              mo.disconnect()
              resolve({ settled, changes: total - base })
            }, opts.windowMs)
          } else requestAnimationFrame(frame)
        }
        requestAnimationFrame(frame)
      }),
    { selector: BOARD_SELECTOR, calmFrames: CALM_FRAMES, capMs: SETTLE_CAP_MS, windowMs: WINDOW_MS },
  )
  return settled
}

export function settleProblem(result: Settle): string | null {
  if (result.changes < 0) return 'no board on the page'
  if (!result.settled) return `never calmed within ${SETTLE_CAP_MS / 1000} s (${result.changes} size changes in the next ${WINDOW_MS} ms)`
  return result.changes > MAX_BOARD_CHANGES ? `${result.changes} size changes after the board settled` : null
}

export interface ZoneInfo {
  id: string
  zoneCardW: string
  compactPod: boolean
}

export interface BandInfo {
  id: string
  zone: string
  row: string
  children: number
  inlineCardW: string
  cardW: number
  lines: string
  overflowAttr: boolean
  offsetWidth: number
  offsetHeight: number
  clientWidth: number
  clientHeight: number
  scrollWidth: number
  unusedRoom: number
}

export interface BoardInfo {
  zones: ZoneInfo[]
  bands: BandInfo[]
}

export async function inspectBoard(page: Page): Promise<BoardInfo> {
  return page.evaluate(() => {
    const bandClasses = ['creatures-band', 'permanents-band', 'bz-lands-band', 'bz-others-band', 'bz-marquee-band', 'bz-split-band', 'full-width']
    const num = (value: string) => parseFloat(value) || 0
    const zones: ZoneInfo[] = []
    const bands: BandInfo[] = []
    const ordinals = new Map<string, number>()
    document.querySelectorAll<HTMLElement>('.board-zone').forEach((zone, index) => {
      const zoneId = `seat${index}:${zone.dataset.playerId ?? ''}`
      zones.push({ id: zoneId, zoneCardW: zone.style.getPropertyValue('--zone-card-w'), compactPod: zone.classList.contains('compact-pod') })
      zone.querySelectorAll<HTMLElement>('.bz-band').forEach((band) => {
        const row = band.closest<HTMLElement>('.bz-row')
        const rowClass = row ? [...row.classList].find((c) => /^bz-.+-row$/.test(c)) ?? 'row' : 'no-row'
        const classes = bandClasses.filter((c) => band.classList.contains(c))
        const base = [zoneId, rowClass, classes.join('.'), band.dataset.testid ?? ''].join('|')
        const ordinal = ordinals.get(base) ?? 0
        ordinals.set(base, ordinal + 1)
        const kids = Array.from(band.children) as HTMLElement[]
        const style = getComputedStyle(band)
        const gap = num(style.columnGap)
        const lineWidths = new Map<number, { width: number; count: number }>()
        for (const kid of kids) {
          const kidStyle = getComputedStyle(kid)
          const line = lineWidths.get(kid.offsetTop) ?? { width: 0, count: 0 }
          line.width += kid.offsetWidth + num(kidStyle.marginLeft) + num(kidStyle.marginRight)
          line.count++
          lineWidths.set(kid.offsetTop, line)
        }
        let widest = 0
        for (const line of lineWidths.values()) widest = Math.max(widest, line.width + (line.count - 1) * gap)
        const innerW = band.clientWidth - num(style.paddingLeft) - num(style.paddingRight)
        const slot = band.querySelector<HTMLElement>('.card-slot')
        bands.push({
          id: `${base}|${ordinal}`,
          zone: zoneId,
          row: `${zoneId}|${rowClass}`,
          children: kids.length,
          inlineCardW: band.style.getPropertyValue('--card-w'),
          cardW: slot ? slot.offsetWidth : 0,
          lines: band.getAttribute('data-band-lines') ?? '',
          overflowAttr: band.hasAttribute('data-band-overflow'),
          offsetWidth: band.offsetWidth,
          offsetHeight: band.offsetHeight,
          clientWidth: band.clientWidth,
          clientHeight: band.clientHeight,
          scrollWidth: band.scrollWidth,
          unusedRoom: kids.length === 0 ? 0 : Math.max(0, Math.floor(innerW - widest)),
        })
      })
    })
    return { zones, bands }
  })
}

export function flattenBoard(info: BoardInfo): Record<string, string> {
  const out: Record<string, string> = {}
  for (const zone of info.zones) out[`zone ${zone.id} --zone-card-w`] = zone.zoneCardW
  for (const band of info.bands) {
    out[`band ${band.id}`] = JSON.stringify({ inlineCardW: band.inlineCardW, cardW: band.cardW, lines: band.lines, offsetWidth: band.offsetWidth })
  }
  return out
}

export function diffRecords(expected: Record<string, string>, actual: Record<string, string>): string[] {
  const keys = [...new Set([...Object.keys(expected), ...Object.keys(actual)])].sort()
  return keys
    .filter((key) => expected[key] !== actual[key])
    .map((key) => `${key}: expected ${expected[key] ?? '(missing)'} actual ${actual[key] ?? '(missing)'}`)
}

export function sharingViolations(info: BoardInfo): string[] {
  const zones = new Map(info.zones.map((zone) => [zone.id, zone]))
  const rows = new Map<string, BandInfo[]>()
  for (const band of info.bands) {
    if (band.children === 0) continue
    rows.set(band.row, [...(rows.get(band.row) ?? []), band])
  }
  const out: string[] = []
  for (const [row, members] of rows) {
    const sized = members.filter((band) => band.cardW > 0)
    if (new Set(sized.map((band) => band.cardW)).size > 1) {
      out.push(`${row}: bands of one row show cards at different sizes (${sized.map((band) => `${band.id} ${band.cardW} px`).join(', ')})`)
    }
    const atFloor = members.filter((band) => {
      const floor = zones.get(band.zone)?.compactPod ? FLOOR_W_COMPACT_POD : FLOOR_W
      return band.cardW > 0 && (band.cardW <= floor || band.scrollWidth > band.clientWidth + 1)
    })
    for (const low of atFloor) {
      for (const other of members) {
        if (other === low || other.cardW <= 0 || other.unusedRoom <= other.cardW) continue
        out.push(`${row}: ${low.id} is at the floor or scrolls while ${other.id} keeps ${other.unusedRoom} px unused (one card is ${other.cardW} px)`)
      }
    }
  }
  return out
}

export function overflowViolations(info: BoardInfo): string[] {
  const out: string[] = []
  for (const band of info.bands) {
    if (band.scrollWidth <= band.clientWidth + 1) continue
    const eaten = band.offsetHeight - band.clientHeight
    if (eaten !== 0) out.push(`${band.id}: a horizontal scrollbar takes ${eaten} px of the band height`)
    if (!band.overflowAttr) out.push(`${band.id}: scrolls sideways without data-band-overflow`)
  }
  return out
}
