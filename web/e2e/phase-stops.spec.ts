import { test, expect } from './fixtures'
import { fakeOnly } from './support/fake-mode'
import { withFakeServer } from './support/fake-backend'
import { login, startGame } from './support/start-game'
import { makeBaseScenario } from '../fixtures/fake'
import { playerGameView } from '../src/__fixtures__/gameViews'
import { manaPaymentScenario, PHASE_PREFS } from '../fixtures/scenarios/manaPayment'
import { TABLE } from '../fixtures/table-names'
import { DECK } from '../fixtures/deck-names'

fakeOnly()

function lobbyScenario() {
  return makeBaseScenario({
    tableId: 'table-ps-room',
    tableName: 'phase-stops-room',
    gameId: 'game-ps-room',
    gameView: playerGameView,
  })
}

test.describe('Phase stops', { tag: '@phasestops' }, () => {
  test('lobby defaults persist across sessions', async ({ page }) => {
    await withFakeServer(lobbyScenario, async () => {
      await login(page, 'ps-lobby')
      await page.getByTestId('open-settings').click()
      await page.getByTestId('settings-nav-gameplay').click()
      const block = page.getByTestId('settings-phase-stops')
      await expect(block).toBeVisible()
      await expect(block.locator('.phase-stop-btn')).toHaveCount(14)
      const main1 = block.getByTestId('settings-stop-your-main1')
      await expect(main1).toHaveClass(/active/)
      await main1.click()
      await expect(main1).not.toHaveClass(/active/)
      const stored = await page.evaluate(() => window.localStorage.getItem('mage-web-phase-stops'))
      expect(JSON.parse(stored ?? '{}').yourTurn.main1).toBe(false)

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
        await login(page, 'ps-lobby')
      }
      await page.getByTestId('open-settings').click()
      await page.getByTestId('settings-nav-gameplay').click()
      await expect(page.getByTestId('settings-stop-your-main1')).not.toHaveClass(/active/)
      await expect(page.getByTestId('settings-stop-opp-main1')).toHaveClass(/active/)
    })
  })

  test('game seeds from lobby defaults and in-game edits stay in-session', async ({ page }) => {
    PHASE_PREFS.length = 0
    await page.addInitScript(() => {
      window.localStorage.setItem(
        'mage-web-phase-stops',
        JSON.stringify({ yourTurn: { main1: false }, opponentTurn: {} }),
      )
    })
    await withFakeServer(manaPaymentScenario, async () => {
      const { pageErrors } = await startGame(page, {
        prefix: 'ps',
        tableName: TABLE.manaPayment,
        deck: DECK.advanced,
        skipAsks: true,
      })
      expect(pageErrors).toEqual([])

      await expect.poll(() => PHASE_PREFS.length, { timeout: 5000 }).toBeGreaterThan(0)
      const seeded = PHASE_PREFS[0] as { yourTurn: Record<string, boolean>; opponentTurn: Record<string, boolean> }
      expect(seeded.yourTurn.main1).toBe(false)
      expect(seeded.yourTurn.upkeep).toBe(true)
      expect(seeded.opponentTurn.main1).toBe(true)

      await page.locator('[data-testid="game-menu-btn"]').click()
      await expect(page.locator('[data-testid="game-menu-settings"]')).toBeVisible()
      await page.locator('.game-menu-overlay').click()
      await expect(page.locator('[data-testid="game-menu"]')).toHaveCount(0)
      const m1 = page.getByTestId('phase-bar-step-PRECOMBAT_MAIN')
      await expect(m1).toBeVisible()
      await expect(m1.locator('.stop-dot-you')).toHaveCount(0)
      const before = PHASE_PREFS.length
      await m1.click()
      await expect(m1.locator('.stop-dot-you')).toHaveCount(1)
      await expect.poll(() => PHASE_PREFS.length, { timeout: 5000 }).toBeGreaterThan(before)
      const pushed = PHASE_PREFS[PHASE_PREFS.length - 1] as { yourTurn: Record<string, boolean> }
      expect(pushed.yourTurn.main1).toBe(true)

      const stored = await page.evaluate(() => window.localStorage.getItem('mage-web-phase-stops'))
      expect(JSON.parse(stored ?? '{}').yourTurn.main1).toBe(false)
    })
  })
})
