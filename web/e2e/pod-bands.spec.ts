import { test, expect } from './fixtures'
import { fakeOnly } from './support/fake-mode'
import { dismissInfoWindows } from './support/info-windows'
import { dismissSetupWizard } from './support/start-game'
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
  await dismissSetupWizard(page)
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

test('HND-8: pod: an opponent hand collapses into a ×N stack with no view mark (private) @pod', async ({ page }) => {
  await loadPodGame(page, podGame({}, 5))
  const stack = page.locator('[data-testid="opp-hand-stack"]')
  await expect(stack, 'stack de dorsos visible').toBeVisible({ timeout: 10_000 })
  await expect(stack).toHaveAttribute('data-count', '5')
  await expect(stack).toContainText('×5')
  await expect(stack).not.toHaveClass(/is-viewable/)
})

test('HND-9: pod: a revealed hand opens the viewer with known cards + backs @pod', async ({ page }) => {
  const bolt = { id: 'rk1', name: 'Lightning Bolt', manaValue: 1, expansionSetCode: 'lea', cardNumber: '1' }
  const shock = { id: 'rk2', name: 'Shock', manaValue: 1, expansionSetCode: 'lea', cardNumber: '2' }
  await loadPodGame(page, podGame({}, 4, [{ name: "Cards in Bob's hand", cards: { rk1: bolt, rk2: shock } }]))
  // that revealed group latches its own viewer open over the board; this spec is about the
  // face-down hand stack's viewer, so get rid of the other one first
  await dismissInfoWindows(page)
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

test("HND-13: pod: a revealed window that is not a hand stays out of every opponent's hand @pod", async ({ page }) => {
  const bolt = { id: 'rk1', name: 'Lightning Bolt', manaValue: 1, expansionSetCode: 'lea', cardNumber: '1' }
  const shock = { id: 'rk2', name: 'Shock', manaValue: 1, expansionSetCode: 'lea', cardNumber: '2' }
  // The window a library reveal opens: named after its source, and the same list for every player.
  const game = podGame({}, 3, [{ name: 'Bloodbraid Elf [1]', cards: { rk1: bolt, rk2: shock } }]) as Record<string, any>
  game.players[2].handCount = 3
  await loadPodGame(page, game)
  await dismissInfoWindows(page)
  for (const id of ['p2', 'p3']) {
    const zone = page.locator(`[data-player-id="${id}"]`)
    const stack = zone.locator('[data-testid="opp-hand-stack"]')
    await expect(stack, `${id}: stack de dorsos visible`).toBeVisible({ timeout: 10_000 })
    await expect(stack, `${id}: los dorsos siguen siendo 3`).toHaveAttribute('data-count', '3')
    await expect(stack, `${id}: nada conocido que abrir`).not.toHaveClass(/is-viewable/)
    await expect(zone.locator('[data-card-name="Lightning Bolt"]'), `${id}: la carta revelada no esta en su mano`).toHaveCount(0)
    await expect(zone.locator('[data-card-name="Shock"]'), `${id}: la carta revelada no esta en su mano`).toHaveCount(0)
  }
})
