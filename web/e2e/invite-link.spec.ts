import { test, expect } from '@playwright/test'
import { fakeOnly } from './support/fake-mode'
import { withFakeServer } from './support/fake-backend'
import { login } from './support/start-game'
import { makeBaseScenario } from '../fixtures/fake'
import { playerGameView } from '../src/__fixtures__/gameViews'

fakeOnly()

const TABLE_ID = 'table-invite-1'
const TABLE_NAME = 'invite-e2e'

function inviteScenario() {
  return makeBaseScenario({
    tableId: TABLE_ID,
    tableName: TABLE_NAME,
    gameId: 'game-invite-1',
    gameView: playerGameView,
    seats: [
      { playerName: 'host', seatIndex: 0, playerType: 'HUMAN' },
      { playerName: '', seatIndex: 1, playerType: 'HUMAN' },
    ],
  })
}

test.describe('Invite deep links (#join= / #watch=)', () => {
  test('watch link especta la mesa y muestra botones de invitación', async ({ page }) => {
    await withFakeServer(inviteScenario, async () => {
      await login(page, 'e2e')
      await page.evaluate((id) => {
        window.location.hash = `#watch=${id}`
      }, TABLE_ID)
      await expect(page.getByTestId('staging-back')).toBeVisible({ timeout: 15_000 })
      await expect(page.getByTestId('invite-copy-join')).toBeVisible()
      await expect(page.getByTestId('invite-copy-watch')).toBeVisible()
    })
  })

  test('join link abre el diálogo de mazo', async ({ page }) => {
    await withFakeServer(inviteScenario, async () => {
      await login(page, 'e2e')
      await page.evaluate((id) => {
        window.location.hash = `#join=${id}`
      }, TABLE_ID)
      await expect(page.getByRole('button', { name: /Unirse con/i })).toBeVisible({ timeout: 15_000 })
    })
  })
})
