import { test, expect } from './fixtures'
import { fakeOnly } from './support/fake-mode'
import { startGame } from './support/start-game'
import { withFakeServer } from './support/fake-backend'
import { pileVisualScenario } from '../fixtures/scenarios/pileVisual'
import { TABLE } from '../fixtures/table-names'
import { DECK } from '../fixtures/deck-names'
import { parseSent, sentOf } from './support/frames'
fakeOnly()

test.describe('PileDialog visual (U14 PickPile)', { tag: '@feedback' }, () => {
  test('renders two card piles side by side and choosing sends boolean', async ({ page }) => {
    await withFakeServer(pileVisualScenario, async () => {
      const { pageErrors } = await startGame(page, {
        prefix: 'pilevis',
        tableName: TABLE.pileVisual,
        deck: DECK.advanced,
        skipAsks: true,
      })
      expect(pageErrors).toEqual([])
      const pile1 = page.getByTestId('pile-column-1')
      const pile2 = page.getByTestId('pile-column-2')
      await expect(pile1).toBeVisible()
      await expect(pile2).toBeVisible()
      await expect(pile1).toContainText('Grizzly Bears')
      await expect(pile2).toContainText('Lightning Bolt')
      await expect(pile2).toContainText('Shock')
      await pile1.click()
      await expect
        .poll(() => parseSent(sentOf(page)).some((s) => s.action === 'sendPlayerBoolean' && s.args?.value === true), { timeout: 10_000 })
        .toBeTruthy()
      expect(pageErrors).toEqual([])
    })
  })
})
