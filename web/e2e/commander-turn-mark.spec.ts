import { test, expect } from './fixtures'
import { fakeOnly } from './support/fake-mode'
import { dismissSetupWizard } from './support/start-game'
import type { Page } from '@playwright/test'

fakeOnly()

function commander(id: string, name: string) {
  return { id, name, manaValue: 3, expansionSetCode: 'TEST', cardNumber: '1', mageObjectType: 'COMMANDER', castCount: 0 }
}

function commanderDuel(activePlayerId: string) {
  const mkPlayer = (id: string, name: string, controlled: boolean) => ({
    playerId: id,
    name,
    life: 40,
    controlled,
    isActive: id === activePlayerId,
    hasPriority: false,
    isHuman: controlled,
    defeated: false,
    left: false,
    battlefield: {},
    handCount: 0,
    libraryCount: 99,
    counters: [],
    commandList: [commander(`cmd-${id}`, `Commander ${name}`)],
    designationNames: [],
    manaPool: { white: 0, blue: 0, black: 0, red: 0, green: 0, colorless: 0 },
    timers: {},
  })
  return {
    players: [mkPlayer('p1', 'Alice', true), mkPlayer('p2', 'Bob', false)],
    myPlayerId: 'p1',
    myHand: {},
    turn: 4,
    phase: 'PRECOMBAT_MAIN',
    step: 'PRECOMBAT_MAIN',
    activePlayerId,
    activePlayerName: activePlayerId === 'p1' ? 'Alice' : 'Bob',
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

async function setGame(page: Page, gameView: unknown) {
  await page.evaluate((gv) => {
    const store = (globalThis as unknown as { __mageStore?: { getState: () => Record<string, unknown>; setState: (s: unknown) => void } }).__mageStore
    store?.setState({ game: gv })
  }, gameView)
}

test('commander 1v1 enfocada: la zona del jugador activo brilla con etiqueta de turno @commander', async ({ page }) => {
  await page.goto('/')
  await dismissSetupWizard(page)
  await expect(page.locator('body')).toBeVisible({ timeout: 10_000 })
  await page.waitForTimeout(400)
  await page.evaluate((gv) => {
    const store = (globalThis as unknown as { __mageStore?: { getState: () => Record<string, unknown>; setState: (s: unknown) => void } }).__mageStore
    const st = store?.getState() as { settings: Record<string, unknown> }
    store?.setState({ phase: 'game', settings: { ...st.settings, boardLayout: 'standard' }, game: gv })
  }, commanderDuel('p2'))
  await expect(page.locator('[data-testid="game-board"]')).toBeVisible({ timeout: 10_000 })

  const bobBar = page.locator('.player-info-bar.opp.is-turn')
  await expect(bobBar).toBeVisible()
  await expect(page.locator('.player-info-bar.my.is-turn')).toHaveCount(0)

  await setGame(page, commanderDuel('p1'))
  const aliceBar = page.locator('.player-info-bar.my.is-turn')
  await expect(aliceBar).toBeVisible()
  await expect(page.locator('.player-info-bar.opp.is-turn')).toHaveCount(0)
})
