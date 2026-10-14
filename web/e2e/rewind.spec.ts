import { test, expect } from './fixtures'
import { fakeOnly } from './support/fake-mode'
import { dismissSetupWizard } from './support/start-game'
import type { Page } from '@playwright/test'
import { writeFileSync } from 'node:fs'
import { withFakeServer } from './support/fake-backend'
import { login } from './support/start-game'
import { makeBaseScenario } from '../fixtures/fake'
import { playerGameView } from '../src/__fixtures__/gameViews'

fakeOnly()

function player(id: string, name: string, controlled: boolean, life: number) {
  return {
    playerId: id,
    name,
    life,
    controlled,
    isActive: id === 'p1',
    hasPriority: controlled,
    isHuman: controlled,
    defeated: false,
    left: false,
    battlefield: {},
    handCount: 0,
    libraryCount: 50,
    counters: [],
    designationNames: [],
    manaPool: { white: 0, blue: 0, black: 0, red: 0, green: 0, colorless: 0 },
    timers: {},
  }
}

function view(turn: number, step: string, rivalLife: number) {
  return {
    players: [player('p1', 'Adamysz', true, 20), player('p2', 'Rivalmuygrande', false, rivalLife)],
    myPlayerId: 'p1',
    myHand: {},
    turn,
    phase: step,
    step,
    activePlayerId: 'p1',
    activePlayerName: 'Adamysz',
    priorityPlayerName: 'Adamysz',
    stack: {},
    combat: [],
    canPlayObjects: {},
    opponentHands: {},
    watchedHands: {},
    revealed: [],
    exiles: {},
  }
}

async function feed(page: Page, gameView: unknown, id: number) {
  await page.evaluate(
    ({ gameView, id }) => {
      const store = (globalThis as unknown as { __mageStore: { handleMessage: (m: unknown) => void } }).__mageStore
      store.handleMessage({ type: 'event', method: 'GAME_UPDATE', messageId: id, objectId: 'rewind-game', data: { gameView } })
    },
    { gameView, id },
  )
}

test.describe('board rewind @board', () => {
  test('scrubs back to an earlier turn, freezes the board there and returns to live', async ({ page }) => {
    await page.goto('/')
    await dismissSetupWizard(page)
    await page.evaluate(() => {
      const store = (globalThis as unknown as { __mageStore: { getState: () => { settings: Record<string, unknown> }; setState: (s: unknown) => void } }).__mageStore
      store.setState({ phase: 'game', gameId: 'rewind-game', settings: { ...store.getState().settings, boardRewind: true } })
    })
    await feed(page, view(1, 'UPKEEP', 20), 1)
    await feed(page, view(2, 'UPKEEP', 14), 2)
    await feed(page, view(3, 'UPKEEP', 7), 3)

    await expect(page.getByTestId('game-status')).toContainText('3')
    await page.getByTestId('rewind-open').click()
    await expect(page.getByTestId('rewind-status')).toHaveAttribute('data-viewing', 'false')

    await page.getByTestId('rewind-prev').click()
    await page.getByTestId('rewind-prev').click()
    await expect(page.getByTestId('rewind-status')).toHaveAttribute('data-viewing', 'true')
    await expect(page.locator('.game')).toHaveAttribute('data-rewind', 'true')
    await expect(page.getByTestId('game-status')).toContainText('1')

    await feed(page, view(4, 'UPKEEP', 3), 4)
    await expect(page.getByTestId('game-status')).toContainText('1')

    await page.getByTestId('rewind-live').click()
    await expect(page.locator('.game')).not.toHaveAttribute('data-rewind', 'true')
    await expect(page.getByTestId('game-status')).toContainText('4')
    expect(await page.evaluate(() => (window as unknown as { __pageErrors?: string[] }).__pageErrors?.length ?? 0)).toBe(0)
  })

  test('records nothing while the setting is off', async ({ page }) => {
    await page.goto('/')
    await dismissSetupWizard(page)
    await page.evaluate(() => {
      const store = (globalThis as unknown as { __mageStore: { setState: (s: unknown) => void } }).__mageStore
      store.setState({ phase: 'game', gameId: 'rewind-game' })
    })
    await feed(page, view(1, 'UPKEEP', 20), 1)
    await feed(page, view(2, 'UPKEEP', 14), 2)
    await expect(page.getByTestId('game-status')).toContainText('2')
    await expect(page.getByTestId('rewind-open')).toHaveCount(0)
  })

  test('saves a replay file, reopens it from the history tab without a game and closes it', async ({ page }) => {
    await withFakeServer(
      () => makeBaseScenario({ tableId: 'replay-1', tableName: 'replay-room', gameId: 'rewind-game', gameView: playerGameView }),
      async () => {
        await login(page, 'replay-user')
        await page.evaluate(() => {
          const store = (globalThis as unknown as { __mageStore: { getState: () => { settings: Record<string, unknown> }; setState: (s: unknown) => void } }).__mageStore
          store.setState({ phase: 'game', gameId: 'rewind-game', settings: { ...store.getState().settings, boardRewind: true } })
        })
        await feed(page, view(1, 'UPKEEP', 20), 1)
        await feed(page, view(2, 'UPKEEP', 14), 2)
        await feed(page, view(3, 'UPKEEP', 7), 3)

        await page.getByTestId('rewind-open').click()
        const [download] = await Promise.all([page.waitForEvent('download'), page.getByTestId('rewind-save').click()])
        expect(download.suggestedFilename()).toMatch(/^nexus-replay_.*\.json(\.gz)?$/)
        const saved = await download.path()

        await page.evaluate(() => {
          const store = (globalThis as unknown as { __mageStore: { setState: (s: unknown) => void } }).__mageStore
          store.setState({ phase: 'lobby', game: null, gameId: null })
        })
        await page.getByTestId('top-nav-matches').click()
        await page.getByTestId('replay-file-input').setInputFiles(saved)

        await expect(page.getByTestId('rewind-bar')).toBeVisible()
        await expect(page.getByTestId('rewind-status')).toHaveAttribute('data-viewing', 'true')
        await expect(page.getByTestId('game-status')).toContainText('1')
        await page.getByTestId('rewind-next').click()
        await page.getByTestId('rewind-next').click()
        await expect(page.getByTestId('game-status')).toContainText('3')
        await expect(page.getByTestId('rewind-save')).toHaveCount(0)

        await page.getByTestId('replay-close').click()
        await expect(page.getByTestId('rewind-bar')).toHaveCount(0)
        await expect(page.getByTestId('top-nav-matches')).toBeVisible()
      },
    )
  })

  test('rejects a file that is not a replay', async ({ page }, testInfo) => {
    await withFakeServer(
      () => makeBaseScenario({ tableId: 'replay-2', tableName: 'replay-room', gameId: 'rewind-game', gameView: playerGameView }),
      async () => {
        await login(page, 'replay-bad')
        await page.getByTestId('top-nav-matches').click()
        const bad = testInfo.outputPath('not-a-replay.json')
        writeFileSync(bad, '{"hello":"world"}')
        await page.getByTestId('replay-file-input').setInputFiles(bad)
        await expect(page.getByTestId('replay-invalid')).toBeVisible()
        await expect(page.getByTestId('rewind-bar')).toHaveCount(0)
      },
    )
  })
})
