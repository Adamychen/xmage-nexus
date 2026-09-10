import { test, expect } from '@playwright/test'
import { fakeOnly } from './support/fake-mode'
import { withFakeServer } from './support/fake-backend'
import { login } from './support/start-game'
import { makeBaseScenario } from '../fixtures/fake'
import { playerGameView } from '../src/__fixtures__/gameViews'

fakeOnly()

function lobbyScenario() {
  return makeBaseScenario({
    tableId: 'table-set-1',
    tableName: 'settings-e2e',
    gameId: 'game-set-1',
    gameView: playerGameView,
  })
}

test.describe('Global settings modal', () => {
  test('abre desde el header, cambia de sección y ajusta el zoom sin iconos', async ({ page }) => {
    await withFakeServer(lobbyScenario, async () => {
      await login(page, 'e2e')
      await page.getByTestId('open-settings').click()
      await expect(page.getByTestId('settings-modal')).toBeVisible()
      await expect(page.getByTestId('settings-section-language')).toBeVisible()
      await expect(page.locator('.settings-nav svg')).toHaveCount(0)
      await page.getByTestId('settings-nav-interface').click()
      await expect(page.getByTestId('settings-section-interface')).toBeVisible()
      await page.getByTestId('settings-zoom-plus').click()
      await expect(page.getByTestId('settings-zoom-current')).toHaveText('110%')
      await page.getByTestId('settings-nav-sound').click()
      await expect(page.locator('[data-testid="settings-sound-card"] .audio-slider').first()).toBeVisible()
      await page.getByTestId('settings-nav-gameplay').click()
      await expect(page.getByTestId('settings-section-gameplay')).toBeVisible()
      await page.getByTestId('settings-close').click()
      await expect(page.getByTestId('settings-modal')).toBeHidden()
    })
  })

  test('secciones sonido y tablero conservan su layout (grid + tarjeta fx)', async ({ page }) => {
    await withFakeServer(lobbyScenario, async () => {
      await login(page, 'e2e')
      await page.getByTestId('open-settings').click()
      await expect(page.getByTestId('settings-modal')).toBeVisible()

      await page.getByTestId('settings-nav-sound').click()
      const soundCard = page.getByTestId('settings-sound-card')
      await expect(soundCard).toBeVisible()
      const toggleBox = await soundCard.locator('.fx-toggle').first().boundingBox()
      expect(toggleBox?.width).toBeGreaterThanOrEqual(30)
      const labelBox = await soundCard.locator('.fx-popover-label').first().boundingBox()
      const hintBox = await soundCard.locator('.fx-popover-hint').first().boundingBox()
      expect(labelBox && hintBox && hintBox.y).toBeGreaterThan(labelBox.y)

      await page.getByTestId('settings-nav-board').click()
      const sleeveGrid = page.locator('.appearance-sleeve-grid').first()
      await expect(sleeveGrid).toBeVisible()
      await expect.poll(
        () => sleeveGrid.evaluate((el) => getComputedStyle(el).display),
        { timeout: 5000 },
      ).toBe('grid')
    })
  })
})
