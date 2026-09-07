import { test, expect } from './fixtures'
import { fakeOnly } from './support/fake-mode'
import { withFakeServer } from './support/fake-backend'
import { tournamentScenario } from '../fixtures/scenarios/tournament'
import { login } from './support/start-game'
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
              { games: [{ roundNum: 2, state: 'Dueling', players: 'alice vs diana', result: '', tableId: 'table-g2', gameId: 'game-g2' }] },
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
    // T1: eye per live match watches it (FakeServer acks watchTournamentTable)
    const eye = panel.locator('[data-testid="bracket-watch"]').first()
    await expect(eye).toBeVisible()
    await eye.click()
    await expect(panel.locator('[data-testid="tournament-modal-error"]')).toHaveCount(0)
  })

  test('bracket modal eye watches a live match over WS (T1)', async ({ page }) => {
    await withFakeServer(() => tournamentScenario(), async () => {
      await login(page, 'e2e')
      const bracketBtn = page.getByTestId('open-bracket').first()
      await expect(bracketBtn).toBeVisible({ timeout: 10_000 })
      await bracketBtn.click()
      const modal = page.locator('[data-testid="tournament-bracket"]').first()
      await expect(modal).toBeVisible({ timeout: 10_000 })
      // server view has 4 games with gameIds → 4 watch buttons
      const eyes = modal.locator('[data-testid="bracket-watch"]')
      await expect(eyes).toHaveCount(4, { timeout: 10_000 })
      await eyes.first().click()
      await expect(modal.locator('[data-testid="tournament-modal-error"]')).toHaveCount(0)
    })
  })
})
