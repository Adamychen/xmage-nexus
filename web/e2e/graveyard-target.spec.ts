import { fakeOnly } from './support/fake-mode'
import { test, expect } from './fixtures'
import { FAKE_MODE } from './dual'
fakeOnly()
import { reanimateTargetScenario } from '../fixtures/scenarios/reanimateTarget'
import { startGame } from './support/start-game'
import { withFakeServer } from './support/fake-backend'
import { payMana } from './support/game-screen'
import { lastGameView, myBattlefield, parseFrames, playableInView, waitFrame } from './support/frames'

/**
 * Regresión del gap encontrado en real (commit 8290f779a45): PileOverlay
 * (el visor de cementerio/exilio/biblioteca) nunca recibía targetIds/
 * onTargetClick, así que una carta que YA reposaba en esas zonas no tenía
 * onClick cuando un efecto de OTRA fuente la apuntaba como objetivo. Todos
 * los e2e de cross-zone existentes (cross-zone.spec.ts) prueban LANZAR una
 * carta desde el cementerio/exilio; ninguno probaba clicar una carta ya
 * asentada ahí como target. Reanimate (mano) -> Grizzly Bears (cementerio
 * propio, NO jugable desde ahí) reproduce exactamente ese path.
 */
test(
  'objetivo dentro del cementerio via PileOverlay: Reanimate apunta a Grizzly Bears @graveyard-target',
  async ({ page }) => {
    await withFakeServer(() => reanimateTargetScenario(), async () => {
      const { frames, pageErrors, helper } = await startGame(page, {
        prefix: 'gyt',
        tableName: 'reanimate-target-test',
      })

      // (a) lanzar Reanimate desde la mano (WS directo; lo que se prueba es el
      //     targeting dentro de la pila, no el cast en sí).
      let reanimateId: string | null = null
      const castDeadline = Date.now() + 20_000
      while (Date.now() < castDeadline && !reanimateId) {
        reanimateId = playableInView(lastGameView(parseFrames(frames)), 'Reanimate')
        if (!reanimateId) await page.waitForTimeout(200)
      }
      expect(reanimateId, 'Reanimate debería ser jugable desde la mano').toBeTruthy()
      expect(await helper.playCard(reanimateId!), 'Reanimate debería lanzarse por WS').toBeTruthy()

      // (b) GAME_TARGET real: "Select target creature card in a graveyard"
      await waitFrame(page, (f) => f.method === 'GAME_TARGET', 'GAME_TARGET de Reanimate')

      // (c) abrir el cementerio (PileOverlay) desde la resource bar — ANTES del
      //     fix esta carta no tenía onClick porque el overlay no recibía
      //     targetIds/onTargetClick.
      // [data-graveyard-count] existe para mí y para el rival: el nuestro es el
      // único con 1 carta (Grizzly Bears).
      await page.locator('[data-graveyard-count="1"]').click()
      const overlay = page.locator('.pile-overlay')
      await expect(overlay, 'el visor del cementerio debería abrirse').toBeVisible({ timeout: 10_000 })
      const target = overlay.locator('.pile-card[data-card-name="Grizzly Bears"], .pile-card').first()
      await expect(target, 'Grizzly Bears debería verse en el cementerio').toBeVisible({ timeout: 10_000 })

      // (d) clic en la carta objetivo dentro de la pila: debe enviar
      //     sendPlayerUUID(REANIMATE_GRIZZLY_ID) y el escenario solo avanza al
      //     pago de maná si el id coincide con el target esperado (si el clic no
      //     hiciera nada, o mandara el id equivocado, esto haría timeout).
      await target.click()
      await waitFrame(page, (f) => f.method === 'GAME_PLAY_MANA', 'GAME_PLAY_MANA tras elegir el objetivo del cementerio', 15_000)

      // (e) pagar y resolver: Grizzly Bears pasa a nuestro campo.
      await payMana(page, helper)
      await waitFrame(
        page,
        (f) => {
          const view = lastGameView(parseFrames([f]))
          return Object.values(myBattlefield(view)).some((c) => c.name === 'Grizzly Bears')
        },
        'Grizzly Bears reanimado en el campo propio',
        15_000,
      )

      expect(pageErrors, `pageerrors: ${pageErrors.map(String).join(' | ')}`).toEqual([])
    })
  },
)
