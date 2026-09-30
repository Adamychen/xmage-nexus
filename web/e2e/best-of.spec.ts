import { fakeOnly } from './support/fake-mode'
import { TABLE } from '../fixtures/table-names'
import { DECK } from '../fixtures/deck-names'
import type { Scenario } from '../fixtures/fake'
/**
 * Matches best-of-N (first to winsNeeded): partidas encadenadas con
 * END_GAME_INFO + marcador, SIDEBOARD + submitDeck entre partidas y cierre del
 * match al llegar a winsNeeded. `simWinsGame` inyecta las partidas que gana el
 * Sim (1-1 antes del game decisivo en Bo3; sweep 3-0 en Bo5).
 */

import { test, expect } from './fixtures'
import { FAKE_MODE } from './dual'
fakeOnly()
import { bestOf3Scenario } from '../fixtures/scenarios/bestOf3'
import { bestOf5Scenario } from '../fixtures/scenarios/bestOf5'
import { withFakeServer } from './support/fake-backend'
import { startGame } from './support/start-game'
import { currentGameId, parseSent, sentOf, waitFrameAt } from './support/frames'
import { winGameWithBolts } from './support/game-screen'

interface SeriesCase {
  title: string
  prefix: string
  tableName: string
  scenario: () => Scenario
  winsNeeded: number
  simWinsGame: number[]
}

const SERIES: SeriesCase[] = [
  {
    title: 'best-of-3: el match se decide en game 3 (1-1 antes)',
    prefix: 'bo3',
    tableName: TABLE.bestOf3,
    scenario: bestOf3Scenario,
    winsNeeded: 2,
    simWinsGame: [2],
  },
  {
    title: 'best-of-5: sweep 3-0, match terminado en game 3 sin SIDEBOARD extra',
    prefix: 'bo5',
    tableName: TABLE.bestOf5,
    scenario: bestOf5Scenario,
    winsNeeded: 3,
    simWinsGame: [],
  },
]

for (const series of SERIES) {
  test(series.title, { tag: '@fullflow' }, async ({ page }) => {
    // Tres partidas completas + dos sideboards: en el runner de CI supera los 120 s por defecto.
    test.setTimeout(300_000)
    await withFakeServer(series.scenario, async () => {
      const { helper, pageErrors } = await startGame(page, {
        prefix: series.prefix,
        tableName: series.tableName,
        deck: DECK.bolt,
        simDeck: DECK.aiLands,
        winsNeeded: series.winsNeeded,
      })

      let wins = 0
      let loses = 0
      let cursor = 0
      for (let game = 1; game <= 2 * series.winsNeeded - 1; game++) {
        const gameId = currentGameId(page)
        expect(gameId, `gameId de la partida ${game}`).toBeTruthy()
        await winGameWithBolts(page, helper, gameId!)
        if (series.simWinsGame.includes(game)) loses++
        else wins++

        const end = await waitFrameAt(page, (f) => f.method === 'END_GAME_INFO', `END_GAME_INFO tras game ${game}`, 20_000, cursor)
        const endData = end.frame.data as { wins?: number; loses?: number; winsNeeded?: number } | null
        expect(endData?.wins, `wins=${wins} tras game ${game}`).toBe(wins)
        expect(endData?.loses, `loses=${loses} tras game ${game}`).toBe(loses)
        expect(endData?.winsNeeded, `winsNeeded=${series.winsNeeded} tras game ${game}`).toBe(series.winsNeeded)
        cursor = end.index + 1

        if (wins === series.winsNeeded) break

        const sideboard = await waitFrameAt(page, (f) => f.method === 'SIDEBOARD', `SIDEBOARD tras game ${game}`, 30_000, cursor)
        await expect
          .poll(() => parseSent(sentOf(page)).some((s) => s.action === 'submitDeck'), { timeout: 10_000 })
          .toBeTruthy()
        const start = await waitFrameAt(page, (f) => f.method === 'START_GAME', `START_GAME game ${game + 1}`, 30_000, sideboard.index + 1)
        cursor = start.index + 1
      }

      await expect(page.locator('.end-dialog')).toContainText(/Tú gana el match|Has ganado el match|You won the match|You win the match/i, { timeout: 20_000 })
      expect(wins, `wins=${series.winsNeeded} al ganar el match`).toBe(series.winsNeeded)

      await page.getByRole('button', { name: 'Volver al lobby' }).click()
      await expect(page.getByRole('heading', { name: /Lobby|XMage Nexus/i })).toBeVisible({ timeout: 15_000 })
      expect(pageErrors, `pageerrors: ${pageErrors.map(String).join(' | ')}`).toEqual([])
    })
  })
}
