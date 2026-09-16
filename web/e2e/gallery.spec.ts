/**
 * P3 — galería de estados (`#/gallery`, solo dev).
 *
 * Siempre: recorre TODAS las entradas y exige que cada una monte sin errores de
 * página (cubre las 44 sin coste de baselines).
 *
 * Regresión visual (`E2E_VISUAL=1`): compara una selección representativa con
 * `toHaveScreenshot` (animaciones desactivadas, red externa bloqueada para que
 * los placeholders de carta sean deterministas). Los baselines son por
 * plataforma: se generan en local con `E2E_VISUAL=1 npx playwright test
 * gallery.spec.ts --update-snapshots`; en CI quedan opt-in.
 */
import { test, expect, type Page } from '@playwright/test'

const VISUAL = process.env.E2E_VISUAL === '1'

const VISUAL_ENTRIES = [
  'frame:mutate',
  'frame:combat',
  'frame:xcosts',
  'frame:block',
  'prompt:target',
  'prompt:mana',
  'prompt:combat-attack',
  'prompt:card-grid',
  'prompt:mulligan',
  'prompt:trigger-order',
  'prompt:voting',
  'screen:login',
]

async function openGallery(page: Page) {
  await page.addInitScript(() => localStorage.clear())
  await page.route(/^https?:\/\/(?!localhost|127\.0\.0\.1)/, (route) => route.abort())
  await page.goto('/#/gallery')
  await expect(page.locator('[data-gallery]')).toBeVisible()
}

async function entryIds(page: Page): Promise<string[]> {
  return page
    .locator('[data-gallery-entry]')
    .evaluateAll((nodes) => nodes.map((node) => node.getAttribute('data-gallery-entry') ?? '').filter(Boolean))
}

async function showEntry(page: Page, id: string) {
  const button = page.locator(`[data-gallery-entry="${id}"]`)
  await expect(button, `falta la entrada ${id}`).toHaveCount(1)
  await button.click()
  await expect(page.locator(`[data-gallery-stage="${id}"]`)).toBeAttached({ timeout: 10_000 })
  await page.waitForTimeout(250)
}

test.describe('galería de estados (P3)', () => {
  test('todas las entradas montan sin errores de página', async ({ page }) => {
    const pageErrors: string[] = []
    page.on('pageerror', (error) => pageErrors.push(String(error)))

    await openGallery(page)
    const ids = await entryIds(page)
    expect(ids.length).toBeGreaterThan(40)

    for (const id of ids) {
      await showEntry(page, id)
    }

    expect(pageErrors).toEqual([])
  })

  test('regresión visual de la selección representativa', async ({ page }) => {
    test.skip(!VISUAL, 'E2E_VISUAL=1 requerido (baselines por plataforma)')
    await openGallery(page)
    const viewport = page.viewportSize() ?? { width: 0, height: 0 }

    for (const id of VISUAL_ENTRIES) {
      await showEntry(page, id)
      const name = `${id.replace(/[^a-z0-9]+/gi, '-')}-${viewport.width}x${viewport.height}.png`
      await expect(page.locator('.gallery-stage')).toHaveScreenshot(name, {
        animations: 'disabled',
        caret: 'hide',
      })
    }
  })
})
