import { fakeOnly } from './support/fake-mode'
import { test, expect } from './fixtures'
import { crossZoneScenario } from '../fixtures/scenarios/crossZone'
import { quickStartGame } from './support/start-game'
import { withFakeServer } from './support/fake-backend'
import { waitCrossZonePlayable } from './support/game-screen'
fakeOnly()

test.describe('Cross-zone overlay layout', () => {
  for (const [name, width, height] of [['desktop', 1600, 900], ['phone', 390, 844]] as const) {
    test(`BRD-24: ten playable cards wrap into rows and never need a sideways scroll on a ${name} screen`, async ({ page }) => {
      await page.setViewportSize({ width, height })
      await withFakeServer(() => crossZoneScenario('graveyard-many'), async () => {
        const { pageErrors } = await quickStartGame(page, { prefix: `cz${name[0]}` })
        await waitCrossZonePlayable(page, 'Arc Trail', { timeoutMs: 30_000, minUntapped: 0 })
        await page.locator('.ray-stack').click()
        await expect(page.locator('.cross-zone-overlay')).toBeVisible({ timeout: 10_000 })
        await expect(page.locator('.cross-zone-entry')).toHaveCount(10)

        const layout = await page.evaluate(() => {
          const scroll = document.querySelector('.cross-zone-overlay .pile-overlay-scroll') as HTMLElement
          const tops = new Set(Array.from(document.querySelectorAll('.cross-zone-entry'))
            .map((e) => Math.round(e.getBoundingClientRect().top)))
          return { clientWidth: scroll.clientWidth, scrollWidth: scroll.scrollWidth, rows: tops.size }
        })
        expect(layout.scrollWidth, 'no sideways overflow').toBeLessThanOrEqual(layout.clientWidth + 1)
        expect(layout.rows, 'the cards wrap into more than one row').toBeGreaterThan(1)
        expect(pageErrors).toEqual([])
      })
    })
  }
})
