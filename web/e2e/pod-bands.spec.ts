import { test, expect } from './fixtures'
import { fakeOnly } from './support/fake-mode'
import type { Page } from '@playwright/test'

fakeOnly()

function land(id: string, name: string) {
  return { id, name, parentId: id, cardTypes: ['Land'], tapped: false, manaValue: 0, expansionSetCode: '', cardNumber: '0' }
}

function creature(id: string, name: string) {
  return { id, name, parentId: id, cardTypes: ['Creature'], power: '2', toughness: '2', tapped: false, manaValue: 2, expansionSetCode: '', cardNumber: '0' }
}

function podGame(myBattlefield: Record<string, unknown>, bobHandCount = 0, revealed: unknown[] = []) {
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
    commandList: [],
    designationNames: [],
    manaPool: { white: 0, blue: 0, black: 0, red: 0, green: 0, colorless: 0 },
    timers: {},
  })
  return {
    players: [
      mkPlayer('p1', 'Alice', true, myBattlefield),
      mkPlayer('p2', 'Bob', false, {}, bobHandCount),
      mkPlayer('p3', 'Carol', false, {}),
    ],
    myPlayerId: 'p1',
    myHand: {},
    turn: 3,
    phase: 'PRECOMBAT_MAIN',
    step: 'PRECOMBAT_MAIN',
    activePlayerId: 'p1',
    activePlayerName: 'Alice',
    priorityPlayerName: 'Alice',
    stack: {},
    combat: [],
    canPlayObjects: {},
    opponentHands: {},
    watchedHands: {},
    revealed,
    exiles: {},
  }
}

async function loadPodGame(page: Page, gameView: unknown) {
  await page.goto('/')
  await expect(page.locator('body')).toBeVisible({ timeout: 10_000 })
  await page.waitForTimeout(400)
  await page.evaluate((gv) => {
    const store = (globalThis as unknown as { __mageStore?: { getState: () => Record<string, any>; setState: (s: unknown) => void } }).__mageStore
    const st = store?.getState() as { settings: Record<string, unknown> }
    store?.setState({ phase: 'game', settings: { ...st.settings, boardLayout: 'pod' }, game: gv })
  }, gameView)
  const board = page.locator('[data-testid="pod-board"]')
  await expect(board).toBeVisible({ timeout: 10_000 })
}

async function myBandBoxes(page: Page) {
  return page.evaluate(() => {
    const zone = document.querySelector('.pod-board .pod-cell--me .player-zone')
    if (!zone) throw new Error('mi player-zone del pod no encontrada')
    const info = (sel: string) => {
      const el = zone.querySelector(sel) as HTMLElement | null
      if (!el) throw new Error(`banda ${sel} no encontrada`)
      const r = el.getBoundingClientRect()
      return { display: getComputedStyle(el).display, height: r.height }
    }
    return { creatures: info('.creatures-band'), permanents: info('.permanents-band') }
  })
}

test('pod: la banda de criaturas existe aunque solo haya tierras (sin division dinamica) @pod', async ({ page }) => {
  await loadPodGame(page, podGame({ 'land-1': land('land-1', 'Forest'), 'land-2': land('land-2', 'Island') }))
  const boxes = await myBandBoxes(page)
  expect(boxes.permanents.display, 'banda de tierras visible').not.toBe('none')
  expect(boxes.permanents.height, 'banda de tierras con altura').toBeGreaterThan(10)
  expect(boxes.creatures.display, 'banda de criaturas NO colapsada aunque vacia').not.toBe('none')
  expect(boxes.creatures.height, 'banda de criaturas reserva su mitad').toBeGreaterThan(10)
})

test('pod: la banda de tierras existe aunque solo haya criaturas (sin division dinamica) @pod', async ({ page }) => {
  await loadPodGame(page, podGame({ 'c-1': creature('c-1', 'Grizzly Bears') }))
  const boxes = await myBandBoxes(page)
  expect(boxes.creatures.display, 'banda de criaturas visible').not.toBe('none')
  expect(boxes.creatures.height, 'banda de criaturas con altura').toBeGreaterThan(10)
  expect(boxes.permanents.display, 'banda de tierras NO colapsada aunque vacia').not.toBe('none')
  expect(boxes.permanents.height, 'banda de tierras reserva su mitad').toBeGreaterThan(10)
})

test('pod: la mano enemiga colapsa a stack ×N sin marca de vista (privada) @pod', async ({ page }) => {
  await loadPodGame(page, podGame({}, 5))
  const stack = page.locator('[data-testid="opp-hand-stack"]')
  await expect(stack, 'stack de dorsos visible').toBeVisible({ timeout: 10_000 })
  await expect(stack).toHaveAttribute('data-count', '5')
  await expect(stack).toContainText('×5')
  await expect(stack).not.toHaveClass(/is-viewable/)
})

test('pod: mano revelada abre el visor con conocidas + dorsos @pod', async ({ page }) => {
  const bolt = { id: 'rk1', name: 'Lightning Bolt', manaValue: 1, expansionSetCode: 'lea', cardNumber: '1' }
  const shock = { id: 'rk2', name: 'Shock', manaValue: 1, expansionSetCode: 'lea', cardNumber: '2' }
  await loadPodGame(page, podGame({}, 4, [{ cards: { rk1: bolt, rk2: shock } }]))
  const stack = page.locator('[data-testid="opp-hand-stack"]')
  await expect(stack, 'stack de dorsos visible').toBeVisible({ timeout: 10_000 })
  await expect(stack).toHaveAttribute('data-count', '2')
  await expect(stack).toHaveClass(/is-viewable/)
  await stack.click()
  const viewer = page.locator('[data-testid="hand-viewer"]')
  await expect(viewer, 'visor de mano abierto').toBeVisible({ timeout: 10_000 })
  await expect(viewer.locator('[data-card-name="Lightning Bolt"]')).toHaveCount(1)
  await expect(viewer.locator('[data-card-name="Shock"]')).toHaveCount(1)
  await expect(viewer.locator('[data-testid="hand-viewer-back"]')).toHaveCount(2)
  await expect(viewer.locator('.pile-card-wrapper .pile-position-badge').nth(2)).toHaveText('#3')
  await page.keyboard.press('Escape')
  await expect(viewer, 'visor cerrado con Escape').toBeHidden({ timeout: 10_000 })
})
