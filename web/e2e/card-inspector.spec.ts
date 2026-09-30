import { fakeOnly } from './support/fake-mode'
import { TABLE } from '../fixtures/table-names'
import { DECK } from '../fixtures/deck-names'
import { test, expect } from './fixtures'
fakeOnly()
import { startGame } from './support/start-game'
import { withFakeServer } from './support/fake-backend'
import { cardInspectorScenario } from '../fixtures/scenarios/cardInspector'
import type { Page } from '@playwright/test'

const LOCALIZED = {
  name: 'The One Ring',
  printed_name: 'El Anillo Único',
  printed_type_line: 'Artefacto legendario',
  printed_text: 'Indestructible.\nCuando El Anillo Único entre al campo de batalla, obtienes protección contra todo hasta tu próximo turno.',
  image_uris: { normal: 'https://cards.scryfall.io/normal/front/t/o/ring.svg' },
}

const NO_TEXT = {
  name: 'The One Ring',
  image_uris: { normal: 'https://cards.scryfall.io/normal/front/t/o/ring.svg' },
}

const svg = (w: number, h: number, fill: string, label: string) =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}"><rect width="100%" height="100%" fill="${fill}"/>` +
  `<text x="50%" y="50%" font-size="${Math.round(h / 8)}" text-anchor="middle" fill="#000">${label}</text></svg>`

async function stubScryfall(page: Page, payload: unknown = LOCALIZED): Promise<void> {
  await page.route('**/api.scryfall.com/cards/**', (route) => route.fulfill({ json: payload }))
  await page.route('**/cards.scryfall.io/**', (route) =>
    route.fulfill({ contentType: 'image/svg+xml', body: svg(488, 680, '#9ecbff', 'CARD') }),
  )
}

test.describe('Card inspector (right click)', { tag: '@game' }, () => {
  test('opens the full-size card with localized text and closes with Esc', async ({ page }) => {
    await page.addInitScript(() => {
      try {
        localStorage.setItem('nexus_card_lang', 'es')
      } catch {}
    })
    await stubScryfall(page)
    await withFakeServer(cardInspectorScenario, async () => {
      const { pageErrors } = await startGame(page, {
        prefix: 'insp',
        tableName: TABLE.cardInspector,
        deck: DECK.lands,
      })

      const slot = page.locator('.player-zone .card-slot[data-card-name="The One Ring"]').first()
      await expect(slot).toBeVisible({ timeout: 15_000 })
      await slot.click({ button: 'right' })

      const inspector = page.locator('.card-inspector')
      await expect(inspector).toBeVisible({ timeout: 5_000 })
      await expect(page.locator('.card-inspector-img')).toHaveAttribute('src', /\/large\//)
      await expect(inspector).toContainText('El Anillo Único')
      await expect(inspector).toContainText('Artefacto legendario')
      await expect(page.locator('.card-inspector-rules')).toContainText('Indestructible.')
      await expect(page.locator('.card-inspector-note')).toHaveCount(0)
      await page.screenshot({ path: test.info().outputPath('card-inspector.png') })

      await page.keyboard.press('Escape')
      await expect(inspector).toBeHidden()

      expect(pageErrors, `pageerrors: ${pageErrors.map(String).join(' | ')}`).toEqual([])
    })
  })

  test('falls back to the engine rules when Scryfall has no localized text', async ({ page }) => {
    await stubScryfall(page, NO_TEXT)
    await withFakeServer(cardInspectorScenario, async () => {
      const { pageErrors } = await startGame(page, {
        prefix: 'insp2',
        tableName: TABLE.cardInspector,
        deck: DECK.lands,
      })

      const slot = page.locator('.player-zone .card-slot[data-card-name="The One Ring"]').first()
      await expect(slot).toBeVisible({ timeout: 15_000 })
      await slot.click({ button: 'right' })

      const inspector = page.locator('.card-inspector')
      await expect(inspector).toBeVisible({ timeout: 5_000 })
      await expect(inspector).toContainText('The One Ring')
      await expect(page.locator('.card-inspector-rules')).toContainText('Indestructible.')
      await expect(page.locator('.card-inspector-note')).toHaveCount(1)
      await expect(page.locator('.card-inspector-img')).toHaveAttribute('src', /\/large\//)

      expect(pageErrors, `pageerrors: ${pageErrors.map(String).join(' | ')}`).toEqual([])
    })
  })
})
