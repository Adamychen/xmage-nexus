import { fakeOnly } from './support/fake-mode'
import { TABLE } from '../fixtures/table-names'
import { DECK } from '../fixtures/deck-names'
/**
 * Match best-of-N (winsNeeded > 1, cierre 1v1 real): tras cada partida llega
 * END_GAME_INFO (resumen + marcador), el servidor pide el mazo con SIDEBOARD y
 * el web lo devuelve (submitDeck), y arranca la siguiente partida del match
 * (START_GAME con gameId NUEVO). Al llegar a winsNeeded, END_GAME_INFO marca
 * "won the match!" y el diálogo vuelve al lobby.
 *
 * El MISMO flujo corre en fake (escenario determinista: 7 Bolts × 3 de daño
 * por partida) y en real (el humano quema al Sim con Bolts de verdad).
 */

import { test, expect } from './fixtures'
fakeOnly()
import { bestOfNScenario } from '../fixtures/scenarios/bestOfN'
import { withFakeServer } from './support/fake-backend'
import { startGame } from './support/start-game'
import { currentGameId, framesOf, parseFrames, parseSent, sentOf, waitFrame, waitFrameAt } from './support/frames'
import { dumpE2E, winGameWithBolts } from './support/game-screen'

/** Marca el fin de una partida (GAME_OVER + END_GAME_INFO del match). */
function endInfoOf(page: import('@playwright/test').Page): { matchInfo?: string; wins?: number; winsNeeded?: number } | null {
  const parsed = parseFrames(framesOf(page))
  const end = [...parsed].reverse().find((f) => f.method === 'END_GAME_INFO')
  return (end?.data ?? null) as { matchInfo?: string; wins?: number; winsNeeded?: number } | null
}

test('match best-of-N: END_GAME_INFO + SIDEBOARD + submitDeck + siguiente partida, y fin del match', { tag: '@fullflow' }, async ({ page }) => {
  await withFakeServer(() => bestOfNScenario(), async () => {
    const { helper, pageErrors } = await startGame(page, {
      prefix: 'bon',
      tableName: TABLE.bestOfN,
      deck: DECK.bolt,
      simDeck: DECK.aiLands,
      winsNeeded: 2,
    })

    // ── partida 1: el humano gana con Bolts ────────────────────────────────
    const game1Id = currentGameId(page)
    expect(game1Id, 'gameId de la partida 1').toBeTruthy()
    try {
      await winGameWithBolts(page, helper, game1Id!)
    } catch (e) {
      dumpE2E(page, 'bestofn-game1')
      throw e
    }

    // resumen intermedio: el match continúa (falta 1 victoria). El diálogo solo
    // es visible mientras el servidor espera los sideboards (en fake es casi
    // instantáneo), así que la aserción va sobre los FRAMES del END_GAME_INFO.
    const endFrame = await waitFrame(
      page,
      (f) => f.method === 'END_GAME_INFO' && /one more win/i.test(String((f.data as { matchInfo?: string } | null)?.matchInfo ?? '')),
      'END_GAME_INFO intermedio (falta 1 victoria)',
      20_000,
    )
    expect((endFrame.data as { wins?: number } | null)?.wins, 'wins=1 tras la partida 1').toBe(1)
    expect((endFrame.data as { winsNeeded?: number } | null)?.winsNeeded, 'winsNeeded=2').toBe(2)

    // SIDEBOARD: el servidor pide el mazo y el web lo devuelve
    const sideboard = await waitFrameAt(page, (f) => f.method === 'SIDEBOARD', 'SIDEBOARD tras la partida 1')
    await expect
      .poll(() => parseSent(sentOf(page)).some((s) => s.action === 'submitDeck'), { timeout: 10_000 })
      .toBeTruthy()

    // partida 2: START_GAME con gameId NUEVO + GAME_INIT (el diálogo se cierra).
    // OJO: waitFrame sin cursor re-matchearía el START_GAME de la PARTIDA 1.
    const start2 = await waitFrameAt(page, (f) => f.method === 'START_GAME', 'START_GAME de la partida 2', 30_000, sideboard.index + 1)
    expect(start2.frame.objectId, 'la partida 2 debe tener un gameId distinto').toBeTruthy()
    await waitFrame(
      page,
      (f) => f.method === 'GAME_INIT' && f.objectId === start2.frame.objectId,
      'GAME_INIT de la partida 2',
      20_000,
      start2.index + 1,
    )

    // ── partida 2: el humano vuelve a ganar → el match termina ──────────────
    try {
      await winGameWithBolts(page, helper, start2.frame.objectId ?? '')
    } catch (e) {
      dumpE2E(page, 'bestofn-game2')
      throw e
    }
    try {
      await expect(page.locator('.end-dialog')).toContainText(/Tú gana el match|Has ganado el match|You won the match|You win the match/i, { timeout: 20_000 })
    } catch (e) {
      dumpE2E(page, 'bestofn-matchover')
      throw e
    }
    const end2 = endInfoOf(page)
    expect(end2?.wins, 'wins=2 al final del match').toBe(2)
    expect(end2?.matchInfo ?? '', 'matchInfo debería marcar el match ganado').toMatch(/won the match/i)

    // vuelta al lobby con el resumen
    await page.getByRole('button', { name: 'Volver al lobby' }).click()
    await expect(page.getByRole('heading', { name: /Lobby|XMage Nexus/i })).toBeVisible({ timeout: 15_000 })
    expect(pageErrors, `pageerrors: ${pageErrors.map(String).join(' | ')}`).toEqual([])
  })
})
