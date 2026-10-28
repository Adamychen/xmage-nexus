import type { Locator, Page } from '@playwright/test'
import { test, expect } from './fixtures'
import { withFakeServer } from './support/fake-backend'
import { proxyPort } from './dual'
import { dismissSetupWizard } from './support/start-game'
import { decksGalleryScenario } from '../fixtures/scenarios/decksGallery'

const IMG = 'https://img.test/m10-bolt.jpg'

test.use({ viewport: { width: 390, height: 844 } })

async function openPhoneBuilder(page: Page, username: string): Promise<void> {
  await page.route('**/api.scryfall.com/cards/m10/146**', (route) => route.fulfill({
    json: { name: 'Lightning Bolt', mana_cost: '{R}', cmc: 1, type_line: 'Instant', colors: ['R'], image_uris: { normal: IMG, art_crop: IMG } },
  }))
  await page.route('**/api.scryfall.com/cards/search**', (route) => route.fulfill({
    json: {
      data: [
        { id: 'a', name: 'Lightning Bolt', mana_cost: '{R}', cmc: 1, type_line: 'Instant', colors: ['R'], set: 'm10', set_name: 'Magic 2010', collector_number: '146', released_at: '2009-07-17', rarity: 'common', image_uris: { normal: IMG, art_crop: IMG } },
      ],
    },
  }))

  await page.goto(`/?proxyPort=${proxyPort()}`)
  await dismissSetupWizard(page)
  await page.getByPlaceholder(/Usuario|Username/i).fill(username)
  await page.getByPlaceholder(/Contraseña|Password/i).fill('pass')
  await page.getByRole('button', { name: /Conectar/i }).click()
  await expect(page.getByRole('button', { name: /Mesas/ })).toBeVisible({ timeout: 15000 })
  await page.getByRole('button', { name: /Mis Mazos|Mazos/i }).click()
  await expect(page.locator('.decks-gallery')).toBeVisible({ timeout: 8000 })
  await page.locator('.deck-box-create').click()
  await expect(page.locator('.deck-builder--phone')).toBeVisible({ timeout: 8000 })

  await page.getByTestId('deck-editor-more').click()
  await page.getByRole('menuitem', { name: /Importar Mazo|Import deck/i }).click()
  await page.locator('.deck-import-textarea').fill('4 [M10:146] Lightning Bolt')
  await page.locator('[data-testid="import-submit-btn"]').click()
  await expect(page.locator('[data-testid="deck-editor-piles"] .arena-stack-card[data-card-key$=":Lightning Bolt"][data-front="true"]')).toBeVisible({ timeout: 8000 })
}

function box(locator: Locator) {
  return locator.boundingBox().then((b) => {
    if (!b) throw new Error('element has no box')
    return b
  })
}

function intersects(a: { x: number; y: number; width: number; height: number }, b: { x: number; y: number; width: number; height: number }) {
  return a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height
}

test.describe('DCK-14: the deck editor on a phone', () => {
  test('DCK-14: the piles are visible and the bottom navigation and credits do not cover them or the bottom bar @decks', async ({ page }) => {
    await withFakeServer(decksGalleryScenario, async () => {
      await openPhoneBuilder(page, `dck14a_${String(Date.now()).slice(-7)}`)

      const piles = page.getByTestId('deck-editor-piles')
      await expect(piles).toBeVisible()
      const nav = page.locator('.lobby-mobile-bottom-nav')
      await expect(nav).toBeVisible()

      const hit = await page.evaluate(() => {
        const column = document.querySelector('[data-testid="deck-editor-piles"] .arena-stack-col')
        if (!column) return null
        const r = column.getBoundingClientRect()
        const el = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2)
        return Boolean(el?.closest('[data-testid="deck-editor-piles"]'))
      })
      expect(hit).toBe(true)

      const pilesBox = await box(piles)
      const navBox = await box(nav)
      expect(intersects(pilesBox, navBox)).toBe(false)

      const bar = page.locator('.deck-phone-bar')
      await expect(bar).toBeVisible()
      const barBox = await box(bar)
      expect(intersects(barBox, navBox)).toBe(false)
      const credits = page.locator('.app-attribution')
      if (await credits.count() > 0) {
        expect(intersects(await box(credits), await box(page.locator('.deck-phone-add')))).toBe(false)
        expect(intersects(await box(credits), await box(page.locator('.deck-phone-curve')))).toBe(false)
      }
    })
  })

  test('DCK-14: the zone switch shows the sideboard in place of the main piles @decks', async ({ page }) => {
    await withFakeServer(decksGalleryScenario, async () => {
      await openPhoneBuilder(page, `dck14b_${String(Date.now()).slice(-7)}`)
      const piles = page.getByTestId('deck-editor-piles')
      await expect(piles).toHaveAttribute('data-zone', 'main')

      await page.getByRole('tab', { name: /Sideboard|Banquillo/i }).click()
      await expect(piles).toHaveAttribute('data-zone', 'side')
      await expect(page.locator('[data-testid="deck-editor-piles"] .arena-stack-card[data-card-key$=":Lightning Bolt"]')).toHaveCount(0)
      await expect(page.locator('.deck-editor-side-empty')).toBeVisible()

      await page.getByRole('tab', { name: /^(Main|Principal)$/ }).click()
      await expect(piles).toHaveAttribute('data-zone', 'main')
      await expect(page.locator('[data-testid="deck-editor-piles"] .arena-stack-card[data-card-key$=":Lightning Bolt"]').first()).toBeVisible()
    })
  })

  test('DCK-14: the action sheet minus button changes the count of the tapped card @decks', async ({ page }) => {
    await withFakeServer(decksGalleryScenario, async () => {
      await openPhoneBuilder(page, `dck14c_${String(Date.now()).slice(-7)}`)

      await page.locator('[data-testid="deck-editor-piles"] .arena-stack-card[data-card-key$=":Lightning Bolt"][data-front="true"]').click()
      const sheet = page.getByTestId('deck-phone-card')
      await expect(sheet).toBeVisible()
      const counts = sheet.locator('.card-focus-counts')
      await expect(counts).toContainText('4')

      await sheet.locator('.card-focus-dec').click()
      await expect(counts).toContainText('3')

      await sheet.getByRole('button', { name: /Close|Cerrar/i }).click()
      await expect(sheet).toHaveCount(0)
    })
  })

  test('DCK-14: the catalogue sheet opens full screen and closes @decks', async ({ page }) => {
    await withFakeServer(decksGalleryScenario, async () => {
      await openPhoneBuilder(page, `dck14d_${String(Date.now()).slice(-7)}`)

      await page.getByRole('button', { name: /Add cards|Añadir cartas/i }).click()
      const sheet = page.getByTestId('deck-phone-catalogue')
      await expect(sheet).toBeVisible()
      await expect(sheet.locator('.arena-search-panel')).toBeVisible()
      const viewport = page.viewportSize()!
      const sheetBox = await box(sheet)
      expect(sheetBox.height).toBeGreaterThanOrEqual(viewport.height - 1)
      expect(sheetBox.width).toBeGreaterThanOrEqual(viewport.width - 1)

      await sheet.getByRole('button', { name: /Close|Cerrar/i }).click()
      await expect(sheet).toHaveCount(0)
    })
  })

  test('DCK-14: the page never scrolls sideways @decks', async ({ page }) => {
    await withFakeServer(decksGalleryScenario, async () => {
      await openPhoneBuilder(page, `dck14e_${String(Date.now()).slice(-7)}`)
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
      expect(overflow).toBeLessThanOrEqual(0)
    })
  })
})
