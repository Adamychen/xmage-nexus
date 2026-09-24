import { TABLE } from '../fixtures/table-names'
import { test, expect } from './fixtures'
import { fakeOnly } from './support/fake-mode'
import { withFakeServer } from './support/fake-backend'
import { startGame } from './support/start-game'
import { stackTargetScenario } from '../fixtures/scenarios/stackTarget'
fakeOnly()

test.describe('Targeting a spell on the stack', () => {
  test('a stack spell can be chosen as a target, even after closing the drawer or switching tabs @fullflow @stack-target', async ({ page }) => {
    await withFakeServer(stackTargetScenario, async () => {
      const { pageErrors } = await startGame(page, { prefix: 'st', tableName: TABLE.stackTarget })

      const drawer = page.locator('[data-testid="game-drawer"]')
      const stackTab = page.locator('[data-testid="drawer-tab-stack"]')
      const bolt = page.locator('.stack-tl-entry[data-card-id="stack-bolt"]')
      const growth = page.locator('.stack-tl-entry[data-card-id="stack-growth"]')

      await expect(drawer, 'the stack drawer opens by itself when the stack fills').toHaveAttribute('data-tab', 'stack', { timeout: 30_000 })
      await expect(bolt).toBeVisible()
      await expect(bolt).not.toHaveClass(/targetable/)

      await growth.click()
      await page.locator('[data-testid="drawer-tab-log"]').click()
      await expect(drawer).toHaveAttribute('data-tab', 'log')
      await expect(drawer, 'a target prompt on a stack object brings the stack back').toHaveAttribute('data-tab', 'stack', { timeout: 10_000 })
      await expect(bolt).toHaveClass(/targetable/)
      await expect(growth, 'only eligible entries are marked').not.toHaveClass(/targetable/)

      await stackTab.click()
      await expect(drawer).toHaveCount(0)
      await stackTab.click()
      await expect(drawer).toHaveAttribute('data-tab', 'stack')
      await expect(bolt, 'closing and reopening keeps the entry selectable').toHaveClass(/targetable/)

      await bolt.click()
      await expect(page.locator('.feedback-dialog'), 'the click reaches the server with the stack object id')
        .toContainText('clicked:stack-bolt', { timeout: 10_000 })

      expect(pageErrors).toEqual([])
    })
  })
})
