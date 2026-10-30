import { test, expect } from './fixtures'
import { fakeOnly } from './support/fake-mode'
fakeOnly()

test.describe('Card grid footer', () => {
  for (const [name, width, height] of [['desktop', 1600, 900], ['phone', 390, 844]] as const) {
    test(`PRM-12: a card grid with 30 lands keeps its finish button inside the dialog on a ${name} screen`, async ({ page }) => {
      await page.setViewportSize({ width, height })
      await page.goto('/#/gallery')
      await expect(page.locator('[data-gallery]')).toBeVisible({ timeout: 30_000 })
      await page.locator('[data-gallery-entry="prompt:lands-up-to-two"]').click()

      const footer = page.locator('.card-grid-actions')
      await expect(footer.getByRole('button', { name: /Terminar selección|Finish selection/i })).toBeVisible({ timeout: 10_000 })
      const inside = await page.evaluate(() => {
        const dialog = document.querySelector('.card-grid-dialog') as HTMLElement | null
        const actions = document.querySelector('.card-grid-actions') as HTMLElement | null
        if (!dialog || !actions) return false
        return actions.getBoundingClientRect().bottom <= dialog.getBoundingClientRect().bottom + 1
      })
      expect(inside, 'the footer sits above the bottom edge of the dialog').toBe(true)
    })
  }
})
