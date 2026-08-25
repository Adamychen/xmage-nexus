import { test, expect } from './fixtures'
import { startGame } from './support/start-game'
import { withFakeServer } from './support/fake-backend'
import { mechanicsScenario } from '../fixtures/scenarios/mechanics'
import { TABLE } from '../fixtures/table-names'
import { DECK } from '../fixtures/deck-names'

test.describe('Keyword badges & hover', { tag: '@keywords' }, () => {
  test('renders keyword badges on card and hover shows keyword boxes', async ({ page }) => {
    await withFakeServer(mechanicsScenario, async () => {
      const { pageErrors } = await startGame(page, {
        prefix: 'kw',
        tableName: TABLE.mechanics,
        deck: DECK.advanced,
      })
      expect(pageErrors).toEqual([])

      const beast = page.locator('[data-card-name="Keyword Beast"]').first()
      await expect(beast).toBeVisible()
      const badges = beast.locator('.keyword-badges .keyword-badge')
      await expect(badges.first()).toBeVisible()
      expect(await badges.count()).toBeGreaterThanOrEqual(2)

      const goadIcon = beast.locator('.card-icon.restriction')
      await expect(goadIcon).toBeVisible()

      await beast.hover()
      const kwBox = page.locator('.floating-card-keywords')
      await expect(kwBox).toBeVisible({ timeout: 3000 })
      await expect(kwBox).toContainText('Volar')
      await expect(kwBox).toContainText('Toque mortal')
    })
  })
})
