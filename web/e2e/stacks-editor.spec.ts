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

      const firstCard = page.locator('.stacks-editor-main .arena-stack-card').first()
      const before = await firstCard.locator('.arena-stack-qty').textContent()
      await firstCard.click()
      const after = await firstCard.locator('.arena-stack-qty').textContent()
      expect(parseInt(after ?? '', 10)).toBe(parseInt(before ?? '', 10) - 1)

      await page.locator('[data-testid="stacks-editor-done"]').click()
      await expect(page.locator('.decks-gallery')).toBeVisible({ timeout: 8000 })

      await page.locator('.deck-box:not(.deck-box-create)').first().click()
      await page.locator('.decks-stacks-btn').click()
      await expect(page.locator('[data-testid="stacks-editor"]')).toBeVisible({ timeout: 8000 })
      await expect(page.locator('.stacks-editor-main .arena-stack-card').first().locator('.arena-stack-qty')).toHaveText(`${parseInt(after ?? '', 10)}x`)
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
