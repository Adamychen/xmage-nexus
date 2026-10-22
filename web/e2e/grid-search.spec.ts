import { test, expect } from './fixtures'
import { fakeOnly } from './support/fake-mode'
import { quickStartGame } from './support/start-game'
import { withFakeServer } from './support/fake-backend'
import { gridSearchScenario } from '../fixtures/scenarios/gridSearch'
import { parseSent, sentOf } from './support/frames'
fakeOnly()

test.describe('Grid search (U14 P14-1/P14-6)', { tag: '@feedback' }, () => {
  test('PRM-10: filter narrows a 12-option grid and Enter sends the match', async ({ page }) => {
    await withFakeServer(gridSearchScenario, async () => {
      const { pageErrors } = await quickStartGame(page, {
        prefix: 'gridsearch',
        skipAsks: true,
      })
      expect(pageErrors).toEqual([])
      const dialog = page.locator('.feedback-dialog')
      await expect(dialog).toBeVisible()
      await expect(dialog.locator('.feedback-choice-card')).toHaveCount(12)
      const search = dialog.getByPlaceholder(/Filtrar|Filter/)
      await expect(search).toBeVisible()
      await search.fill('dragon')
      await expect(dialog.locator('.feedback-choice-card')).toHaveCount(1)
      await search.press('Enter')
      await expect
        .poll(() => parseSent(sentOf(page)).some((s) => s.action === 'sendPlayerUUID' && s.args?.value === 'mode-dragon'), { timeout: 10_000 })
        .toBeTruthy()
      expect(pageErrors).toEqual([])
    })
  })

  test('PRM-10: double-click chooses immediately in a single-choice grid', async ({ page }) => {
    await withFakeServer(gridSearchScenario, async () => {
      const { pageErrors } = await quickStartGame(page, {
        prefix: 'gridsearch2',
        skipAsks: true,
      })
      expect(pageErrors).toEqual([])
      const dialog = page.locator('.feedback-dialog')
      await expect(dialog).toBeVisible()
      await dialog.getByRole('button', { name: /Summon Ancient Dragon/ }).dblclick()
      await expect
        .poll(() => parseSent(sentOf(page)).some((s) => s.action === 'sendPlayerUUID' && s.args?.value === 'mode-dragon'), { timeout: 10_000 })
        .toBeTruthy()
      expect(pageErrors).toEqual([])
    })
  })
})
