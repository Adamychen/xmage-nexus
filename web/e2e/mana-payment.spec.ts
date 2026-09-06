import { test, expect } from './fixtures'
import { fakeOnly } from './support/fake-mode'
import { startGame } from './support/start-game'
import { withFakeServer } from './support/fake-backend'
import { manaPaymentScenario, MANA_ACTIONS, MANA_TYPES, MANA_PREFS } from '../fixtures/scenarios/manaPayment'
import { TABLE } from '../fixtures/table-names'
import { DECK } from '../fixtures/deck-names'
fakeOnly()

async function openMenu(page: import('@playwright/test').Page) {
  await page.locator('[data-testid="game-menu-btn"]').click()
  const menu = page.locator('[data-testid="game-menu"]')
  await expect(menu).toBeVisible()
  return menu
}

test.describe('Mana payment prefs', { tag: '@manapayment' }, () => {
  test('syncs prefs on game start and toggles send server actions', async ({ page }) => {
    MANA_ACTIONS.length = 0
    await withFakeServer(manaPaymentScenario, async () => {
      const { pageErrors } = await startGame(page, {
        prefix: 'mp',
        tableName: TABLE.manaPayment,
        deck: DECK.advanced,
        skipAsks: true,
      })
      expect(pageErrors).toEqual([])

      await expect.poll(() => MANA_ACTIONS.length, { timeout: 5000 }).toBeGreaterThanOrEqual(3)
      expect(MANA_ACTIONS).toContain('MANA_AUTO_PAYMENT_ON')
      expect(MANA_ACTIONS).toContain('MANA_AUTO_PAYMENT_RESTRICTED_ON')
      expect(MANA_ACTIONS).toContain('USE_FIRST_MANA_ABILITY_OFF')

      const menu = await openMenu(page)
      await expect(menu.locator('[data-testid="game-menu-mana-label"]')).toBeVisible()
      const auto = menu.locator('[data-testid="game-menu-mana-auto"] input')
      await expect(auto).toBeChecked()
      const before = MANA_ACTIONS.length
      await auto.uncheck()
      await expect.poll(() => MANA_ACTIONS.length, { timeout: 5000 }).toBeGreaterThan(before)
      expect(MANA_ACTIONS.slice(before)).toContain('MANA_AUTO_PAYMENT_OFF')

      const restricted = menu.locator('[data-testid="game-menu-mana-restricted"] input')
      await expect(restricted).toBeChecked()
      const before2 = MANA_ACTIONS.length
      await restricted.uncheck()
      await expect.poll(() => MANA_ACTIONS.length, { timeout: 5000 }).toBeGreaterThan(before2)
      expect(MANA_ACTIONS.slice(before2)).toContain('MANA_AUTO_PAYMENT_RESTRICTED_OFF')
    })
  })

  test('pool pips pay mana manually via sendPlayerManaType', async ({ page }) => {
    MANA_TYPES.length = 0
    await withFakeServer(manaPaymentScenario, async () => {
      const { pageErrors } = await startGame(page, {
        prefix: 'mp',
        tableName: TABLE.manaPayment,
        deck: DECK.advanced,
        skipAsks: true,
      })
      expect(pageErrors).toEqual([])

      await page.locator('.resource-bar.my .resource-mana').click()
      await page.locator('[data-testid="mana-pay-R"]').click()
      await expect.poll(() => MANA_TYPES.length, { timeout: 5000 }).toBeGreaterThan(0)
      expect(MANA_TYPES[0]).toEqual({ playerId: 'human-1', manaType: 'RED' })
    })
  })

  test('confirm checkbox syncs the server flag and pass goes straight through', async ({ page }) => {
    MANA_PREFS.length = 0
    await withFakeServer(manaPaymentScenario, async () => {
      const { pageErrors } = await startGame(page, {
        prefix: 'mp',
        tableName: TABLE.manaPayment,
        deck: DECK.advanced,
        skipAsks: true,
      })
      expect(pageErrors).toEqual([])

      await expect.poll(() => MANA_PREFS.length, { timeout: 5000 }).toBeGreaterThan(0)
      expect(MANA_PREFS[0]).toBe(true)

      await page.locator('.big-action-btn.interactive').click()
      await page.waitForTimeout(800)
      await expect(page.locator('.mana-confirm-dialog')).toHaveCount(0)

      const menu = await openMenu(page)
      const confirmPref = menu.locator('[data-testid="game-menu-mana-confirm"] input')
      await expect(confirmPref).toBeChecked()
      await confirmPref.uncheck()
      await expect.poll(() => MANA_PREFS.length, { timeout: 5000 }).toBeGreaterThan(1)
      expect(MANA_PREFS[MANA_PREFS.length - 1]).toBe(false)
      await page.locator('.game-menu-overlay').click()
      await expect(menu).toBeHidden()
    })
  })
})
