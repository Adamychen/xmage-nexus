import { test, expect } from '@playwright/test'
import { fakeOnly } from './support/fake-mode'
import { withFakeServer } from './support/fake-backend'
import { login, createTable } from './support/start-game'
import { makeBaseScenario } from '../fixtures/fake'
import { playerGameView } from '../src/__fixtures__/gameViews'

fakeOnly()

const TABLE_ID = 'table-stg-1'
const TABLE_NAME = 'staging-e2e'

function stagingScenario() {
  return makeBaseScenario({
    tableId: TABLE_ID,
    tableName: TABLE_NAME,
    gameId: 'game-stg-1',
    gameView: playerGameView,
  })
}

async function createAndWaitStaging(page: import('@playwright/test').Page) {
  await login(page, 'e2e')
  await createTable(page, TABLE_NAME)
  await expect(page.getByTestId('staging-player-actions')).toBeVisible({ timeout: 15_000 })
}

test.describe('Player staging room (JOINED_TABLE)', () => {
  test('al crear la mesa salta a la sala de espera y desde ella arranca la partida', async ({ page }) => {
    await withFakeServer(stagingScenario, async () => {
      await createAndWaitStaging(page)
      await expect(page.getByTestId('staging-start')).toBeVisible()
      await expect(page.getByTestId('staging-remove')).toBeVisible()
      await expect(page.getByTestId('staging-leave')).toBeVisible()
      await page.getByTestId('staging-start').click()
      await expect(page.getByTestId('game-status')).toBeVisible({ timeout: 15_000 })
    })
  })

  test('volver al lobby conserva el asiento y permite regresar con "Ir a la mesa"', async ({ page }) => {
    await withFakeServer(stagingScenario, async () => {
      await createAndWaitStaging(page)
      await page.getByTestId('staging-back').click()
      await expect(page.getByTestId('staging-player-actions')).toBeHidden()
      await expect(page.getByTestId('return-to-table').first()).toBeVisible()
      await page.getByTestId('return-to-table').first().click()
      await expect(page.getByTestId('staging-player-actions')).toBeVisible({ timeout: 15_000 })
    })
  })

  test('el dueño puede eliminar la mesa desde la sala de espera', async ({ page }) => {
    await withFakeServer(stagingScenario, async () => {
      await createAndWaitStaging(page)
      await page.getByTestId('staging-remove').click()
      await expect(page.getByTestId('staging-player-actions')).toBeHidden({ timeout: 15_000 })
      await expect(page.getByRole('heading', { name: /Lobby|XMage Nexus/i })).toBeVisible()
    })
  })

  test('permite alternar entre listo/no listo y abrir selector de cambiar baraja', async ({ page }) => {
    await withFakeServer(stagingScenario, async () => {
      await createAndWaitStaging(page)
      const toggleBtn = page.getByTestId('staging-toggle-ready')
      await expect(toggleBtn).toBeVisible()
      await expect(toggleBtn).toContainText(/No estoy listo|Not ready/i)

      await toggleBtn.click()
      await expect(toggleBtn).toContainText(/Estoy listo|ready/i)
      await expect(page.getByTestId('staging-start')).toBeDisabled()

      await toggleBtn.click()
      await expect(toggleBtn).toContainText(/No estoy listo|Not ready/i)
      await expect(page.getByTestId('staging-start')).toBeEnabled()

      await page.getByTestId('staging-change-deck').click()
      await expect(page.getByTestId('join-table-dialog')).toBeVisible()
      await expect(page.getByTestId('join-target-pill')).toContainText(/CAMBIAR BARAJA|CHANGE TABLE DECK/i)
      await page.getByTestId('join-cancel-btn').click()
      await expect(page.getByTestId('join-table-dialog')).toBeHidden()
    })
  })
})