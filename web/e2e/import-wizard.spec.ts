import { test, expect } from './fixtures'
import { withFakeServer } from './support/fake-backend'
import { proxyPort } from './dual'
import { decksGalleryScenario } from '../fixtures/scenarios/decksGallery'
import { dismissSetupWizard } from './support/start-game'

const ARENA = 'Deck\n4 Lightning Bolt\n2 Shock\n20 Mountain\n\nSideboard\n2 Smash to Smithereens'

const CARDS: Record<string, { set: string; num: string }> = {
  'Lightning Bolt': { set: 'clu', num: '141' },
  Shock: { set: 'm21', num: '159' },
}

test.describe('Import wizard', () => {
  test('arena text without art resolves printings in bulk and creates the deck @decks', async ({ page }) => {
    await page.route('https://api.scryfall.com/cards/named**', async (route) => {
      const name = new URL(route.request().url()).searchParams.get('exact') ?? ''
      const hit = CARDS[name]
      if (!hit) return route.fulfill({ status: 404, contentType: 'application/json', body: '{"object":"error"}' })
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          object: 'card', name, set: hit.set, collector_number: hit.num, cmc: 1, type_line: 'Instant',
          legalities: { modern: 'legal' },
        }),
      })
    })
    await withFakeServer(decksGalleryScenario, async () => {
      await page.goto(`/?proxyPort=${proxyPort()}`)
      await dismissSetupWizard(page)
      await page.getByPlaceholder(/Usuario|Username/i).fill(`wiz_${String(Date.now()).slice(-8)}`)
      await page.getByPlaceholder(/Contraseña|Password/i).fill('pass')
      await page.getByRole('button', { name: /Conectar/i }).click()
      await expect(page.getByRole('button', { name: /Mesas/ })).toBeVisible({ timeout: 15000 })
      await page.getByRole('button', { name: /Mis Mazos|Mazos/i }).click()
      await page.locator('[data-testid="decks-import-cta"]').click()
      await page.locator('.import-name-input').fill('Wizard Burn')
      await page.locator('.deck-import-textarea').fill(ARENA)
      const shots = process.env.SHOTS_DIR
      if (shots) await page.screenshot({ path: `${shots}/1-source.png` })
      await page.locator('[data-testid="import-next-btn"]').click()
      await expect(page.locator('[data-testid="import-step-setup"]')).toBeVisible()
      await page.locator('[data-testid="import-format-select"]').selectOption('Modern')
      if (shots) await page.screenshot({ path: `${shots}/2-setup.png` })
      await page.locator('[data-testid="import-resolve-btn"]').click()
      await expect(page.locator('[data-testid="import-step-review"]')).toBeVisible()
      await expect(page.locator('[data-testid="import-unresolved"]')).toContainText('Smash to Smithereens')
      if (shots) await page.screenshot({ path: `${shots}/3-review.png` })
      await page.locator('[data-testid="import-create-btn"]').click()
      await expect(page.locator('.deck-box-name', { hasText: 'Wizard Burn' })).toBeVisible({ timeout: 5000 })
    })
  })
})
