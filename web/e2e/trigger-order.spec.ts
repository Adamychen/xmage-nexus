import { test, expect } from './fixtures'
import { fakeOnly } from './support/fake-mode'
import { startGame } from './support/start-game'
import { withFakeServer } from './support/fake-backend'
import { triggerOrderScenario, TRIGGER_ACTIONS, TRIGGER_PICKS } from '../fixtures/scenarios/triggerOrder'
import { TABLE } from '../fixtures/table-names'
import { DECK } from '../fixtures/deck-names'
fakeOnly()

const WARDEN = '11111111-1111-1111-1111-111111111111'
const ARTIST = '22222222-2222-2222-2222-222222222222'

test.describe('Trigger order dialog', { tag: '@triggers' }, () => {
  test('renders one row per trigger and picks them one by one', async ({ page }) => {
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

      await dialog.locator(`[data-testid="trigger-row-${WARDEN}"] .ui-btn--primary`).click()
      // The server re-asks with the remaining ability.
      await expect(dialog.locator('.trigger-row')).toHaveCount(1)
      await expect(dialog).toContainText('Blood Artist')
      await dialog.locator(`[data-testid="trigger-row-${ARTIST}"] .ui-btn--primary`).click()
      await expect(dialog).toBeHidden({ timeout: 5000 })
      expect(TRIGGER_PICKS).toEqual([WARDEN, ARTIST])
    })
  })

  test('apply chains the whole order (bottom of the stack first)', async ({ page }) => {
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
      await dialog.locator('.trigger-apply').click()
      // The chain answers the second prompt on its own; the dialog only hides
      // after the server's final prompt is gone.
      await expect.poll(() => TRIGGER_PICKS.length, { timeout: 5000 }).toBe(2)
      await expect(dialog).toBeHidden({ timeout: 5000 })
      // Display order is resolution order: the last one resolves first, so it is
      // the first UUID the server receives.
      expect(TRIGGER_PICKS).toEqual([ARTIST, WARDEN])
    })
  })

  test('remembering "always first" does not place the trigger', async ({ page }) => {
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
      const row = dialog.locator(`[data-testid="trigger-row-${WARDEN}"]`)
      await row.locator('.trigger-actions button').nth(1).click()
      await expect(row.locator('.trigger-saved')).toBeVisible()
      await expect(dialog).toBeVisible()
      expect(TRIGGER_PICKS).toEqual([])
      expect(TRIGGER_ACTIONS).toContain('TRIGGER_AUTO_ORDER_ABILITY_FIRST')
    })
  })
})
