import { fakeOnly } from './support/fake-mode'
import { TABLE } from '../fixtures/table-names'
import { DECK } from '../fixtures/deck-names'
/**
 * Visores looked-at / companion (G12-2, U12): el GAME_INIT estático los trae
 * y las ventanas se abren solas con sus cartas.
 */

import { test, expect } from './fixtures'
fakeOnly()
import { infoWindowsScenario } from '../fixtures/scenarios/infoWindows'
import { withFakeServer } from './support/fake-backend'
import { startGame } from './support/start-game'
import { parseSent, sentOf } from './support/frames'

test('info windows: lookedAt y companion se abren solos con sus cartas', { tag: '@game' }, async ({ page }) => {
  await withFakeServer(() => infoWindowsScenario(), async () => {
    const { pageErrors } = await startGame(page, {
      prefix: 'infow',
      tableName: TABLE.infoWindows,
      deck: DECK.lands,
      simDeck: DECK.aiLands,
    })

    const overlays = page.locator('.pile-overlay')
    await expect(overlays.first()).toBeVisible({ timeout: 15_000 })
    await expect(page.locator('.pile-overlay', { hasText: 'Scry Card' })).toBeVisible()
    await expect(page.locator('.pile-overlay', { hasText: 'Lurrus of the Dream-Den' })).toBeVisible()

    // G12-4: el permanente faseado no se pinta; el resto sí.
    const myZone = page.locator('.board-zone.player-zone')
    await expect(myZone).toContainText('Steady Guy')
    await expect(myZone).not.toContainText('Phased Out Guy')

    // Issue #3: el compañero anunciado en canPlayObjects es clicable desde su
    // visor (paridad con el CardInfoWindowDialog del desktop) y envía su UUID.
    const companionCard = page.locator('.pile-overlay', { hasText: 'Lurrus of the Dream-Den' }).locator('.card-slot.playable')
    await expect(companionCard, 'Lurrus jugable (pagable {3}) en el visor').toBeVisible()
    await companionCard.click()
    await expect
      .poll(() => parseSent(sentOf(page)).some((f) => f.action === 'sendPlayerUUID' && f.args?.value === 'c-1'), {
        timeout: 10_000,
        message: 'clic en el compañero debe enviar sendPlayerUUID(c-1)',
      })
      .toBe(true)

    expect(pageErrors, `pageerrors: ${pageErrors.map(String).join(' | ')}`).toEqual([])
  })
})
