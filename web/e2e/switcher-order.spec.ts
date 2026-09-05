import { test, expect } from './fixtures'
import { fakeOnly } from './support/fake-mode'
import type { Page } from '@playwright/test'

fakeOnly()

function stdMulti(activePlayerId: string) {
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
    commandList: [],
    designationNames: [],
    manaPool: { white: 0, blue: 0, black: 0, red: 0, green: 0, colorless: 0 },
    timers: {},
  })
  return {
    players: [mkPlayer('p1', 'Alice', true), mkPlayer('p2', 'Bob', false), mkPlayer('p3', 'Carol', false)],
    myPlayerId: 'p1',
    myHand: {},
    turn: 4,
    phase: 'PRECOMBAT_MAIN',
    step: 'PRECOMBAT_MAIN',
    activePlayerId,
    activePlayerName: activePlayerId === 'p1' ? 'Alice' : activePlayerId === 'p2' ? 'Bob' : 'Carol',
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

async function setGame(page: Page, gameView: unknown, layout = 'standard') {
  await page.evaluate(({ gv, l }) => {
    const store = (globalThis as unknown as { __mageStore?: { getState: () => Record<string, unknown>; setState: (s: unknown) => void } }).__mageStore
    const st = store?.getState() as { settings: Record<string, unknown> }
    store?.setState({ phase: 'game', settings: { ...st.settings, boardLayout: l }, game: gv })
  }, { gv: gameView, l: layout })
}

test('estandar multi: switcher en orden de turnos con flechas y yo desactivado @switcher', async ({ page }) => {
  await page.goto('/')
  await expect(page.locator('body')).toBeVisible({ timeout: 10_000 })
  await page.waitForTimeout(400)
  await setGame(page, stdMulti('p2'))
  await expect(page.locator('[data-testid="game-board"]')).toBeVisible({ timeout: 10_000 })

  const bar = page.locator('.opponent-switcher-bar')
  await expect(bar).toBeVisible()
  await expect(bar.locator('.opp-pill')).toHaveCount(3)
  await expect(bar.locator('.opp-arrow')).toHaveCount(3)

  const order = await bar.locator('.opp-pill').evaluateAll((els) =>
    els.map((el) => el.querySelector('span')?.textContent?.trim()),
  )
  expect(order).toEqual(['Alice', 'Bob', 'Carol'])

  await expect(page.locator('[data-testid="opp-arrow-p2-p3"]')).toHaveClass(/is-active-edge/)
  await expect(page.locator('[data-testid="opp-arrow-p1-p2"]')).not.toHaveClass(/is-active-edge/)

  const mePill = bar.locator('.opp-pill.is-self')
  await expect(mePill).toBeVisible()
  await expect(mePill).toBeDisabled()

  await setGame(page, stdMulti('p3'))
  await expect(page.locator('[data-testid="opp-arrow-p3-p1"]')).toHaveClass(/is-active-edge/)
})
