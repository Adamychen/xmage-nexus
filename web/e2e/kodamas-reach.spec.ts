import { test, expect } from './fixtures'
import { fakeOnly } from './support/fake-mode'
import { quickStartGame } from './support/start-game'
import { withFakeServer } from './support/fake-backend'
import { BATTLEFIELD_PICK, KODAMA_ANSWERS, KODAMA_LANDS, kodamasReachScenario } from '../fixtures/scenarios/kodamasReach'
fakeOnly()

const [FOREST, , MOUNTAIN] = KODAMA_LANDS.map((c) => c.id as string)
const SEARCH = /Select basic land cards/

function cell(page: import('@playwright/test').Page, id: string) {
  return page.locator(`.card-grid-dialog [data-arena-card="${id}"] .card-grid-cell`)
}

test.describe("Kodama's Reach", { tag: '@prompts' }, () => {
  test('PRM-6, BRD-66: two lands are picked on the grid and confirmed once, and their reveal is a corner notice', async ({ page }) => {
    await withFakeServer(kodamasReachScenario, async () => {
      const { pageErrors } = await quickStartGame(page, { prefix: 'kod', skipAsks: true })
      const grid = page.getByTestId('card-grid-prompt')
      await expect(grid).toBeVisible()

      await cell(page, FOREST).click({ position: { x: 30, y: 120 } })
      await cell(page, MOUNTAIN).click({ position: { x: 30, y: 120 } })
      await expect(page.getByTestId('card-grid-progress')).toHaveText(/2/)
      await page.waitForTimeout(300)
      expect(KODAMA_ANSWERS, 'nothing goes to the server before Confirm').toEqual([])

      await grid.locator('.arena-card-grid-done').first().click()
      await expect.poll(() => KODAMA_ANSWERS.length, { timeout: 5000 }).toBe(2)
      expect(KODAMA_ANSWERS.map((a) => a.value)).toEqual([FOREST, MOUNTAIN])
      expect(KODAMA_ANSWERS.every((a) => SEARCH.test(a.message)), 'each card answers its own re-ask').toBe(true)

      await expect(page.locator('.card-grid-dialog')).toContainText(BATTLEFIELD_PICK)
      await cell(page, MOUNTAIN).click({ position: { x: 30, y: 120 } })
      await expect.poll(() => KODAMA_ANSWERS.length).toBe(3)
      expect(KODAMA_ANSWERS[2]).toEqual({ message: BATTLEFIELD_PICK, value: MOUNTAIN })

      const notice = page.getByTestId('reveal-toast')
      await expect(notice).toBeVisible()
      await expect(notice).toContainText("Kodama's Reach")
      await expect(page.locator('.pile-overlay'), 'no viewer latched over the board').toHaveCount(0)
      expect(pageErrors).toEqual([])
    })
  })

  test('PRM-6: one land of two answers its card, then Done for both of the search loops', async ({ page }) => {
    await withFakeServer(kodamasReachScenario, async () => {
      const { pageErrors } = await quickStartGame(page, { prefix: 'kd1', skipAsks: true })
      const grid = page.getByTestId('card-grid-prompt')
      await expect(grid).toBeVisible()
      await cell(page, FOREST).click({ position: { x: 30, y: 120 } })
      await grid.locator('.arena-card-grid-done').first().click()
      await expect.poll(() => KODAMA_ANSWERS.length, { timeout: 5000 }).toBe(3)
      expect(KODAMA_ANSWERS.map((a) => a.value)).toEqual([FOREST, false, false])
      await expect(grid).toBeHidden({ timeout: 5000 })
      await expect(page.locator('.card-grid-dialog')).toHaveCount(0)
      expect(pageErrors).toEqual([])
    })
  })
})
