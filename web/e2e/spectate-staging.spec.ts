import { test, expect } from '@playwright/test'
import { fakeOnly } from './support/fake-mode'
import { withFakeServer } from './support/fake-backend'
import { login } from './support/start-game'
import {
  spectateCommanderScenario,
  SPECTATE_GAME_ID,
  SPECTATE_TABLE_NAME,
} from '../fixtures/scenarios/spectateCommander'

fakeOnly()

async function watchThePod(page: import('@playwright/test').Page) {
  await login(page, 'watcher')
  await expect(page.getByText(SPECTATE_TABLE_NAME).first()).toBeVisible({ timeout: 15_000 })
  await page.locator('.table-card [data-testid="watch-btn"]').first().click()
}

test.describe('Spectator waiting room', () => {
  test('LBY-33: watching a Commander pod shows the pod, never an invented duel', async ({ page }) => {
    await withFakeServer(() => spectateCommanderScenario(), async () => {
      await watchThePod(page)

      await expect(page.getByTestId('staging-stepper')).toBeVisible({ timeout: 15_000 })
      await expect(page.getByTestId('staging-ring')).toBeVisible()
      await expect(page.locator('.staging-duel-roster')).toHaveCount(0)
      await expect(page.getByTestId('staging-roster-pending')).toHaveCount(0)
      await expect(page.getByText('Commander Free For All')).toBeVisible()
      await expect(page.getByTestId('staging-stepper')).toContainText('4/4')
      for (const name of ['host', 'alice', 'bob', 'charlie']) {
        await expect(page.getByText(name, { exact: true }).first()).toBeVisible()
      }
    })
  })

  test('LBY-33: the accepted watch is not sent twice, so no "Command failed"', async ({ page }) => {
    const watchGameCalls: string[] = []
    await withFakeServer(() => spectateCommanderScenario(watchGameCalls, true), async () => {
      await watchThePod(page)

      await expect(page.getByTestId('staging-stepper')).toBeVisible({ timeout: 15_000 })
      // the replayed WATCHGAME has landed by now (the scenario fires it 150 ms later)
      await expect(page.getByTestId('staging-ring')).toBeVisible()
      await expect(page.getByTestId('staging-error')).toHaveCount(0)
      expect(watchGameCalls).toEqual([SPECTATE_GAME_ID])
    })
  })
})
