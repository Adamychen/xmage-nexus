import { TABLE } from '../fixtures/table-names'
import { test, expect } from './fixtures'
import { fakeOnly } from './support/fake-mode'
import { withFakeServer } from './support/fake-backend'
import { startGame } from './support/start-game'
import { tokensScenario } from '../fixtures/scenarios/tokens'
fakeOnly()

const ROT_90 = 'matrix(0, 1, -1, 0, 0, 0)'

/**
 * El giro de una carta (`.tapped`) vive en `transform`, y una animación o un
 * `:hover` que también escriba `transform` lo sustituye mientras dura: la carta
 * se endereza sola. Ocurría al montar cualquier carta girada (`entering`, p. ej.
 * al reagrupar/desagrupar pilas cuando se abre una ventana de selección) y al
 * pasar el ratón por encima. Los efectos deben usar las propiedades
 * independientes `translate`/`scale`, que se componen con el giro.
 */
test.describe('Rotación de cartas giradas', () => {
  test('una carta girada nunca se endereza por hover ni al montarse @fullflow @tapped', async ({ page }) => {
    await withFakeServer(tokensScenario, async () => {
      const { pageErrors } = await startGame(page, { prefix: 'tap', tableName: TABLE.tokens })

      const tapped = page.locator('[data-card-id="treasure-5"]')
      await expect(tapped).toBeVisible({ timeout: 30_000 })
      await expect(tapped).toHaveClass(/tapped/)

      // En reposo: girada 90°.
      const idle = await tapped.evaluate((el) => getComputedStyle(el).transform)
      expect(idle, 'una carta girada debe estar rotada 90° en reposo').toBe(ROT_90)

      // Hover: sigue girada, y el alzado va por `translate` (eje de pantalla),
      // no por `transform`, que rotaría el desplazamiento con la carta.
      await tapped.hover()
      await page.waitForTimeout(350)
      const hovered = await tapped.evaluate((el) => {
        const cs = getComputedStyle(el)
        return { transform: cs.transform, translate: cs.translate }
      })
      expect(hovered.transform, 'el hover no puede enderezar una carta girada').toBe(ROT_90)
      expect(hovered.translate, 'el alzado del hover va en `translate`').toBe('0px -6px')

      // Montaje (`entering`): la animación de aparición no puede tocar el giro
      // en ningún fotograma. Elemento sintético para medir la ventana entera
      // sin que React reescriba las clases a media animación.
      const angles = await page.evaluate(async () => {
        const host = document.querySelector('.player-zone') ?? document.body
        const el = document.createElement('div')
        el.className = 'card-slot tapped entering'
        host.appendChild(el)
        const out: number[] = []
        for (let i = 0; i < 14; i++) {
          const m = /matrix\(([^)]+)\)/.exec(getComputedStyle(el).transform)
          const [a, b] = m ? m[1].split(',').map(Number) : [1, 0]
          out.push(Math.round(Math.abs((Math.atan2(b, a) * 180) / Math.PI)))
          await new Promise((r) => setTimeout(r, 20))
        }
        el.remove()
        return out
      })
      expect(
        angles.filter((a) => a !== 90),
        `la animación de aparición enderezó la carta en ${angles.filter((a) => a !== 90).length} muestras (${angles.join(',')})`,
      ).toEqual([])

      expect(pageErrors).toEqual([])
    })
  })
})
