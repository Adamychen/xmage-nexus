import { test, expect } from '@playwright/test'
import { fakeOnly } from './support/fake-mode'
import { withFakeServer } from './support/fake-backend'
import { login } from './support/start-game'
import { makeBaseScenario } from '../fixtures/fake'
import { playerGameView } from '../src/__fixtures__/gameViews'

fakeOnly()

function lobbyScenario() {
  return makeBaseScenario({
    tableId: 'table-report-1',
    tableName: 'report-e2e-room',
    gameId: 'game-report-1',
    gameView: playerGameView,
  })
}

test.describe('Report dialog from the lobby', () => {
  test('opens from the header, starts on the feedback tab, and sends over the fake wire', async ({ page }) => {
    await withFakeServer(lobbyScenario, async () => {
      await page.route('https://api.github.com/**', (route) => route.abort())
      await page.addInitScript(() => {
        window.localStorage.clear()
      })
      await login(page, 'report-e2e')

      await page.getByTestId('open-report').click()
      await expect(page.getByTestId('report-dialog')).toBeVisible()
      await expect(page.getByTestId('report-tab-feedback')).toHaveAttribute('aria-selected', 'true')

      await page.getByTestId('report-text').fill('the deck list is hard to read at 100% zoom')
      await expect(page.getByTestId('report-send')).toBeEnabled()
      await page.getByTestId('report-send').click()
      await expect(page.getByTestId('report-status')).toContainText('fake-report-1')
    })
  })
})
