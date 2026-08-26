import { test, expect } from './fixtures'
import { fakeOnly } from './support/fake-mode'
fakeOnly()

test.describe('Tournament', { tag: '@tournament' }, () => {
  test('tournament bracket renders via injected state', async ({ page }) => {
    await page.goto('/')
    await expect(page.locator('body')).toBeVisible({ timeout: 10_000 })
    await page.waitForTimeout(400)
    await page.evaluate(() => {
      const store = (globalThis as unknown as { __mageStore?: { setState: (s: unknown) => void } }).__mageStore
      const now = Date.now()
      store?.setState({
        tournament: {
          tournamentId: 'tournament-test-1',
          view: {
            tournamentName: 'Commander Clash',
            tournamentType: 'Swiss',
            tournamentState: 'Dueling',
            startTime: now - 3600_000,
            endTime: null,
            stepStartTime: now - 90000,
            serverTime: now,
            constructionTime: 600,
            watchingAllowed: true,
            rounds: [
              { games: [{ roundNum: 1, state: 'Finished', players: 'alice vs bob', result: '2-0', tableId: 'table-g1' }] },
              { games: [{ roundNum: 2, state: 'Dueling', players: 'alice vs diana', result: '', tableId: 'table-g2' }] },
            ],
            players: [
              { name: 'alice', state: 'Dueling', points: 6, results: '2-0', history: 'W-W', quit: false },
              { name: 'bob', state: 'Dueling', points: 3, results: '1-1', history: 'W-L', quit: false },
              { name: 'charlie', state: 'Eliminated', points: 0, results: '0-2', history: 'L-L', quit: true },
            ],
            runningInfo: 'Ronda 2 en curso',
          },
        },
        phase: 'lobby',
      })
    })
    // Open bracket via lobby modal — inject a fake tournament table and click Ver bracket
    await page.waitForTimeout(300)
    // The in-lobby TournamentPanel is not shown; instead inject a direct bracket modal by calling setState for lobby tournament view?
    // Simpler: verify that our injected TournamentPanel would appear in GameScreen when phase=game
    await page.evaluate(() => {
      const store = (globalThis as unknown as { __mageStore?: { getState: () => unknown; setState: (s: unknown) => void } }).__mageStore
      // Force GameScreen render by setting phase to game so TournamentPanel appears
      const s = (store as unknown as { getState: () => { tournament: unknown } }).getState() as unknown as { tournament: unknown }
      store?.setState({ phase: 'game', tournament: (s as unknown as { tournament: unknown }).tournament })
    })
    await page.waitForTimeout(300)
    const panel = page.locator('[data-testid="tournament-panel"]').first()
    await expect(panel).toBeVisible({ timeout: 10_000 })
    await expect(panel.locator('[data-testid="tournament-name"]').first()).toContainText('Commander Clash')
    await expect(panel.locator('[data-testid="tournament-state"]').first()).toContainText('Dueling')
    await expect(panel.locator('[data-testid="bracket-round"]').first()).toBeVisible()
    await expect(panel.locator('[data-testid="standings-row"]').first()).toBeVisible()
    await expect(panel.locator('[data-testid="standings-quit"]').first()).toBeVisible()
  })

  test('bracket modal via Ver bracket button for tournament table', async ({ page }) => {
    await page.goto('/')
    await expect(page.locator('body')).toBeVisible({ timeout: 10_000 })
    await page.waitForTimeout(400)
    // Inject a lobby with a tournament table
    await page.evaluate(() => {
      const store = (globalThis as unknown as { __mageStore?: { setState: (s: unknown) => void } }).__mageStore
      const now = Date.now()
      const tables = [
        {
          tableId: 'table-tourney-1',
          gameType: 'Commander / Free For All',
          deckType: 'Commander',
          tableName: 'Mesa Torneo Commander',
          controllerName: 'host',
          additionalInfoShort: '3/4',
          additionalInfoFull: '',
          createTime: now,
          tableState: 'WAITING',
          skillLevel: 'Casual',
          tableStateText: 'Esperando',
          seatsInfo: '3/4',
          isTournament: true,
          seats: [
            { playerName: 'host', seatIndex: 0, playerType: 'HUMAN' },
            { playerName: 'alice', seatIndex: 1, playerType: 'HUMAN' },
            { playerName: '', seatIndex: 2, playerType: 'HUMAN' },
            { playerName: '', seatIndex: 3, playerType: 'HUMAN' },
          ],
          games: [],
          quitRatio: '100',
          minimumRating: '0',
          limited: false,
          rated: false,
          passworded: false,
          spectatorsAllowed: true,
        },
      ]
      store?.setState({
        lobby: {
          type: 'lobby',
          tables,
          users: { numberActiveGames: 0, numberGameThreads: 0, numberMaxGames: 10, usersView: [] },
          serverMessages: [],
        },
        tournament: {
          tournamentId: 'table-tourney-1',
          view: {
            tournamentName: 'Mesa Torneo Commander',
            tournamentType: 'Swiss',
            tournamentState: 'Waiting',
            startTime: now,
            endTime: null,
            stepStartTime: now - 30000,
            serverTime: now,
            constructionTime: 300,
            watchingAllowed: true,
            rounds: [{ games: [{ roundNum: 1, state: 'Ready', players: 'host vs alice', result: '' }] }],
            players: [
              { name: 'host', state: 'Waiting', points: 0, quit: false },
              { name: 'alice', state: 'Waiting', points: 0, quit: false },
            ],
            runningInfo: 'Esperando jugadores',
          },
        },
        phase: 'lobby',
      })
    })
    await page.waitForTimeout(300)
    const bracketBtn = page.getByRole('button', { name: /Ver bracket/i }).first()
    await expect(bracketBtn).toBeVisible({ timeout: 10_000 })
    await bracketBtn.click()
    await page.waitForTimeout(300)
    const modal = page.locator('[data-testid="tournament-bracket"]').first()
    await expect(modal).toBeVisible({ timeout: 10_000 })
    await expect(modal.locator('[data-testid="tournament-name"]').first()).toContainText(/Torneo|Mesa Torneo Commander|Commander/i)
  })
})
