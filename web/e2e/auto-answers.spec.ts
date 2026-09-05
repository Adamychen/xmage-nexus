import { test, expect } from './fixtures'
import { startGame } from './support/start-game'
import { withFakeServer } from './support/fake-backend'
import { autoAnswersScenario } from '../fixtures/scenarios/autoAnswers'
import { TABLE } from '../fixtures/table-names'
import { DECK } from '../fixtures/deck-names'

test.describe('Auto-answers', { tag: '@autoanswers' }, () => {
  test('remember checkbox auto-answers the repeat and menu forgets it', async ({ page }) => {
    await withFakeServer(autoAnswersScenario, async () => {
      const { pageErrors } = await startGame(page, {
        prefix: 'aa',
        tableName: TABLE.autoAnswers,
        deck: DECK.advanced,
        skipAsks: true,
      })
      expect(pageErrors).toEqual([])

      const dialog = page.locator('.feedback-dialog')
      await expect(dialog).toBeVisible()
      await expect(dialog).toContainText('Would you like to draw a card?')
      const remember = dialog.locator('.feedback-remember-answer input')
      await expect(remember).toBeVisible()
      await remember.check()
      await dialog.locator('.feedback-choice-card').first().click()

      await expect(dialog).toBeHidden({ timeout: 5000 })
      await page.waitForTimeout(1500)
      await expect(dialog).toBeHidden()

      await page.locator('[data-testid="game-menu-btn"]').click()
      const menu = page.locator('[data-testid="game-menu"]')
      await expect(menu).toBeVisible()
      await expect(menu.locator('[data-testid="game-menu-auto-answers-label"]')).toContainText('(1)')
      const row = menu.locator('[class*="game-menu-auto-row"]')
      await expect(row).toContainText('would you like to draw a card?')
      await expect(row).toContainText('Sí')
      await menu.locator('[class*="game-menu-auto-delete"]').click()
      await expect(menu.locator('[data-testid="game-menu-auto-answers-label"]')).toContainText('(0)')
    })
  })
})
