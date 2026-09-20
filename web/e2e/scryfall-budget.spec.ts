import { test, expect } from './fixtures'
import { withFakeServer } from './support/fake-backend'
import { proxyPort } from './dual'
import { dismissSetupWizard } from './support/start-game'
import { decksGalleryScenario } from '../fixtures/scenarios/decksGallery'

const CARD_COUNT = 60
const MAX_PER_SECOND = 10
const MAX_CONCURRENT = 4

interface ScryfallLog {
  starts: number[]
  peak: number
}

test.describe('Scryfall request budget', () => {
  test('opening a large deck in the editor stays under the API rate limit @decks', async ({ page }) => {
    await withFakeServer(decksGalleryScenario, async () => {
      await page.addInitScript(() => {
        const log = { starts: [] as number[], peak: 0 }
        let inFlight = 0
        const w = window as unknown as { __scryfallLog: typeof log }
        w.__scryfallLog = log
        const original = window.fetch.bind(window)
        window.fetch = async (input, init) => {
          const url = typeof input === 'string' ? input : input instanceof Request ? input.url : String(input)
          if (!url.includes('api.scryfall.com')) return original(input, init)
          log.starts.push(performance.now())
          inFlight++
          log.peak = Math.max(log.peak, inFlight)
          try {
            return await original(input, init)
          } finally {
            inFlight--
          }
        }
      })
      await page.route('**/api.scryfall.com/**', async (route) => {
        const url = route.request().url()
        await new Promise((r) => setTimeout(r, 60))
        if (url.includes('/cards/search')) {
          await route.fulfill({ json: { object: 'list', data: [], has_more: false } })
          return
        }
        const m = /\/cards\/([a-z0-9]+)\/(\d+)/i.exec(url)
        if (!m || /\/cards\/[a-z0-9]+\/\d+\/[a-z]{2}\b/i.test(url)) {
          await route.fulfill({ status: 404, body: 'not found' })
          return
        }
        await route.fulfill({
          json: {
            object: 'card',
            name: `Card ${m[2]}`,
            mana_cost: '{1}',
            cmc: 1,
            type_line: 'Artifact',
            colors: [],
            image_uris: { normal: 'https://img.test/n.jpg', art_crop: 'https://img.test/a.jpg' },
          },
        })
      })

      await page.goto(`/?proxyPort=${proxyPort()}`)
      await dismissSetupWizard(page)
      await page.getByPlaceholder(/Usuario|Username/i).fill(`budget_${String(Date.now()).slice(-7)}`)
      await page.getByPlaceholder(/Contraseña|Password/i).fill('pass')
      await page.getByRole('button', { name: /Conectar/i }).click()
      await expect(page.getByRole('button', { name: /Mesas/ })).toBeVisible({ timeout: 15000 })
      await page.getByRole('button', { name: /Mis Mazos|Mazos/i }).click()
      await expect(page.locator('.decks-gallery')).toBeVisible({ timeout: 8000 })
      await page.locator('.deck-box-create').click()
      await expect(page.locator('.deck-builder')).toBeVisible({ timeout: 8000 })

      const before = await page.evaluate(() => (window as unknown as { __scryfallLog: ScryfallLog }).__scryfallLog.starts.length)
      const list = Array.from({ length: CARD_COUNT }, (_, i) => `1 [LEA:${100 + i}] Card ${100 + i}`).join('\n')
      await page.getByRole('button', { name: /Importar Mazo/i }).click()
      await page.locator('.deck-import-textarea').fill(list)
      await page.locator('[data-testid="import-submit-btn"]').click()
      await expect(page.locator('.arena-card-strip').first()).toBeVisible({ timeout: 5000 })

      await expect.poll(async () => {
        const n = await page.evaluate(() => (window as unknown as { __scryfallLog: ScryfallLog }).__scryfallLog.starts.length)
        return n - before
      }, { timeout: 30_000, intervals: [500] }).toBeGreaterThanOrEqual(CARD_COUNT)

      await expect.poll(() => page.evaluate(() => new Promise<number>((resolve) => {
        const req = indexedDB.open('xmage-scryfall-cache')
        req.onerror = () => resolve(0)
        req.onsuccess = () => {
          const db = req.result
          if (!db.objectStoreNames.contains('cards')) {
            resolve(0)
            return
          }
          const count = db.transaction('cards', 'readonly').objectStore('cards').count()
          count.onsuccess = () => resolve(count.result)
          count.onerror = () => resolve(0)
        }
      })), { timeout: 40_000, intervals: [500] }).toBeGreaterThanOrEqual(CARD_COUNT)

      const log = await page.evaluate(() => (window as unknown as { __scryfallLog: ScryfallLog }).__scryfallLog)
      const starts = [...log.starts].sort((a, b) => a - b)
      let worstWindow = 0
      for (let i = 0; i < starts.length; i++) {
        let n = 0
        while (i + n < starts.length && starts[i + n] < starts[i] + 1000) n++
        worstWindow = Math.max(worstWindow, n)
      }
      expect(worstWindow).toBeLessThanOrEqual(MAX_PER_SECOND)
      expect(log.peak).toBeLessThanOrEqual(MAX_CONCURRENT)
    })
  })
})
