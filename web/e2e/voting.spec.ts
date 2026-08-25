import { test, expect } from './fixtures'
import { startGame } from './support/start-game'
import { withFakeServer } from './support/fake-backend'
import { votingScenario } from '../fixtures/scenarios/voting'
import { TABLE } from '../fixtures/table-names'
import { DECK } from '../fixtures/deck-names'

test.describe('Voting Dialog', { tag: '@voting' }, () => {
  test('renders dedicated voting dialog with two choices and sends vote', async ({ page }) => {
    await withFakeServer(votingScenario, async () => {
      const { pageErrors } = await startGame(page, {
        prefix: 'voting',
        tableName: TABLE.voting,
        deck: DECK.advanced,
        skipAsks: true,
      })
      expect(pageErrors).toEqual([])
      const dialog = page.locator('.voting-dialog')
      await expect(dialog).toBeVisible()
      await expect(dialog).toContainText('VOTACIÓN')
      await expect(dialog).toContainText('Strength')
      await expect(dialog).toContainText('Numbers')
      await expect(dialog.locator('.voting-btn')).toHaveCount(2)
      await dialog.locator('.voting-btn').first().click()
      await expect(dialog).toBeHidden({ timeout: 5000 })
    })
  })
})
