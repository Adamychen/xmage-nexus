import { fakeOnly } from './support/fake-mode'
import { TABLE } from '../fixtures/table-names'
import { test, expect } from './fixtures'
import { FAKE_MODE } from './dual'
fakeOnly()
import { startGame } from './support/start-game'
import { withFakeServer } from './support/fake-backend'
import { thoughtseizeScenario } from '../fixtures/scenarios/thoughtseize'

test('descarte interactivo desde mano revelada (Thoughtseize) @reveal', async ({ page }) => {
  await withFakeServer(
    () => thoughtseizeScenario(),
    async () => {
      const { pageErrors } = await startGame(page, {
        prefix: 'rv',
        tableName: TABLE.thoughtseize,
        skipAsks: true,
      })

      // El diálogo de selección (grilla HD) debe aparecer con la mano revelada
      const dialog = page.locator('.card-grid-dialog')
      await expect(dialog).toBeVisible({ timeout: 15_000 })
      await expect(dialog).toContainText('Elige una carta para que descarte')
      await expect(dialog).toContainText('Lightning Bolt')
      await expect(dialog).toContainText('Counterspell')
      await expect(dialog).toContainText('Serra Angel')

      // La mano del oponente se muestra boca arriba en la zona revelada
      const oppZone = page.locator('.opponent-zone').first()
      await expect(oppZone).toContainText('Lightning Bolt')

      // El humano elige una carta -> la grilla envía sendPlayerUUID (descarte) y
      // el diálogo se cierra (clearFeedback tras envío OK).
      await page
        .evaluate(() => {
          const el = Array.from(document.querySelectorAll('.card-grid-cell')).find((e) =>
            e.textContent?.includes('Counterspell'),
          ) as HTMLElement | undefined
          el?.click()
        })
      await expect(page.locator('.card-grid-dialog')).toHaveCount(0, { timeout: 10_000 })

      // Tras el descarte la mano revelada del oponente queda en 2 cartas (sin
      // Counterspell). Esperamos el estado final estable antes de afirmar.
      await expect(oppZone.locator('.hand-card-slot')).toHaveCount(2, { timeout: 15_000 })
      await expect(oppZone).not.toContainText('Counterspell', { timeout: 10_000 })
      await expect(oppZone).toContainText('Lightning Bolt')
      await expect(oppZone).toContainText('Serra Angel')

      expect(pageErrors).toEqual([])
    },
  )
})
