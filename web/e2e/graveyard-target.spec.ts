import { fakeOnly } from './support/fake-mode'
import { test, expect } from './fixtures'
import { FAKE_MODE } from './dual'
fakeOnly()
import * as fs from 'node:fs'
import * as path from 'node:path'
import { fileURLToPath } from 'node:url'
import { REANIMATE_GRIZZLY_ID, reanimateTargetScenario } from '../fixtures/scenarios/reanimateTarget'
import { startGame } from './support/start-game'
import { withFakeServer } from './support/fake-backend'
import { payMana } from './support/game-screen'
import { waitSceneTargeting } from './support/scene'
import { lastGameView, myBattlefield, parseFrames, playableInView, waitFrame } from './support/frames'

const SHOTS_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), 'shots')

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

      // (c) target zone (targetZone GRAVEYARD): the pile is highlighted and
      //     auto-opens, so the player doesn't have to guess where the card is.
      const targeting = await waitSceneTargeting(
        page,
        (t) => t.active && t.zone === 'graveyard',
        'targeting with GRAVEYARD zone',
      )
      expect(targeting.ids).toContain(REANIMATE_GRIZZLY_ID)
      // [data-graveyard-count] exists for me and the opponent: ours is the
      // only one with 1 card (Grizzly Bears).
      const graveyardStack = page.locator('[data-graveyard-count="1"]')
      await expect(graveyardStack, 'the graveyard pile should be highlighted').toHaveClass(
        /target-zone/,
        { timeout: 10_000 },
      )
      const overlay = page.locator('.pile-overlay')
      await expect(overlay, 'the graveyard viewer should auto-open').toBeVisible({ timeout: 10_000 })
      const target = overlay.locator('.pile-card[data-card-name="Grizzly Bears"], .pile-card').first()
      await expect(target, 'Grizzly Bears should be visible in the graveyard').toBeVisible({ timeout: 10_000 })

      // visual evidence (not an assertion): zone highlight + auto-opened pile
      fs.mkdirSync(SHOTS_DIR, { recursive: true })
      const shot = path.join(SHOTS_DIR, 'graveyard-target-zone.png')
      await page.screenshot({ path: shot })
      await test.info().attach('graveyard-target-zone', { body: fs.readFileSync(shot), contentType: 'image/png' })

      // (d) click the target card inside the pile: it must send
      //     sendPlayerUUID(REANIMATE_GRIZZLY_ID) and the scenario only advances
      //     to mana payment when the id matches (a dead click or a wrong id
      //     would time out). When the targeting ends, the auto-opened pile
      //     closes so it doesn't cover the mana payment.
      await target.click()
      await waitFrame(page, (f) => f.method === 'GAME_PLAY_MANA', 'GAME_PLAY_MANA after picking the graveyard target', 15_000)
      await expect(overlay, 'the pile should close when the targeting ends').toBeHidden({ timeout: 10_000 })

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
