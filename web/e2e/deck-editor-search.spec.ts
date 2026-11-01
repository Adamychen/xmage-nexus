import type { Page } from '@playwright/test'
import { test, expect } from './fixtures'
import { withFakeServer } from './support/fake-backend'
import { proxyPort } from './dual'
import { dismissSetupWizard } from './support/start-game'
import { decksGalleryScenario } from '../fixtures/scenarios/decksGallery'

function user(tag: string) {
  return `${tag}_${String(Date.now()).slice(-6)}`
}

async function openEditor(page: Page, name: string) {
  await page.route('**/api.scryfall.com/**', (route) => route.fulfill({ status: 404, body: 'not stubbed' }))
  await page.route('**/api.scryfall.com/cards/search**', (route) => route.fulfill({ json: { object: 'list', total_cards: 0, data: [] } }))
  await page.goto(`/?proxyPort=${proxyPort()}`)
  await dismissSetupWizard(page)
  await page.getByPlaceholder(/Usuario|Username/i).fill(name)
  await page.getByPlaceholder(/Contraseña|Password/i).fill('pass')
  await page.getByRole('button', { name: /Conectar/i }).click()
  await expect(page.getByRole('button', { name: /Mesas/ })).toBeVisible({ timeout: 15000 })
  await page.getByRole('button', { name: /Mis Mazos|Mazos/i }).click()
  await expect(page.locator('.decks-gallery')).toBeVisible({ timeout: 8000 })
  await page.locator('.deck-box', { hasText: /Precon/ }).first().click()
  await page.locator('.decks-edit-btn').click()
  await expect(page.locator('.arena-search-panel')).toBeVisible({ timeout: 8000 })
}

test.describe('Deck editor search', () => {
  for (const width of [1024, 1440]) {
    test(`the Scryfall syntax help fits inside the search panel at ${width}px @decks`, async ({ page }) => {
      await page.setViewportSize({ width, height: 720 })
      await withFakeServer(decksGalleryScenario, async () => {
        await openEditor(page, user('help'))
        await page.locator('.arena-search-help-btn').click()
        const popover = page.locator('.arena-search-help-popover')
        await expect(popover).toBeVisible()
        await expect(popover.locator('.help-popover-link')).toBeVisible()

        const pop = await popover.boundingBox()
        const panel = await page.locator('.arena-search-panel').boundingBox()
        expect(pop && panel).toBeTruthy()
        expect(pop!.x).toBeGreaterThanOrEqual(panel!.x)
        expect(pop!.x + pop!.width).toBeLessThanOrEqual(panel!.x + panel!.width + 0.5)
      })
    })
  }
})
