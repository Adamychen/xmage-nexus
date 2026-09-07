import { fakeOnly } from './support/fake-mode'
import { TABLE } from '../fixtures/table-names'
import { DECK } from '../fixtures/deck-names'
/**
 * Menú de jugador (G12-1/G12-2, U12): clic derecho en la barra del jugador
 * abre el menú contextual por bando y cada item envía su PlayerAction
 * al servidor (verificado por frame WS enviado).
 */

import { test, expect } from './fixtures'
import type { Page } from '@playwright/test'
import { FAKE_MODE } from './dual'
fakeOnly()
import { playerMenuScenario } from '../fixtures/scenarios/playerMenu'
import { withFakeServer } from './support/fake-backend'
import { startGame } from './support/start-game'
import { parseSent, sentOf } from './support/frames'

async function openMenu(page: Page, side: 'my' | 'opp') {
  await page.locator(`.player-info-bar.${side}`).first().click({ button: 'right' })
  await expect(page.locator('.context-menu')).toBeVisible({ timeout: 10_000 })
}

test('player menu: rival ofrece pedir ver la mano y lo envía', { tag: '@game' }, async ({ page }) => {
  await withFakeServer(() => playerMenuScenario(), async () => {
    const { pageErrors } = await startGame(page, {
      prefix: 'pmenu',
      tableName: TABLE.playerMenu,
      deck: DECK.lands,
      simDeck: DECK.aiLands,
    })

    await openMenu(page, 'opp')
    await expect(page.getByTestId('ctx-request-hand')).toBeVisible()
    await expect(page.getByTestId('ctx-view-deck')).toBeVisible()
    await page.getByTestId('ctx-request-hand').click()

    await expect
      .poll(
        () =>
          parseSent(sentOf(page)).some(
            (s) =>
              s.action === 'sendPlayerAction' &&
              String(s.args?.action) === 'REQUEST_PERMISSION_TO_SEE_HAND_CARDS' &&
              typeof s.args?.data === 'string',
          ),
        { timeout: 10_000 },
      )
      .toBeTruthy()

    expect(pageErrors, `pageerrors: ${pageErrors.map(String).join(' | ')}`).toEqual([])
  })
})

test('player menu: propia permite revocar y alternar peticiones', { tag: '@game' }, async ({ page }) => {
  await withFakeServer(() => playerMenuScenario(), async () => {
    const { pageErrors } = await startGame(page, {
      prefix: 'pmenu2',
      tableName: TABLE.playerMenu,
      deck: DECK.lands,
      simDeck: DECK.aiLands,
    })

    await openMenu(page, 'my')
    await expect(page.getByTestId('ctx-allow-hand')).toBeVisible()
    await expect(page.getByTestId('ctx-revoke-hand')).toBeVisible()
    await expect(page.getByTestId('ctx-view-sideboard')).toBeVisible()

    // El menú cabe entero en el viewport aunque se abra en la barra inferior.
    const box = await page.locator('.context-menu').boundingBox()
    const viewport = page.viewportSize()
    expect(box, 'menú con caja medible').not.toBeNull()
    expect(viewport, 'viewport conocido').not.toBeNull()
    if (box && viewport) {
      expect(box.x).toBeGreaterThanOrEqual(0)
      expect(box.y).toBeGreaterThanOrEqual(0)
      expect(box.x + box.width).toBeLessThanOrEqual(viewport.width)
      expect(box.y + box.height).toBeLessThanOrEqual(viewport.height)
    }

    await page.getByTestId('ctx-allow-hand').click()
    await expect
      .poll(
        () =>
          parseSent(sentOf(page)).some(
            (s) =>
              s.action === 'sendPlayerAction' &&
              (String(s.args?.action) === 'PERMISSION_REQUESTS_ALLOWED_OFF' ||
                String(s.args?.action) === 'PERMISSION_REQUESTS_ALLOWED_ON'),
          ),
        { timeout: 10_000 },
      )
      .toBeTruthy()

    await openMenu(page, 'my')
    await page.getByTestId('ctx-revoke-hand').click()
    await expect
      .poll(
        () =>
          parseSent(sentOf(page)).some(
            (s) => s.action === 'sendPlayerAction' && String(s.args?.action) === 'REVOKE_PERMISSIONS_TO_SEE_HAND_CARDS',
          ),
        { timeout: 10_000 },
      )
      .toBeTruthy()

    expect(pageErrors, `pageerrors: ${pageErrors.map(String).join(' | ')}`).toEqual([])
  })
})
