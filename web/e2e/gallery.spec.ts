/**
 * P3 — galería de estados (`#/gallery`, solo dev).
 *
 * Siempre: recorre TODAS las entradas y exige que cada una monte sin errores de
 * página (el número lo fija el builder; hoy 160+).
 *
 * Regresión visual (`E2E_VISUAL=1`): compara una selección representativa con
 * `toHaveScreenshot` (animaciones desactivadas, red externa bloqueada para que
 * los placeholders de carta sean deterministas). Los baselines son por
 * plataforma: se generan en local con `E2E_VISUAL=1 npx playwright test
 * gallery.spec.ts --update-snapshots`; en CI quedan opt-in.
 */
import { test, expect, type Page } from '@playwright/test'
import { fileURLToPath } from 'node:url'

const HIDE_ARROWS_CSS = fileURLToPath(new URL('./gallery-visual.css', import.meta.url))

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
  'screen:lobby-empty',
  'screen:lobby-overflow',
  'screen:decks',
  'screen:draft',
  'screen:draft-waiting',
  'screen:construct',
  'screen:construct-overflow',
  'screen:tournament-inprogress',
  'screen:tournament-finished',
  'screen:tournament-loading',
  'screen:tournament-error',
  'screen:tournament-empty',
  'screen:tournament-waiting',
  'screen:tournament-panel',
  'screen:draft-stalled',
  'screen:setup',
  'screen:login-connecting',
  'screen:login-error',
  'screen:lobby-error',
  'screen:wizard',
  'screen:staging-player',
  'screen:gameend-game',
  'screen:gameend-match',
  'screen:settings',
  'screen:appearance',
  'screen:about',
  'screen:help',
  'board:pod-4',
  'board:arena-4',
  'board:pod-commander',
  'game:hand-15',
  'game:long-names',
  'global:lang-lobby-ru',
  'global:lang-game-ja',
  'global:zoom-lobby-125',
  'global:reconnecting',
]

async function openGallery(page: Page) {
  await page.addInitScript(() => localStorage.clear())
  await page.route(/^https?:\/\/(?!localhost|127\.0\.0\.1)/, (route) => route.abort())
  // Movimiento reducido a nivel de página: `test.use({ reducedMotion })` no
  // llega a aplicarse en este setup (verificado: matchMedia da false), y sin
  // esto las flechas conservan trazo discontinuo animado cuya fase no es
  // reproducible entre sesiones (WebKit no la congela ni con
  // `animations:'disabled'`). Con `emulateMedia` el CSS de producto
  // (`@media (prefers-reduced-motion: reduce)`) apaga pulsos/glows y deja los
  // trazos sólidos → capturas deterministas.
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto('/#/gallery')
  await expect(page.locator('[data-gallery]')).toBeVisible()
  // Espera a las fuentes antes de montar entradas: las medidas de layout
  // (`useZoneScale`, tarjetas) usan métricas finales y no las de reserva.
  await page.evaluate(() => document.fonts.ready)
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
  // Fuentes tras montar la entrada: las pantallas del juego piden tipografías
  // nuevas al aparecer y un swap tardío cambia métricas a mitad de captura.
  await page.evaluate(() => document.fonts.ready)
  await page.waitForTimeout(250)
  // `CombatArrowsOverlay` mide rects una vez al montar y solo recalcula si el
  // tablero (o la ventana) cambia de tamaño; el primer cálculo puede caer
  // antes de que asiente el escalado de zonas (useZoneScale), y unas sesiones
  // reciben después un tick del ResizeObserver y otras no → geometría de
  // flechas distinta entre sesiones (hasta 9 px; WebKit lo destapó). Forzar el
  // mismo camino de recálculo que usa la app en un resize deja el estado
  // asentado y reproducible.
  await page.evaluate(() => window.dispatchEvent(new Event('resize')))
  await page.waitForTimeout(150)
}

test.describe('galería de estados (P3)', () => {
  test('todas las entradas montan sin errores de página', async ({ page }) => {
    const pageErrors: string[] = []
    page.on('pageerror', (error) => pageErrors.push(String(error)))

    await openGallery(page)
    const ids = await entryIds(page)
    expect(ids.length).toBeGreaterThan(40)
    // El coste crece con la galería (~0,5 s por entrada en local, más del
    // doble en el runner de CI): presupuesto proporcional, no un tope fijo.
    test.setTimeout(Math.max(120_000, ids.length * 2_000))

    for (const id of ids) {
      await showEntry(page, id)
    }

    expect(pageErrors).toEqual([])
  })

  test('el ASK de Slicer sanea {this} con el nombre de la fuente', async ({ page }) => {
    await openGallery(page)
    await showEntry(page, 'prompt:ask-slicer')

    const dialog = page.locator('.feedback-dialog')
    await expect(dialog).toBeVisible()
    await expect(dialog).not.toContainText('{this}')
    await expect(dialog.locator('.dlg-message')).toContainText('Slicer, Hired Muscle')
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
        // El rasterizado de los trazos discontinuos y marcadores SVG de las
        // flechas cambia de una sesión a otra (medido 452–3 504 px en
        // `board:arena-4` a 2560, con jitter estable dentro de cada sesión), así
        // que la capa se oculta (no se enmascara: `.combat-arrows-overlay` mide
        // el tablero entero y un `mask` lo dejaba todo magenta). Su geometría la
        // cubren los e2e de combate.
        // 1200 px restantes absorben el AA del resto del stage (~0,05 %) y
        // siguen fallando ante regresiones reales de layout (decenas de miles).
        stylePath: HIDE_ARROWS_CSS,
        maxDiffPixels: 1200,
      })
    }
  })
})

