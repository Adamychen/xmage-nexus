import { test, expect } from './fixtures'
import { withFakeServer } from './support/fake-backend'
import { proxyPort } from './dual'
import { decksGalleryScenario } from '../fixtures/scenarios/decksGallery'

const IMG_A = 'https://img.test/m10-bolt.jpg'
const IMG_B = 'https://img.test/lea-bolt.jpg'

function scryfallCard(normal: string) {
  return {
    name: 'Lightning Bolt',
    mana_cost: '{R}',
    cmc: 1,
    type_line: 'Instant',
    colors: ['R'],
    image_uris: { normal, art_crop: normal },
  }
}

test.describe('Printing change refreshes hover preview', () => {
  test('switching edition updates the strip hover preview art @decks', async ({ page }) => {
    await withFakeServer(decksGalleryScenario, async () => {
      await page.route('**/api.scryfall.com/cards/m10/146**', (route) =>
        route.fulfill({ json: scryfallCard(IMG_A) }),
      )
      await page.route('**/api.scryfall.com/cards/lea/161**', (route) =>
        route.fulfill({ json: scryfallCard(IMG_B) }),
      )
      await page.route('**/api.scryfall.com/cards/search**', (route) =>
        route.fulfill({
          json: {
            data: [
              { id: 'a', name: 'Lightning Bolt', mana_cost: '{R}', cmc: 1, type_line: 'Instant', colors: ['R'], set: 'm10', set_name: 'Magic 2010', collector_number: '146', released_at: '2009-07-17', rarity: 'common', image_uris: { normal: IMG_A, art_crop: IMG_A } },
              { id: 'b', name: 'Lightning Bolt', mana_cost: '{R}', cmc: 1, type_line: 'Instant', colors: ['R'], set: 'lea', set_name: 'Limited Edition Alpha', collector_number: '161', released_at: '1993-08-05', rarity: 'common', image_uris: { normal: IMG_B, art_crop: IMG_B } },
            ],
          },
        }),
      )

      await page.goto(`/?proxyPort=${proxyPort()}`)
      const username = `print_${Date.now()}`
      await page.getByPlaceholder(/Usuario|Username/i).fill(username)
      await page.getByPlaceholder(/Contraseña|Password/i).fill('pass')
      await page.getByRole('button', { name: /Conectar/i }).click()
      await expect(page.getByRole('button', { name: /Mesas/ })).toBeVisible({ timeout: 15000 })
      await page.getByRole('button', { name: /Mis Mazos|Mazos/i }).click()
      await expect(page.locator('.decks-gallery')).toBeVisible({ timeout: 8000 })
      await page.locator('.deck-box-create').click()
      await expect(page.locator('.deck-builder')).toBeVisible({ timeout: 8000 })

      await page.getByRole('button', { name: /Importar Mazo/i }).click()
      await page.locator('.deck-import-textarea').fill('4 [M10:146] Lightning Bolt')
      await page.locator('.import-submit-btn').click()
      const strip = page.locator('.deck-category-section:not(.deck-sideboard-section) .arena-card-strip', { hasText: /Lightning Bolt|Relámpago/ }).first()
      await expect(strip).toBeVisible({ timeout: 5000 })
      await expect(page.locator('.deck-category-section', { hasText: /instant/i })).toBeVisible({ timeout: 15000 })

      await strip.hover({ timeout: 15000 })
      await expect(page.locator('.arena-floating-preview img').first()).toHaveAttribute('src', IMG_A, { timeout: 10000 })

      await strip.locator('.strip-btn.print').click({ timeout: 15000 })
      await expect(page.locator('.printings-modal')).toBeVisible({ timeout: 5000 })
      await page.locator('.printing-card-item', { hasText: 'LEA #161' }).click({ timeout: 15000 })
      await expect(page.locator('.printings-modal')).toBeHidden({ timeout: 5000 })

      await strip.hover({ timeout: 15000 })
      await expect(page.locator('.arena-floating-preview img').first()).toHaveAttribute('src', IMG_B, { timeout: 10000 })
    })
  })
})
