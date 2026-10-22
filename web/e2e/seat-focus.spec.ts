import { test, expect } from './fixtures'
import { fakeOnly } from './support/fake-mode'
import { dismissSetupWizard } from './support/start-game'
import type { Page } from '@playwright/test'

fakeOnly()

function land(id: string, name: string) {
  return { id, name, parentId: id, cardTypes: ['Land'], tapped: false, manaValue: 0, expansionSetCode: '', cardNumber: '0' }
}

function creature(id: string, name: string) {
  return { id, name, parentId: id, cardTypes: ['Creature'], power: '2', toughness: '2', tapped: false, manaValue: 2, expansionSetCode: '', cardNumber: '0' }
}

function crowdedBattlefield(prefix: string) {
  const perms: Record<string, unknown> = {}
  for (let i = 1; i <= 14; i++) perms[`${prefix}-c-${i}`] = creature(`${prefix}-c-${i}`, `Bear ${i}`)
  return perms
}

const HIDDEN_NAME = 'Hidden Gem'

function commanderFour({ crowded = false }: { crowded?: boolean } = {}) {
  const mkPlayer = (id: string, name: string, controlled: boolean, battlefield: Record<string, unknown>, handCount = 0) => ({
    playerId: id,
    name,
    life: 40,
    controlled,
    isActive: controlled,
    hasPriority: controlled,
    isHuman: controlled,
    defeated: false,
    left: false,
    battlefield,
    handCount,
    libraryCount: 40,
    counters: [],
    commandList: [{ id: `cmd-${id}`, name: `Commander ${name}`, mageObjectType: 'COMMANDER' }],
    designationNames: [],
    manaPool: { white: 0, blue: 0, black: 0, red: 0, green: 0, colorless: 0 },
    timers: {},
  })
  return {
    players: [
      mkPlayer('p1', 'Alice', true, {
        'me-land-1': land('me-land-1', 'Forest'),
        'me-land-2': land('me-land-2', 'Island'),
        'me-c-1': creature('me-c-1', 'Grizzly Bears'),
      }, 2),
      crowded
        ? mkPlayer('p2', 'Bob', false, crowdedBattlefield('bob'), 3)
        : mkPlayer('p2', 'Bob', false, {
          'bob-land-1': land('bob-land-1', 'Swamp'),
          'bob-c-1': creature('bob-c-1', 'Llanowar Elves'),
        }, 3),
      mkPlayer('p3', crowded ? 'Christopher Ashworth the Third' : 'Carol', false, {
        'carol-land-1': land('carol-land-1', 'Plains'),
        'carol-c-1': creature('carol-c-1', 'Serra Angel'),
      }, 1),
      mkPlayer('p4', 'Dave', false, { 'dave-land-1': land('dave-land-1', 'Mountain') }, 0),
    ],
    myPlayerId: 'p1',
    myHand: {
      'h-1': { id: 'h-1', name: 'Island', parentId: 'h-1', manaValue: 0, expansionSetCode: '', cardNumber: '0' },
      'h-2': { id: 'h-2', name: 'Counterspell', parentId: 'h-2', manaValue: 2, expansionSetCode: '', cardNumber: '0' },
    },
    opponentHands: {
      Carol: { 'oh-1': { id: 'oh-1', name: HIDDEN_NAME, parentId: 'oh-1', manaValue: 0, expansionSetCode: '', cardNumber: '0', faceDown: true } },
    },
    watchedHands: {},
    turn: 4,
    phase: 'PRECOMBAT_MAIN',
    step: 'PRECOMBAT_MAIN',
    activePlayerId: 'p1',
    activePlayerName: 'Alice',
    priorityPlayerName: 'Alice',
    stack: {},
    combat: [],
    canPlayObjects: {},
    revealed: [],
    exiles: {},
  }
}

async function loadArena(page: Page, options: { crowded?: boolean } = {}) {
  await page.goto('/')
  await dismissSetupWizard(page)
  await expect(page.locator('body')).toBeVisible({ timeout: 10_000 })
  await page.waitForTimeout(400)
  await page.evaluate((gameView) => {
    const store = (globalThis as unknown as { __mageStore?: { getState: () => Record<string, any>; setState: (s: unknown) => void } }).__mageStore
    const st = store?.getState() as { settings: Record<string, unknown> }
    store?.setState({ phase: 'game', settings: { ...st.settings, boardLayout: 'arena', gameUi: 'v2', boardFill: true }, game: gameView })
  }, commanderFour(options))
  await expect(page.locator('[data-testid="arena-board"]')).toBeVisible({ timeout: 10_000 })
  await expect(page.locator('.arena-opp-cell')).toHaveCount(3)
}

async function meWidth(page: Page): Promise<number> {
  return page.evaluate(() => {
    const zone = document.querySelector('.arena-board > .player-zone')
    if (!zone) throw new Error('mi player-zone no encontrada')
    return zone.getBoundingClientRect().width
  })
}

async function cellState(page: Page, playerId: string) {
  return page.evaluate((id) => {
    const cell = document.querySelector(`.arena-opp-cell [data-player-id="${id}"]`)?.closest('.arena-opp-cell')
    if (!cell) throw new Error(`celda de ${id} no encontrada`)
    const zone = cell.querySelector<HTMLElement>(':scope > .board-zone, :scope > * > .board-zone') ?? cell.querySelector<HTMLElement>('.board-zone')
    if (!zone) throw new Error(`zona de ${id} no encontrada`)
    return {
      focused: cell.classList.contains('seat-focus-on'),
      shrunk: zone.dataset.seatMode === 'status',
      width: cell.getBoundingClientRect().width,
      battlefieldRows: zone.querySelectorAll('.bz-permanents-row, .bz-creatures-row').length,
    }
  }, playerId)
}

test('BRD-3: focusing an opponent gives their board the row and shrinks the others to status strips @seat-focus', async ({ page }) => {
  await loadArena(page)
  const mine = await meWidth(page)
  const equal = await Promise.all(['p2', 'p3', 'p4'].map((id) => cellState(page, id)))
  expect(equal.every((c) => !c.focused && !c.shrunk)).toBe(true)

  await page.getByTestId('seat-focus-p2').click()
  await expect(page.getByTestId('seat-focus-p2')).toHaveAttribute('aria-pressed', 'true')
  const p2 = await cellState(page, 'p2')
  const p3 = await cellState(page, 'p3')
  const p4 = await cellState(page, 'p4')
  expect(p2.focused).toBe(true)
  expect(p2.battlefieldRows).toBeGreaterThan(0)
  expect(p3.shrunk).toBe(true)
  expect(p4.shrunk).toBe(true)
  expect(p3.battlefieldRows, 'a shrunk seat shows no battlefield').toBe(0)
  expect(p4.battlefieldRows, 'a shrunk seat shows no battlefield').toBe(0)
  await expect
    .poll(async () => (await cellState(page, 'p2')).width > (await cellState(page, 'p3')).width * 2, { message: 'the focused board takes most of the row' })
    .toBe(true)
  expect(await meWidth(page), 'my board keeps its width').toBeCloseTo(mine, 0)
})

test('BRD-3: a shrunk seat takes the focus, and All boards restores the equal columns @seat-focus', async ({ page }) => {
  await loadArena(page)
  await page.getByTestId('seat-focus-p2').click()
  await page.getByTestId('seat-focus-p4').click()
  await expect(page.getByTestId('seat-focus-p4')).toHaveAttribute('aria-pressed', 'true')
  expect((await cellState(page, 'p4')).focused).toBe(true)
  expect((await cellState(page, 'p2')).shrunk).toBe(true)

  await page.getByTestId('seat-focus-all').click()
  await expect(page.getByTestId('seat-focus-all')).toHaveCount(0)
  const cells = await Promise.all(['p2', 'p3', 'p4'].map((id) => cellState(page, id)))
  expect(cells.some((c) => c.focused || c.shrunk)).toBe(false)
  expect(cells.every((c) => c.battlefieldRows > 0)).toBe(true)
})

test('BRD-3: a hidden opponent card never shows up when its board is focused or shrunk @seat-focus', async ({ page }) => {
  await loadArena(page)
  await expect(page.getByText(HIDDEN_NAME)).toHaveCount(0)
  await page.getByTestId('seat-focus-p2').click()
  await expect(page.getByTestId('seat-focus-p2')).toHaveAttribute('aria-pressed', 'true')
  await expect(page.getByText(HIDDEN_NAME)).toHaveCount(0)
  await page.getByTestId('seat-focus-p3').click()
  await expect(page.getByTestId('seat-focus-p3')).toHaveAttribute('aria-pressed', 'true')
  await expect(page.getByText(HIDDEN_NAME)).toHaveCount(0)
})

async function zoneCardW(page: Page, playerId: string | null): Promise<number> {
  return page.evaluate((id) => {
    const zone = id
      ? document.querySelector<HTMLElement>(`.arena-opp-cell [data-player-id="${id}"]`)
      : document.querySelector<HTMLElement>('.arena-board > .player-zone')
    if (!zone) throw new Error(`zona ${id ?? 'propia'} no encontrada`)
    return parseFloat(zone.style.getPropertyValue('--card-w'))
  }, playerId)
}

async function maxCardWidth(page: Page, playerId: string | null): Promise<number> {
  return page.evaluate((id) => {
    const scope = id
      ? document.querySelector(`.arena-opp-cell [data-player-id="${id}"]`)?.closest('.arena-opp-cell')
      : document.querySelector('.arena-board > .player-zone')
    if (!scope) throw new Error(`zona ${id ?? 'propia'} no encontrada`)
    const widths = Array.from(scope.querySelectorAll<HTMLElement>('.bz-band .card-slot')).map((el) => el.offsetWidth)
    if (widths.length === 0) throw new Error(`sin cartas en ${id ?? 'mi campo'}`)
    return Math.max(...widths)
  }, playerId)
}

test('BRD-3: a crowded opponent board grows back when focused, and never past a card on my own board @seat-focus', async ({ page }) => {
  await page.setViewportSize({ width: 1366, height: 768 })
  await loadArena(page, { crowded: true })
  const before = await maxCardWidth(page, 'p2')
  const mine = await maxCardWidth(page, null)
  expect(before, 'the crowded column shrinks its cards below mine').toBeLessThan(mine)
  const myZoneW = await zoneCardW(page, null)

  await page.getByTestId('seat-focus-p2').click()
  await expect
    .poll(() => maxCardWidth(page, 'p2'), { message: 'focusing grows the crowded board back' })
    .toBeGreaterThan(before)
  await expect
    .poll(() => zoneCardW(page, 'p2'), { message: 'the focused seat is capped at my card width' })
    .toBeLessThanOrEqual(myZoneW)
  await expect
    .poll(() => maxCardWidth(page, 'p2'), { message: 'no card on the focused board is wider than mine' })
    .toBeLessThanOrEqual(mine + 0.5)
  expect(await maxCardWidth(page, null), 'my board keeps its cards').toBeCloseTo(mine, 0)
})

test('BRD-3: a shrunk strip shows the full name and the library, graveyard and exile chips @seat-focus', async ({ page }) => {
  await page.setViewportSize({ width: 1366, height: 768 })
  await loadArena(page, { crowded: true })
  await page.addStyleTag({
    content: ':root { --font-ui: monospace !important } .arena-opp-cell .seat-strip .player-name { letter-spacing: 0.1em !important }',
  })
  await page.getByTestId('seat-focus-p2').click()
  await expect(page.getByTestId('seat-focus-p2')).toHaveAttribute('aria-pressed', 'true')
  const strip = page.locator('.arena-opp-cell [data-player-id="p3"].seat-strip')
  await expect(strip).toBeVisible()

  const name = strip.locator('.player-name')
  await expect(name).toHaveText('Christopher Ashworth the Third')
  await strip.evaluate((el) => Promise.all(el.closest('.arena-opp-cell')!.getAnimations({ subtree: true }).map((a) => a.finished)))
  await expect
    .poll(
      () =>
        name.evaluate((el) => {
          const box = el.closest('.seat-strip')!.getBoundingClientRect()
          return el.scrollWidth <= el.clientWidth && el.getBoundingClientRect().right <= box.right
        }),
      { message: 'the name is not clipped and stays inside the strip' },
    )
    .toBe(true)

  for (const chip of ['library-chip', 'graveyard-chip', 'exile-chip']) {
    const box = await strip.locator(`.resource-chip.${chip}`).boundingBox()
    expect(box?.width ?? 0, `${chip} is visible on the strip`).toBeGreaterThan(0)
  }
})
