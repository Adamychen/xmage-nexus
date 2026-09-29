import { test, expect } from './fixtures'
import type { Page } from '@playwright/test'
import { fakeOnly } from './support/fake-mode'
import { withFakeServer } from './support/fake-backend'
import { login } from './support/start-game'
import { makeBaseScenario } from '../fixtures/fake'
import { playerGameView } from '../src/__fixtures__/gameViews'

fakeOnly()

function lobbyScenario() {
  return makeBaseScenario({
    tableId: 'table-pr-room',
    tableName: 'presets-room',
    gameId: 'game-pr-room',
    gameView: playerGameView,
  })
}

async function openGameplay(page: Page) {
  await page.getByTestId('open-settings').click()
  await page.getByTestId('settings-nav-gameplay').click()
  await expect(page.getByTestId('settings-presets')).toBeVisible()
}

test.describe('Gameplay presets', { tag: '@presets' }, () => {
  test('simple preset persists across sessions and manual tweaks switch to custom', async ({ page }) => {
    await withFakeServer(lobbyScenario, async () => {
      await login(page, 'pr-user')
      await openGameplay(page)

      await page.getByTestId('settings-preset-simple').click()
      await expect(page.getByTestId('settings-preset-simple')).toHaveClass(/selected/)
      const stored = await page.evaluate(() => ({
        preset: window.localStorage.getItem('mage-web-gameplay-preset'),
        stops: window.localStorage.getItem('mage-web-phase-stops'),
        mana: window.localStorage.getItem('mage-web-mana-payment'),
      }))
      expect(stored.preset).toBe('simple')
      expect(JSON.parse(stored.stops ?? '{}').yourTurn.main1).toBe(false)
      expect(JSON.parse(stored.mana ?? '{}').confirmEmptyPool).toBe(false)
      expect(JSON.parse(stored.mana ?? '{}').restricted).toBe(false)

      await page.reload()
      let inLobby = false
      for (let i = 0; i < 40 && !inLobby; i++) {
        if ((await page.getByTestId('open-settings').count()) > 0) {
          inLobby = true
        } else {
          await page.waitForTimeout(500)
        }
      }
      if (!inLobby) {
        await login(page, 'pr-user')
      }
      await openGameplay(page)
      await expect(page.getByTestId('settings-preset-simple')).toHaveClass(/selected/)

      await page.getByTestId('settings-stop-your-main1').click()
      await expect(page.getByTestId('settings-preset-simple')).not.toHaveClass(/selected/)
      const presetAfter = await page.evaluate(() => window.localStorage.getItem('mage-web-gameplay-preset'))
      expect(presetAfter).toBeNull()
    })
  })
})
