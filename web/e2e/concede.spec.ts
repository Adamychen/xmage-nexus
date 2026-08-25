import { fakeOnly } from './support/fake-mode'
import { TABLE } from '../fixtures/table-names'
import { DECK } from '../fixtures/deck-names'
/**
 * Concede real: el botón "Conceder" del jugador envía PlayerAction.CONCEDE al
 * servidor (no solo abandona la pantalla) y la partida termina correctamente,
 * volviendo al lobby. Verifica el cableado CONCEDE y el retorno al lobby.
 */

import { test, expect } from './fixtures'
import { FAKE_MODE } from './dual'
fakeOnly()
import { concedeScenario } from '../fixtures/scenarios/concede'
import { withFakeServer } from './support/fake-backend'
import { startGame } from './support/start-game'
import { parseSent, sentOf } from './support/frames'

test('concede: el humano envía CONCEDE y vuelve al lobby', { tag: '@fullflow' }, async ({ page }) => {
  await withFakeServer(() => concedeScenario(), async () => {
    const { pageErrors } = await startGame(page, {
      prefix: 'concede',
      tableName: TABLE.concede,
      deck: DECK.lands,
      simDeck: DECK.aiLands,
    })

    // aceptar el confirm() de "¿Seguro que quieres conceder...?"
    page.on('dialog', (d) => void d.accept())

    await expect(page.locator('.leave-game-btn')).toBeVisible({ timeout: 15_000 })
    await page.locator('.leave-game-btn').click()

    // el servidor recibió CONCEDE y la partida terminó (GAME_OVER emitido)
    await expect
      .poll(
        () =>
          parseSent(sentOf(page)).some(
            (s) => s.action === 'sendPlayerAction' && String(s.args?.action) === 'CONCEDE',
          ),
        { timeout: 10_000 },
      )
      .toBeTruthy()

    // vuelve al lobby
    await expect(page.getByRole('heading', { name: /Lobby|XMage Nexus/i })).toBeVisible({ timeout: 15_000 })

    expect(pageErrors, `pageerrors: ${pageErrors.map(String).join(' | ')}`).toEqual([])
  })
})
