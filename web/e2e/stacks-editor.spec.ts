import { test, expect } from './fixtures'
import { withFakeServer } from './support/fake-backend'
import { proxyPort } from './dual'
import { decksGalleryScenario } from '../fixtures/scenarios/decksGallery'
import { dismissSetupWizard } from './support/start-game'

async function openGallery(page: import('@playwright/test').Page, user: string) {
  await page.goto(`/?proxyPort=${proxyPort()}`)
  await dismissSetupWizard(page)
  await page.getByPlaceholder(/Usuario|Username/i).fill(user)
  await page.getByPlaceholder(/Contraseña|Password/i).fill('pass')
  await page.getByRole('button', { name: /Conectar/i }).click()
  await expect(page.getByRole('button', { name: /Mesas/ })).toBeVisible({ timeout: 15000 })
  await page.getByRole('button', { name: /Mis Mazos|Mazos/i }).click()
  await expect(page.locator('.decks-gallery')).toBeVisible({ timeout: 8000 })
}

test.describe('Stacks editor', () => {
  test('edits a precon as a clone, groups by type and persists on Done @decks', async ({ page }) => {
    await withFakeServer(decksGalleryScenario, async () => {
      await openGallery(page, `stacks_${String(Date.now()).slice(-7)}`)
      await page.locator('.deck-box', { hasText: /Precon/ }).first().click()
      await page.locator('.decks-stacks-btn').click()

      await expect(page.locator('[data-testid="stacks-editor"]')).toBeVisible({ timeout: 8000 })
      await expect(page.locator('.stacks-editor-main .arena-stack-board')).toBeVisible()
      await expect(page.locator('.stacks-editor-main .arena-stack-col[data-column="lands"]')).toBeVisible()
      await expect(page.locator('.stacks-editor-search')).toBeVisible()

      const bolt = page.locator('.stacks-editor-main .arena-stack-card[data-card-key$=":Lightning Bolt"]')
      const before = await bolt.locator('.arena-stack-qty').textContent()
      await bolt.click()
      const after = await bolt.locator('.arena-stack-qty').textContent()
      expect(parseInt(after ?? '', 10)).toBe(parseInt(before ?? '', 10) - 1)

      await page.locator('[data-testid="stacks-editor-done"]').click()
      await expect(page.locator('.decks-gallery')).toBeVisible({ timeout: 8000 })

      await page.locator('.deck-box:not(.deck-box-create)').first().click()
      await page.locator('.decks-stacks-btn').click()
      await expect(page.locator('[data-testid="stacks-editor"]')).toBeVisible({ timeout: 8000 })
      await expect(bolt.locator('.arena-stack-qty')).toHaveText(`${parseInt(after ?? '', 10)}x`)
    })
  })

  test('DCK-1: the card size slider doubles the main deck tiles and the main area scrolls inside itself @decks', async ({ page }) => {
    await page.setViewportSize({ width: 1100, height: 720 })
    await withFakeServer(decksGalleryScenario, async () => {
      await openGallery(page, `stackssz_${String(Date.now()).slice(-7)}`)
      await page.locator('.deck-box', { hasText: /Precon/ }).first().click()
      await page.locator('.decks-stacks-btn').click()
      await expect(page.locator('[data-testid="stacks-editor"]')).toBeVisible({ timeout: 8000 })

      const main = page.locator('.stacks-editor-main')
      const slider = page.locator('.stacks-editor-head .arena-grid-size-slider')
      const value = page.locator('.stacks-editor-head .arena-grid-size-value')
      await expect(slider).toHaveValue('100')
      await expect(value).toHaveText('100%')

      const bolt = main.locator('.arena-stack-card[data-card-key$=":Lightning Bolt"]')
      const face = bolt.locator('.arena-stack-face')
      const sideFace = page.locator('.stacks-editor-side .arena-stack-face').first()
      const hasSide = await sideFace.count() > 0
      const width = async (loc: import('@playwright/test').Locator) => (await loc.boundingBox().catch(() => null))?.width ?? 0
      await expect.poll(() => width(face)).toBeGreaterThan(0)
      const width100 = await width(face)
      const side100 = hasSide ? await width(sideFace) : 0
      const search100 = await page.locator('.stacks-editor-search').boundingBox()

      await slider.fill('200')
      await expect(value).toHaveText('200%')
      await expect.poll(async () => (await width(face)) / width100).toBeGreaterThan(1.8)
      expect((await width(face)) / width100).toBeLessThan(2.3)
      if (hasSide) expect(Math.abs((await width(sideFace)) - side100)).toBeLessThanOrEqual(1)
      expect(await page.locator('.stacks-editor-search').boundingBox()).toEqual(search100)

      await expect.poll(() => main.evaluate((el) => el.scrollWidth > el.clientWidth || el.scrollHeight > el.clientHeight)).toBe(true)
      const scrolled = await main.evaluate((el) => {
        el.scrollTo({ left: el.scrollWidth, top: el.scrollHeight })
        return el.scrollLeft + el.scrollTop
      })
      expect(scrolled).toBeGreaterThan(0)
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true)
      expect(await page.evaluate(() => window.scrollX)).toBe(0)

      const before = parseInt((await bolt.locator('.arena-stack-qty').textContent()) ?? '', 10)
      await bolt.click()
      await expect(bolt.locator('.arena-stack-qty')).toHaveText(`${before - 1}x`)

      expect(await page.evaluate(() => localStorage.getItem('mage-web-deck-stacks-scale'))).toBe('200')
    })
  })

  test('the footer button hands over to the classic builder @decks', async ({ page }) => {
    await withFakeServer(decksGalleryScenario, async () => {
      await openGallery(page, `stacksedit_${String(Date.now()).slice(-7)}`)
      await page.locator('.deck-box', { hasText: /Precon/ }).first().click()
      await page.locator('.decks-stacks-btn').click()
      await expect(page.locator('[data-testid="stacks-editor"]')).toBeVisible({ timeout: 8000 })

      await page.locator('.stacks-editor-foot .ui-btn--subtle').click()
      await expect(page.locator('.deck-builder-body')).toBeVisible({ timeout: 8000 })
    })
  })
})
