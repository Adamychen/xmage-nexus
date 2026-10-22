import { fakeOnly } from './support/fake-mode'
import { test, expect } from './fixtures'
import { humanLeftScenario } from '../fixtures/scenarios/humanLeft'
import { withFakeServer } from './support/fake-backend'
import { quickStartGame } from './support/start-game'

fakeOnly()

test('DLG-11: Settings opened from the game menu paints over the overlay of a left seat', { tag: '@board' }, async ({ page }) => {
  await withFakeServer(() => humanLeftScenario(), async () => {
    await quickStartGame(page, { prefix: 'slo' })

    await expect(page.locator('.player-zone .zone-defeated-overlay')).toBeVisible({ timeout: 15_000 })
    await page.getByTestId('eliminated-watch').click()

    await page.getByTestId('game-menu-btn').click()
    await page.getByTestId('game-menu-settings').click()
    await expect(page.getByTestId('settings-modal')).toBeVisible()

    // The overlay is pointer-events: none, so hit testing would skip it: make it hit-testable
    // to ask which element actually paints on top where the two overlap.
    await page.addStyleTag({ content: '.zone-defeated-overlay { pointer-events: auto !important; }' })

    const point = await page.evaluate(() => {
      const modal = document.querySelector('[data-testid="settings-modal"]')?.getBoundingClientRect()
      const overlay = document.querySelector('.player-zone .zone-defeated-overlay')?.getBoundingClientRect()
      if (!modal || !overlay) return null
      const left = Math.max(modal.left, overlay.left)
      const right = Math.min(modal.right, overlay.right)
      const top = Math.max(modal.top, overlay.top)
      const bottom = Math.min(modal.bottom, overlay.bottom)
      if (left >= right || top >= bottom) return null
      return { x: (left + right) / 2, y: (top + bottom) / 2 }
    })
    expect(point, 'the settings dialog must overlap the seat overlay in this viewport').not.toBeNull()

    const hitInsideSettings = await page.evaluate(({ x, y }) => {
      const hit = document.elementFromPoint(x, y)
      return !!hit?.closest('[data-testid="settings-modal"]')
    }, point!)
    expect(hitInsideSettings, 'the settings dialog must paint over the seat overlay').toBe(true)
  })
})
