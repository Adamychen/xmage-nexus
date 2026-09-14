import { test, expect } from '@playwright/test'
import { fakeOnly } from './support/fake-mode'
import { withFakeServer } from './support/fake-backend'
import { login } from './support/start-game'
import { makeBaseScenario } from '../fixtures/fake'

fakeOnly()

const TABLE_ID = 'table-join-err'
const TABLE_NAME = 'join-err-e2e'

function failingScenario(failActions: Record<string, { error: string; errorCode?: string }>) {
  return () =>
    makeBaseScenario({
      tableId: TABLE_ID,
      tableName: TABLE_NAME,
      gameId: 'game-join-err',
      seats: [
        { playerName: 'e2e', seatIndex: 0, playerType: 'HUMAN' },
        { playerName: '', seatIndex: 1, playerType: 'HUMAN' },
      ],
      onRequest: (conn, action, _args, requestId) => {
        const failure = failActions[action]
        if (!failure) return false
        conn.fail(requestId, action, failure.error, failure.errorCode)
        return true
      },
    })
}

test.describe('Errores de unión a mesa', () => {
  test('el fallo al unirse se muestra dentro del diálogo, traducido y con cierre', async ({ page }) => {
    await withFakeServer(
      failingScenario({ joinTable: { error: 'Join Table Wrong password.', errorCode: 'PASSWORD' } }),
      async () => {
        await login(page, 'e2e')

        await page.getByRole('button', { name: /Unirse \(Humano\)/ }).click()
        await expect(page.getByTestId('join-table-dialog')).toBeVisible()

        await page.getByRole('button', { name: /Unirse con/ }).click()

        const banner = page.getByTestId('join-error')
        await expect(banner).toBeVisible()
        await expect(banner).toContainText('La contraseña de la mesa es incorrecta')
        await expect(page.getByTestId('lobby-error')).toHaveCount(0)

        await banner.getByRole('button', { name: 'Cerrar' }).click()
        await expect(page.getByTestId('join-error')).toHaveCount(0)
        await expect(page.getByTestId('join-table-dialog')).toBeVisible()
      },
    )
  })

  test('el error del lobby (Espectar) es descartable', async ({ page }) => {
    await withFakeServer(
      failingScenario({ watchTable: { error: 'Table not found' } }),
      async () => {
        await login(page, 'e2e')

        await page.getByRole('button', { name: 'Espectar' }).click()

        const banner = page.getByTestId('lobby-error')
        await expect(banner).toBeVisible()
        await expect(banner).toContainText('La mesa no existe o ya ha sido cerrada')

        await banner.getByRole('button', { name: 'Cerrar' }).click()
        await expect(page.getByTestId('lobby-error')).toHaveCount(0)
      },
    )
  })
})
