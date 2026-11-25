import { test, expect } from './fixtures'
import { fakeOnly } from './support/fake-mode'
import { withFakeServer } from './support/fake-backend'
import { quickStartGame } from './support/start-game'
import { RELEASE_STACK_TARGET, stackTargetScenario } from '../fixtures/scenarios/stackTarget'
fakeOnly()

test.describe('Targeting a spell on the stack', () => {
  test('TGT-7: a stack spell can be chosen as a target, and asking for one brings the stack back @fullflow @stack-target', async ({ page }) => {
    await withFakeServer(stackTargetScenario, async () => {
      const { pageErrors, helper } = await quickStartGame(page, { prefix: 'st' })

      const zone = page.locator('.stack-zone')
      const grip = page.locator('[data-testid="stack-push"]')
      const bolt = page.locator('.stack-card[data-card-id="stack-bolt"]')
      const growth = page.locator('.stack-card[data-card-id="stack-growth"]')

      await expect(bolt, 'the stack is on the board, with no tab to open').toBeVisible({ timeout: 30_000 })
      await expect(bolt).not.toHaveClass(/targetable/)

      // Clicking Giant Growth is what arms the prompt in the scenario.
      await growth.click()
      await grip.click()
      await expect(zone, 'the grip pushes the stack aside').toHaveClass(/is-pushed/)

      expect(await helper.raw(RELEASE_STACK_TARGET, {}), 'the scenario sends the armed target prompt').toBe(true)
      await expect(zone, 'a target prompt on a stack object brings the stack back').not.toHaveClass(/is-pushed/, { timeout: 10_000 })
      await expect(bolt).toHaveClass(/targetable/)
      await expect(growth, 'only eligible objects are marked').not.toHaveClass(/targetable/)

      await grip.click()
      await grip.click()
      await expect(bolt, 'pushing it aside and back keeps the object selectable').toHaveClass(/targetable/)

      // The Bolt is behind the front card, so what is on screen is the strip down its left edge:
      // that is where the click has to land, the same place a player would aim at.
      const edge = (await bolt.boundingBox())!
      await page.mouse.click(edge.x + 6, edge.y + edge.height / 2)
      // PRM-18: what the server answers is read across the board or in the bar, depending on the
      // prompt; what this test is about is that the id reached it at all.
      await expect(page.getByText('clicked:stack-bolt').first(), 'the click reaches the server with the stack object id')
        .toBeVisible({ timeout: 10_000 })

      expect(pageErrors).toEqual([])
    })
  })
})
