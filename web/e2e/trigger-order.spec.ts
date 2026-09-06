import { test, expect } from './fixtures'
import { fakeOnly } from './support/fake-mode'
import { startGame } from './support/start-game'
import { withFakeServer } from './support/fake-backend'
import { triggerOrderScenario, TRIGGER_ACTIONS } from '../fixtures/scenarios/triggerOrder'
import { TABLE } from '../fixtures/table-names'
import { DECK } from '../fixtures/deck-names'
fakeOnly()

test.describe('Trigger order dialog', { tag: '@triggers' }, () => {
  test('renders one row per trigger and chooses with Elegir', async ({ page }) => {
    await withFakeServer(triggerOrderScenario, async () => {
      const { pageErrors } = await startGame(page, {
        prefix: 'trg',
        tableName: TABLE.triggerOrder,
        deck: DECK.advanced,
        skipAsks: true,
      })
      expect(pageErrors).toEqual([])
      const dialog = page.locator('.trigger-dialog')
      await expect(dialog).toBeVisible()
      await expect(dialog.locator('.trigger-row')).toHaveCount(2)
      await expect(dialog).toContainText('Soul Warden')
      await expect(dialog).toContainText('Blood Artist')
      await dialog.locator('[data-testid="trigger-row-11111111-1111-1111-1111-111111111111"] .trigger-btn.primary').click()
      await expect(dialog).toBeHidden({ timeout: 5000 })
    })
  })

  test('first remembers ability-first via TRIGGER_AUTO_ORDER action', async ({ page }) => {
    TRIGGER_ACTIONS.length = 0
    await withFakeServer(triggerOrderScenario, async () => {
      const { pageErrors } = await startGame(page, {
        prefix: 'trg',
        tableName: TABLE.triggerOrder,
        deck: DECK.advanced,
        skipAsks: true,
      })
      expect(pageErrors).toEqual([])
      const dialog = page.locator('.trigger-dialog')
      await expect(dialog).toBeVisible()
      const row = dialog.locator('[data-testid="trigger-row-11111111-1111-1111-1111-111111111111"]')
      await row.locator('.trigger-btn').nth(1).click()
      await expect(dialog).toBeHidden({ timeout: 5000 })
      expect(TRIGGER_ACTIONS).toContain('TRIGGER_AUTO_ORDER_ABILITY_FIRST')
    })
  })
})
