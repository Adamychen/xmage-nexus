import { test, expect } from './fixtures'
import { FAKE_MODE } from './dual'
import { login } from './support/start-game'

test.skip(FAKE_MODE, 'Real only: the "not in XMage" marks come from the proxy card DB (cardPrintings) of the real release.')

test.setTimeout(120_000)

const IMG = 'https://img.test/card.jpg'

function searchCard(id: string, name: string, set: string, number: string) {
  return {
    id, name, set, set_name: set.toUpperCase(), collector_number: number, released_at: '2009-07-17', rarity: 'common',
    mana_cost: '{R}', cmc: 1, type_line: 'Instant', colors: ['R'], color_identity: ['R'],
    image_uris: { normal: IMG, art_crop: IMG },
  }
}

test('deck builder marks cards and printings the server XMage does not have (real card DB)', { tag: '@decks' }, async ({ page }) => {
  // Scryfall simulado (deterministas, sin red): Lightning Bolt existe en XMage,
  // "Totally Fake Card" no; de las impresiones, M10 #146 existe y XYZ #999 no.
  await page.route('**/api.scryfall.com/cards/search**', (route) => {
    const url = decodeURIComponent(route.request().url())
    if (url.includes('unique=prints')) {
      return route.fulfill({ json: { data: [searchCard('p1', 'Lightning Bolt', 'm10', '146'), searchCard('p2', 'Lightning Bolt', 'xyz', '999')] } })
    }
    return route.fulfill({ json: { total_cards: 2, has_more: false, data: [searchCard('s1', 'Lightning Bolt', 'm10', '146'), searchCard('s2', 'Totally Fake Card', 'xyz', '1')] } })
  })
  await page.route('**/api.scryfall.com/cards/m10/146**', (route) => route.fulfill({ json: searchCard('p1', 'Lightning Bolt', 'm10', '146') }))

  await login(page, `cat${String(Date.now()).slice(-8)}`, { retryLobby: true })
  await page.getByRole('button', { name: /Mis Mazos|Mazos|Decks/i }).first().click()
  await expect(page.locator('.decks-gallery')).toBeVisible({ timeout: 8000 })
  await page.locator('.deck-box-create').click()
  await expect(page.locator('.deck-builder')).toBeVisible({ timeout: 8000 })

  await page.locator('.arena-search-input').fill('bolt')
  const fake = page.locator('.arena-grid-card[data-unimplemented]')
  await expect(fake).toHaveCount(1, { timeout: 20_000 })
  await expect(fake).toHaveAttribute('aria-label', /Totally Fake Card/)
  await expect(fake.locator('.arena-unimplemented-badge')).toBeVisible()
  await expect(page.locator('.arena-grid-card', { hasText: '' }).filter({ has: page.locator('img[alt="Lightning Bolt"]') }))
    .not.toHaveAttribute('data-unimplemented', /.*/)
  await page.screenshot({ path: test.info().outputPath('search-unimplemented.png') })

  await page.getByRole('button', { name: /Importar Mazo|Import Deck/i }).click()
  await page.locator('.deck-import-textarea').fill('4 [M10:146] Lightning Bolt')
  await page.locator('[data-testid="import-submit-btn"]').click()
  const strip = page.locator('.deck-category-section:not(.deck-sideboard-section) .arena-card-strip', { hasText: /Lightning Bolt|Relámpago/ }).first()
  await expect(strip).toBeVisible({ timeout: 10_000 })
  const printBtn = strip.locator('.strip-btn.print')
  await expect(async () => {
    await page.mouse.move(8, 8)
    await strip.hover({ timeout: 5000 })
    await expect(printBtn).toBeVisible()
  }).toPass({ timeout: 15_000 })
  await printBtn.dispatchEvent('click')
  await expect(page.locator('.printings-modal')).toBeVisible({ timeout: 5000 })
  const missing = page.locator('.printing-card-item[data-unavailable]')
  await expect(missing).toHaveCount(1, { timeout: 15_000 })
  await expect(missing).toContainText('XYZ #999')
  await expect(page.locator('.printing-card-item', { hasText: 'M10 #146' })).not.toHaveAttribute('data-unavailable', /.*/)
  await page.screenshot({ path: test.info().outputPath('printings-unavailable.png') })
})
