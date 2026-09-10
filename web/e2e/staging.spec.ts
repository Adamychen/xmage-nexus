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

      await page.getByTestId('staging-change-deck').click()
      await expect(page.getByTestId('join-table-dialog')).toBeVisible()
      await expect(page.getByTestId('join-table-dialog').locator('.dlg-kicker')).toContainText(/CAMBIAR BARAJA|CHANGE TABLE DECK/i)
      await page.getByTestId('join-cancel-btn').click()
      await expect(page.getByTestId('join-table-dialog')).toBeHidden()
    })
  })

  test('el dueño puede reordenar asientos con subir/bajar (swapSeats)', async ({ page }) => {
    await withFakeServer(stagingScenario, async () => {
      await createAndWaitStaging(page)
      const firstCard = page.locator('.staging-duel-roster .staging-player-card').first()
      await expect(firstCard).toContainText('e2e')

      await expect(page.getByTestId('staging-seat-up-0')).toBeDisabled()
      await page.getByTestId('staging-seat-down-0').click()
      await expect(firstCard).toContainText('sim')

      await page.getByTestId('staging-seat-up-1').click()
      await expect(firstCard).toContainText('e2e')
    })
  })

  test('empezar sin readys pide confirmación y arranca al aceptar', async ({ page }) => {
    await withFakeServer(stagingScenario, async () => {
      await createAndWaitStaging(page)
      await page.getByTestId('staging-toggle-ready').click()
      await expect(page.getByTestId('staging-toggle-ready')).toContainText(/Estoy listo|ready/i)

      await page.getByTestId('staging-start').click()
      await expect(page.getByTestId('confirm-modal')).toBeVisible({ timeout: 15_000 })
      await page.getByTestId('confirm-modal-ok').click()
      await expect(page.getByTestId('game-status')).toBeVisible({ timeout: 15_000 })
    })
  })

  test('empezar sin readys se cancela al rechazar la confirmación', async ({ page }) => {
    await withFakeServer(stagingScenario, async () => {
      await createAndWaitStaging(page)
      await page.getByTestId('staging-toggle-ready').click()

      await page.getByTestId('staging-start').click()
      await expect(page.getByTestId('confirm-modal')).toBeVisible({ timeout: 15_000 })
      await page.getByTestId('confirm-modal-cancel').click()
      await expect(page.getByTestId('staging-player-actions')).toBeVisible()
      await expect(page.getByTestId('game-status')).toBeHidden()
    })
  })

  test('la meta del asiento (badge + historial) no desborda la tarjeta del anillo', async ({ page }) => {
    const ringScenario = () =>
      makeBaseScenario({
        tableId: 'table-stg-ring',
        tableName: 'staging-ring-e2e',
        gameId: 'game-stg-ring',
        gameView: playerGameView,
        gameType: 'Commander Free For All',
        seats: [
          { playerName: 'e2e', seatIndex: 0, playerType: 'HUMAN', constructedRating: 800, history: '720 (I:15 T:8 Q:3)' },
          { playerName: 'sim-000002-340', seatIndex: 1, playerType: 'SIM', constructedRating: 800, history: '720 (I:15 T:8 Q:3)' },
        ],
      })
    await withFakeServer(ringScenario, async () => {
      await login(page, 'e2e')
      await createTable(page, 'staging-ring-e2e')
      await expect(page.locator('.staging-ring')).toBeVisible({ timeout: 15_000 })
      await expect(page.locator('.ring-seat .player-seat-meta').first()).toBeVisible()
      const overflowing = await page.evaluate(() => {
        const bad: string[] = []
        document.querySelectorAll('.ring-seat').forEach((card) => {
          const meta = card.querySelector('.player-seat-meta')
          if (meta && meta.scrollWidth > (card as HTMLElement).clientWidth + 1) {
            bad.push((card.textContent ?? '').slice(0, 40))
          }
        })
        return bad
      })
      expect(overflowing).toEqual([])
    })
  })

  test('unirse a torneo limitado sin password entra directo sin diálogo de mazo', async ({ page }) => {
    const tournamentScenario = () =>
      makeBaseScenario({
        tableId: 'table-tny-1',
        tableName: 'tourney-e2e',
        gameId: 'game-tny-1',
        gameView: playerGameView,
        gameType: 'Booster Draft',
        isTournament: true,
        seats: [
          { playerName: 'host', seatIndex: 0, playerType: 'HUMAN' },
          { playerName: '', seatIndex: 1, playerType: 'HUMAN' },
        ],
      })
    await withFakeServer(tournamentScenario, async () => {
      await login(page, 'e2e')
      await page.getByRole('button', { name: /Unirse \(Humano\)|Join \(Human\)/ }).click()
      await expect(page.getByTestId('join-table-dialog')).toBeHidden()
      await expect(page.getByTestId('staging-player-actions')).toBeVisible({ timeout: 15_000 })
    })
  })
})