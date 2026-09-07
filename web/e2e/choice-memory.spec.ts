import { test, expect } from './fixtures'
import { fakeOnly } from './support/fake-mode'
import { startGame } from './support/start-game'
import { withFakeServer } from './support/fake-backend'
import { choiceMemoryScenario } from '../fixtures/scenarios/choiceMemory'
import { TABLE } from '../fixtures/table-names'
import { DECK } from '../fixtures/deck-names'
import { parseSent, sentOf } from './support/frames'
fakeOnly()

test.describe('Choice memory (U14 P14-2/P14-3/P14-4)', { tag: '@feedback' }, () => {
  test('server sortData orders options and hintData shows as tooltip', async ({ page }) => {
    await withFakeServer(choiceMemoryScenario, async () => {
      const { pageErrors } = await startGame(page, {
        prefix: 'choicemem',
        tableName: TABLE.choiceMemory,
        deck: DECK.advanced,
        skipAsks: true,
      })
      expect(pageErrors).toEqual([])
      const dialog = page.locator('.feedback-dialog')
      await expect(dialog).toBeVisible()
      const labels = await dialog.locator('.feedback-choice-card .choice-text').allTextContents()
      expect(labels.map((s) => s.trim())).toEqual(['Gamma probe', 'Alpha strike', 'Beta defense'])
      await expect(dialog.getByRole('button', { name: /Alpha strike/ })).toHaveAttribute('title', 'Fast and early')
      await expect(dialog.getByRole('checkbox', { name: /Recordar|Remember/ })).toBeVisible()
      expect(pageErrors).toEqual([])
    })
  })

  test('remembered choice auto-answers the second identical prompt', async ({ page }) => {
    await withFakeServer(choiceMemoryScenario, async () => {
      const { pageErrors } = await startGame(page, {
        prefix: 'choicemem2',
        tableName: TABLE.choiceMemory,
        deck: DECK.advanced,
        skipAsks: true,
      })
      expect(pageErrors).toEqual([])
      const dialog = page.locator('.feedback-dialog')
      await expect(dialog).toBeVisible()
      await dialog.getByRole('checkbox', { name: /Recordar|Remember/ }).check()
      await dialog.getByRole('button', { name: /Beta defense/ }).click()
      await expect
        .poll(() => parseSent(sentOf(page)).filter((s) => s.action === 'sendPlayerString' && s.args?.value === 't-b').length, { timeout: 10_000 })
        .toBe(2)
      await expect(dialog).toBeHidden({ timeout: 5_000 })
      expect(pageErrors).toEqual([])
    })
  })
})
