import { test, expect } from './fixtures'
import { fakeOnly } from './support/fake-mode'
import { dismissSetupWizard } from './support/start-game'
import type { Page } from '@playwright/test'

fakeOnly()

function autoPodGame() {
  const mkPlayer = (id: string, name: string, controlled: boolean) => ({
    playerId: id,
    name,
    life: 20,
    controlled,
    isActive: id === 'p1',
    hasPriority: id === 'p1',
    isHuman: true,
    defeated: false,
    left: false,
    battlefield: {},
    handCount: 7,
    libraryCount: 23,
    counters: [],
    commandList: [],
    designationNames: [],
    manaPool: { white: 0, blue: 0, black: 0, red: 0, green: 0, colorless: 0 },
    timers: {},
  })
  return {
    players: [mkPlayer('p1', 'Alice', true), mkPlayer('p2', 'Bob', false), mkPlayer('p3', 'Carol', false)],
    myPlayerId: 'p1',
    myHand: {},
    turn: 1,
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
    revealed: [],
    exiles: {},
  }
}

async function loadGame(page: Page, settings: Record<string, unknown>) {
  await page.goto('/')
  await dismissSetupWizard(page)
  await expect(page.locator('body')).toBeVisible({ timeout: 10_000 })
  await page.waitForTimeout(400)
  await page.evaluate(([gv, s]) => {
    const store = (globalThis as unknown as { __mageStore?: { getState: () => Record<string, any>; setState: (st: unknown) => void } }).__mageStore
    const st = store?.getState() as { settings: Record<string, unknown> }
    store?.setState({ phase: 'game', settings: { ...st.settings, ...(s as Record<string, unknown>) }, game: gv })
  }, [autoPodGame(), settings] as unknown as unknown)
  await page.waitForTimeout(400)
}

test('auto-pod: 3j con Estándar sin override arranca en Pod 2×2 @pod', async ({ page }) => {
  await loadGame(page, { boardLayout: 'standard', boardLayoutManual: false })
  await expect(page.locator('[data-testid="pod-board"]'), 'pod automático con 3+ sin override').toBeVisible({ timeout: 10_000 })
  await expect(page.locator('[data-testid="game-board"]'), 'sin tablero estándar').toHaveCount(0)
})

test('override manual: Estándar elegido en Ajustes se respeta con 3j @pod', async ({ page }) => {
  await loadGame(page, { boardLayout: 'standard', boardLayoutManual: true })
  await expect(page.locator('[data-testid="game-board"]'), 'estándar manual respetado').toBeVisible({ timeout: 10_000 })
  await expect(page.locator('[data-testid="pod-board"]'), 'sin pod automático').toHaveCount(0)
})
