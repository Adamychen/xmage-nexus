import { test, expect } from '@playwright/test'
import { fakeOnly } from './support/fake-mode'
import { withFakeServer } from './support/fake-backend'
import { login, createTable } from './support/start-game'
import { makeBaseScenario } from '../fixtures/fake'
import { playerGameView } from '../src/__fixtures__/gameViews'

fakeOnly()

const TABLE_ID = 'table-chat-stg-1'
const TABLE_NAME = 'staging-chat-e2e'

function chatStagingScenario() {
  return makeBaseScenario({
    tableId: TABLE_ID,
    tableName: TABLE_NAME,
    gameId: 'game-chat-stg-1',
    gameView: playerGameView,
  })
}

test.describe('Staging table chat (U4-11)', () => {
  test('la sala muestra el chat de la mesa y envía/recibe en ese canal', async ({ page }) => {
    await withFakeServer(chatStagingScenario, async () => {
      await login(page, 'e2e')
      await createTable(page, TABLE_NAME)
      await expect(page.getByTestId('staging-player-actions')).toBeVisible({ timeout: 15_000 })

      const chatBody = page.locator('.staging-chat-body')
      await expect(chatBody).toBeVisible()
      await expect(page.locator('.staging-chat-header')).toContainText(/Chat de la Mesa|Table Chat/i, { timeout: 10_000 })

      await chatBody.locator('.chat-input input').fill('hola mesa')
      await chatBody.locator('.chat-input button[type="submit"]').click()
      await expect(chatBody.locator('.chat-list')).toContainText('mesa-rival:', { timeout: 5_000 })
      await expect(chatBody.locator('.chat-list')).toContainText('hola mesa', { timeout: 5_000 })
      await expect(chatBody.locator('.chat-list .chat-time').first()).toContainText(/\d{1,2}:\d{2}/, { timeout: 5_000 })
    })
  })

  test('el toggle Listo emite la marca al chat de la mesa', async ({ page }) => {
    await withFakeServer(chatStagingScenario, async () => {
      await login(page, 'e2e')
      await createTable(page, TABLE_NAME)
      await expect(page.getByTestId('staging-player-actions')).toBeVisible({ timeout: 15_000 })
      await expect(page.locator('.staging-chat-header')).toContainText(/Chat de la Mesa|Table Chat/i, { timeout: 10_000 })

      await page.getByTestId('staging-toggle-ready').click()
      await expect(page.locator('.staging-chat-body .chat-list')).toContainText(
        /aún no está listo|not ready yet|preparándose/i,
        { timeout: 5_000 },
      )
    })
  })
})
