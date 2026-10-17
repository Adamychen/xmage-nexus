import { test, expect, type Page } from '@playwright/test'

async function openWiki(page: Page) {
  await page.goto('/#/gallery')
  await page.locator('text=/Ayuda/').first().click()
  await expect(page.locator('.wiki-dialog')).toBeVisible({ timeout: 10_000 })
}

async function expectInsideViewport(page: Page) {
  const box = await page.locator('.wiki-dialog').boundingBox()
  const vp = page.viewportSize()!
  expect(box, 'wiki dialog has a box').not.toBeNull()
  expect(box!.x).toBeGreaterThanOrEqual(0)
  expect(box!.y).toBeGreaterThanOrEqual(0)
  expect(box!.x + box!.width).toBeLessThanOrEqual(vp.width)
  expect(box!.y + box!.height).toBeLessThanOrEqual(vp.height)
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
  expect(overflow).toBeLessThanOrEqual(0)
  const panelOverflow = await page.locator('.wiki-dialog').evaluate((el) => el.scrollWidth - el.clientWidth)
  expect(panelOverflow, 'dialog does not scroll sideways').toBeLessThanOrEqual(0)
}

for (const viewport of [{ width: 1280, height: 800 }, { width: 390, height: 844 }]) {
  test.describe(`help wiki at ${viewport.width}x${viewport.height} @site`, () => {
    test.use({ viewport })

    test('fits the viewport, keeps the close control visible and scrolls inside the modal', async ({ page }) => {
      await openWiki(page)
      await expectInsideViewport(page)

      await expect(page.locator('.wiki-close-btn')).toBeVisible()
      await expect(page.locator('.wiki-close-btn')).toBeInViewport()

      await page.locator('.wiki-nav-tabs [role="tab"]').nth(2).click()
      await expectInsideViewport(page)

      const panel = await page.locator('.wiki-dialog').boundingBox()
      const body = await page.locator('.wiki-content').evaluate((el) => ({
        overflowY: getComputedStyle(el).overflowY,
        box: el.getBoundingClientRect().toJSON(),
      }))
      expect(body.overflowY).toBe('auto')
      expect(body.box.bottom).toBeLessThanOrEqual(panel!.y + panel!.height)
      expect(body.box.top).toBeGreaterThanOrEqual(panel!.y)
    })
  })
}
