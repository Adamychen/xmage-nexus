import { fakeOnly } from './support/fake-mode'
import { test, expect } from './fixtures'
fakeOnly()
import { quickStartGame } from './support/start-game'
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
      const { pageErrors } = await quickStartGame(page, {
        prefix: 'insp',
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
      const { pageErrors } = await quickStartGame(page, {
        prefix: 'insp2',
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

  async function stubEngineText(page: Page): Promise<void> {
    await page.route('**/api.scryfall.com/**', (route) => route.fulfill({ status: 404, json: { object: 'error' } }))
    await page.route('**/cards.scryfall.io/**', (route) =>
      route.fulfill({ contentType: 'image/svg+xml', body: svg(488, 680, '#9ecbff', 'CARD') }),
    )
  }

  async function inspect(page: Page, name: string) {
    const slot = page.locator(`.player-zone .card-slot[data-card-name="${name}"]`).first()
    await expect(slot).toBeVisible({ timeout: 15_000 })
    await slot.click({ button: 'right' })
    const inspector = page.locator('.card-inspector')
    await expect(inspector).toBeVisible({ timeout: 5_000 })
    return inspector
  }

  test('CRD-1: shows the battlefield state the printed card cannot, and opens attachments', async ({ page }) => {
    await stubEngineText(page)
    await withFakeServer(cardInspectorScenario, async () => {
      const { pageErrors } = await quickStartGame(page, { prefix: 'insp3' })

      const inspector = await inspect(page, 'Tarmogoyf')
      const pt = inspector.locator('[data-stat="pt"]')
      await expect(pt).toContainText('6/7')
      await expect(pt).toContainText('0/1')
      await expect(pt.locator('.card-inspector-pt-up')).toHaveCount(2)
      await expect(inspector.locator('[data-stat="damage"]')).toContainText('2')
      await expect(inspector.locator('[data-counter="+1/+1"]')).toContainText('×2')
      await expect(inspector.locator('[data-status="tapped"]')).toBeVisible()
      await expect(inspector.locator('[data-status="owner"]')).toBeVisible()

      await inspector.locator('.card-inspector-link', { hasText: 'Sword of Fire and Ice' }).click()
      await expect(inspector).toHaveAttribute('aria-label', 'Sword of Fire and Ice')
      await expect(inspector.locator('.card-inspector-link', { hasText: 'Tarmogoyf' })).toBeVisible()

      await page.keyboard.press('Escape')
      await expect(inspector).toBeHidden()
      expect(pageErrors, `pageerrors: ${pageErrors.map(String).join(' | ')}`).toEqual([])
    })
  })

  test('CRD-1, CRD-2, CRD-4: flips a double-faced card with a tap and leaves out the unchanged 1/1', async ({ page }) => {
    await stubEngineText(page)
    await withFakeServer(cardInspectorScenario, async () => {
      const { pageErrors } = await quickStartGame(page, { prefix: 'insp4' })

      const inspector = await inspect(page, 'Delver of Secrets')
      await expect(inspector.locator('[data-stat]')).toHaveCount(0)
      await expect(inspector.locator('[data-status="sick"]')).toBeVisible()

      const faces = inspector.locator('.card-inspector-face')
      await expect(faces.first()).toHaveAttribute('aria-pressed', 'true')
      await expect(faces.first().locator('.card-inspector-face-dot')).toHaveCount(1)
      await faces.nth(1).click()
      await expect(inspector.locator('.card-inspector-name')).toHaveText('Insectile Aberration')
      await expect(faces.nth(1)).toHaveAttribute('aria-pressed', 'true')
      await expect(inspector.locator('.card-inspector-state')).toHaveCount(0)
      await expect(inspector.locator('.card-inspector-keyword')).toHaveCount(1)

      await page.keyboard.press('f')
      await expect(inspector.locator('.card-inspector-name')).toHaveText('Delver of Secrets')
      expect(pageErrors, `pageerrors: ${pageErrors.map(String).join(' | ')}`).toEqual([])
    })
  })

  test('CRD-1, CRD-4: shows a planeswalker loyalty off its start and dims the abilities it cannot pay', async ({ page }) => {
    await stubEngineText(page)
    await withFakeServer(cardInspectorScenario, async () => {
      const { pageErrors } = await quickStartGame(page, { prefix: 'insp5' })

      const inspector = await inspect(page, 'Jace, the Mind Sculptor')
      await expect(inspector.locator('[data-stat="loyalty"]')).toContainText('5')
      await expect(inspector.locator('.card-inspector-cost')).toHaveText(['+2', '0', '\u22121', '\u221212'])
      await expect(inspector.locator('.card-inspector-ability.is-unaffordable')).toHaveCount(1)
      await expect(inspector.locator('.card-inspector-ability.is-unaffordable')).toContainText('Exile all cards')
      expect(pageErrors, `pageerrors: ${pageErrors.map(String).join(' | ')}`).toEqual([])
    })
  })

  for (const size of [{ width: 1280, height: 720 }, { width: 390, height: 844 }]) {
    test(`CRD-3: fits a ${size.width}x${size.height} screen with nothing clipped`, async ({ page }) => {
      await page.setViewportSize(size)
      await stubEngineText(page)
      await withFakeServer(cardInspectorScenario, async () => {
        const { pageErrors } = await quickStartGame(page, { prefix: `insp${size.width}` })

        const inspector = await inspect(page, 'Tarmogoyf')
        await inspector.evaluate((el) => Promise.all(el.getAnimations().map((a) => a.finished)))
        const box = (await inspector.boundingBox())!
        expect(box.x).toBeGreaterThanOrEqual(0)
        expect(box.x + box.width).toBeLessThanOrEqual(size.width + 0.5)
        expect(box.height).toBeLessThanOrEqual(size.height * 0.7 + 1)
        if (size.width <= 760) expect(Math.abs(box.y + box.height - size.height)).toBeLessThanOrEqual(1)

        const art = (await page.locator('.card-inspector-art').boundingBox())!
        if (size.width > 760) {
          expect(art.y).toBeGreaterThanOrEqual(box.y)
          expect(art.y + art.height).toBeLessThanOrEqual(box.y + box.height)
        }

        const customize = page.locator('.card-inspector-customize')
        await expect(customize).toBeVisible()
        const clipped = await page.locator('.card-inspector button, .card-inspector .card-inspector-chip').evaluateAll((els) =>
          els.filter((el) => el.scrollWidth > el.clientWidth + 1).map((el) => el.textContent),
        )
        expect(clipped).toEqual([])
        if (size.width <= 760) expect((await customize.boundingBox())!.height).toBeGreaterThanOrEqual(44)

        const close = (await page.locator('.card-inspector-close').boundingBox())!
        const mana = await page.locator('.card-inspector-mana').boundingBox()
        if (mana) expect(mana.x + mana.width <= close.x || mana.y >= close.y + close.height).toBe(true)

        expect(pageErrors, `pageerrors: ${pageErrors.map(String).join(' | ')}`).toEqual([])
      })
    })
  }
})
