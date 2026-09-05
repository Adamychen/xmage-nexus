import { test, expect } from '@playwright/test'
import { fakeOnly } from './support/fake-mode'
import { withFakeServer } from './support/fake-backend'
import { login } from './support/start-game'
import { makeBaseScenario } from '../fixtures/fake'
import { playerGameView } from '../src/__fixtures__/gameViews'

fakeOnly()

function lobbyScenario() {
  return makeBaseScenario({
    tableId: 'table-zoom-1',
    tableName: 'zoom-e2e',
    gameId: 'game-zoom-1',
    gameView: playerGameView,
  })
}

async function zoomOf(page: import('@playwright/test').Page) {
  return page.evaluate(() => document.documentElement.style.getPropertyValue('zoom'))
}

test.describe('UI zoom (browser-like)', () => {
  test('Ctrl+= / Ctrl+0 cambian el zoom y el % se muestra en el header', async ({ page }) => {
    await withFakeServer(lobbyScenario, async () => {
      await login(page, 'e2e')
      const readout = page.locator('.lobby-scale-readout')
      await expect(readout).toBeVisible({ timeout: 15_000 })
      await expect(readout).toHaveText('100%')
      await page.keyboard.down('Control')
      await page.keyboard.press('=')
      await page.keyboard.up('Control')
      await expect(readout).toHaveText('110%')
      expect(await zoomOf(page)).toBe('1.1')
      await page.keyboard.down('Control')
      await page.keyboard.press('0')
      await page.keyboard.up('Control')
      await expect(readout).toHaveText('100%')
      expect(await zoomOf(page)).toBe('1')
    })
  })

  test('el stepper de Configuración suma de 10 en 10 y los presets fijan paradas', async ({ page }) => {
    await withFakeServer(lobbyScenario, async () => {
      await login(page, 'e2e')
      await page.getByTestId('open-settings').click()
      await page.getByTestId('settings-nav-interface').click()
      const current = page.getByTestId('settings-zoom-current')
      await expect(current).toBeVisible()
      await page.getByTestId('settings-zoom-plus').click()
      await expect(current).toHaveText('110%')
      await page.getByTestId('settings-zoom-1-15').click()
      await expect(current).toHaveText('115%')
      expect(await zoomOf(page)).toBe('1.15')
    })
  })
})
