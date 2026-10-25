import type { Locator, Page } from '@playwright/test'
import { test, expect } from './fixtures'
import { withFakeServer } from './support/fake-backend'
import { proxyPort } from './dual'
import { dismissSetupWizard } from './support/start-game'
import { decksGalleryScenario } from '../fixtures/scenarios/decksGallery'

const IMG = 'https://img.test/m10-bolt.jpg'

function scryfallCard() {
  return {
    name: 'Lightning Bolt',
    mana_cost: '{R}',
    cmc: 1,
    type_line: 'Instant',
    colors: ['R'],
    image_uris: { normal: IMG, art_crop: IMG },
  }
}

async function openBuilderWithBolt(page: Page, username: string): Promise<Locator> {
  await page.route('**/api.scryfall.com/cards/m10/146**', (route) => route.fulfill({ json: scryfallCard() }))
  await page.route('**/api.scryfall.com/cards/search**', (route) =>
    route.fulfill({
      json: {
        data: [
          { id: 'a', name: 'Lightning Bolt', mana_cost: '{R}', cmc: 1, type_line: 'Instant', colors: ['R'], set: 'm10', set_name: 'Magic 2010', collector_number: '146', released_at: '2009-07-17', rarity: 'common', image_uris: { normal: IMG, art_crop: IMG } },
        ],
      },
    }),
  )

  await page.goto(`/?proxyPort=${proxyPort()}`)
  await dismissSetupWizard(page)
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
  await page.locator('[data-testid="import-submit-btn"]').click()
  const strip = page.locator('.deck-category-section:not(.deck-sideboard-section) .arena-card-strip', { hasText: /Lightning Bolt|Relámpago/ }).first()
  await expect(strip).toBeVisible({ timeout: 5000 })
  await expect(strip.locator('.strip-bg-art')).toBeAttached({ timeout: 15000 })
  return strip
}

test.describe('DCK-4: deck strip actions depend on the pointer', () => {
  test.describe('touch screen', () => {
    test.use({ hasTouch: true })

    test('DCK-4: on a touch screen the strip actions are shown without a hover @decks', async ({ page }) => {
      await withFakeServer(decksGalleryScenario, async () => {
        const strip = await openBuilderWithBolt(page, `dck4_${String(Date.now()).slice(-8)}`)
        await expect.poll(() => page.evaluate(() => matchMedia('(hover: none)').matches)).toBe(true)
        await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur())
        await page.mouse.move(8, 8)
        await expect.poll(() => strip.evaluate((el) => el.matches(':hover, :focus-within'))).toBe(false)
        await expect(strip.locator('.strip-actions')).toBeVisible()
        await expect(strip.locator('.strip-actions').getByRole('button').first()).toBeVisible()
      })
    })
  })

  test('DCK-4: on a pointer device the strip actions stay hidden until the card is hovered @decks', async ({ page }) => {
    await withFakeServer(decksGalleryScenario, async () => {
      const strip = await openBuilderWithBolt(page, `dck4_${String(Date.now()).slice(-8)}`)
      await page.mouse.move(8, 8)
      await expect(page.locator('.strip-actions').first()).toBeHidden()
      await strip.hover()
      await expect(strip.locator('.strip-actions')).toBeVisible()
    })
  })
})
