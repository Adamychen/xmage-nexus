import type { Page } from '@playwright/test'
import { test, expect } from './fixtures'
import { fakeOnly } from './support/fake-mode'
import { withFakeServer } from './support/fake-backend'
import { makeTournamentScenario, tournamentScenario } from '../fixtures/scenarios/tournament'
import { dismissSetupWizard, installCapture, login, openCreateDialog, type CaptureBuffers } from './support/start-game'
fakeOnly()

function injectTournamentPanel(page: Page) {
  return page.evaluate(() => {
    const store = (globalThis as unknown as { __mageStore?: { setState: (s: unknown) => void } }).__mageStore
    const now = Date.now()
    store?.setState({
      phase: 'game',
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
            { games: [{ roundNum: 1, state: 'Finished (12:30)', players: 'alice - bob', result: 'Player alice is the winner', tableId: 'table-g1' }] },
          ],
          players: [{ name: 'alice', state: 'Dueling', points: 3, results: 'R1 bob [2-0] ', history: '', quit: false }],
          runningInfo: '',
        },
      },
    })
  })
}

test.describe('Tournament', { tag: '@tournament' }, () => {
  test('TRN-10, TRN-14, TRN-15, TRN-17: the in-game panel is docked beside the board and renders the live match and the quit mark', async ({ page }) => {
    await page.goto('/')
    await dismissSetupWizard(page)
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
              { games: [{ roundNum: 1, state: 'Finished (12:30)', players: 'alice - bob', result: 'Player alice is the winner', tableId: 'table-g1', matchId: 'match-1' }] },
              { games: [{ roundNum: 2, state: 'Dueling (8:14)', players: 'alice - diana', result: '', tableId: 'table-g2', matchId: 'match-2', gameId: 'game-g2' }] },
            ],
            players: [
              { name: 'alice', state: 'Dueling', points: 3, results: 'R1 bob [2-0] ', history: 'Matches: 41 (2%), Tourneys: 6 (0%), Constructed Rating: 1540, Limited Rating: 1490', quit: false },
              { name: 'bob', state: 'Eliminated', points: 0, results: 'R1 alice [0-2] ', history: '', quit: false },
              { name: 'charlie', state: 'Eliminated', points: 0, results: '', history: '', quit: true },
            ],
            runningInfo: '',
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
    await expect(panel).toHaveClass(/is-docked/)
    await expect(panel.locator('[data-testid="tournament-panel-name"]').first()).toContainText('Commander Clash')
    await expect(panel.locator('[data-testid="tournament-panel-kicker"]').first()).toContainText(/Round 2|Ronda 2/)
    await expect(panel.locator('[data-testid="bracket-round"]').first()).toBeVisible()
    await panel.getByRole('tab', { name: /Standings|Clasificación/ }).click()
    await expect(panel.locator('[data-testid="standings-row"]').first()).toBeVisible()
    await expect(panel.locator('[data-testid="standings-quit"]').first()).toBeVisible()
    await panel.getByRole('tab', { name: /Rounds|Rondas/ }).click()
    // T1: a Watch button only for the live match (FakeServer acks watchTournamentTable)
    const eye = panel.locator('[data-testid="bracket-watch"]').first()
    await expect(eye).toBeVisible()
    await eye.click()
    await expect(panel.locator('[data-testid="tournament-modal-error"]')).toHaveCount(0)
  })

  test('TRN-10: the bracket modal watches the live match over WS (T1)', async ({ page }) => {
    await withFakeServer(() => tournamentScenario(), async () => {
      await login(page, 'e2e')
      const bracketBtn = page.getByTestId('open-bracket').first()
      await expect(bracketBtn).toBeVisible({ timeout: 10_000 })
      await bracketBtn.click()
      const modal = page.locator('[data-testid="tournament-bracket"]').first()
      await expect(modal).toBeVisible({ timeout: 10_000 })
      // one live match in the latest round → one Watch button; finished matches have none
      const eyes = modal.locator('[data-testid="bracket-watch"]')
      await expect(eyes).toHaveCount(1, { timeout: 10_000 })
      await eyes.first().click()
      await expect(modal.locator('[data-testid="tournament-modal-error"]')).toHaveCount(0)
    })
  })

  test('TRN-10, TRN-16: Espectar opens the bracket with the id of SHOW_TOURNAMENT and offers no leave (T6)', async ({ page }) => {
    await withFakeServer(
      () => makeTournamentScenario({ includeStartTournament: false, includeInit: false, emitUpdates: 0, emitShowTournamentOnWatch: true }),
      async () => {
        await login(page, 'e2e')
        const watchBtn = page.locator('.table-card [data-testid="watch-btn"]').first()
        await expect(watchBtn).toBeVisible({ timeout: 10_000 })
        await watchBtn.click()
        const modal = page.locator('[data-testid="tournament-bracket"]').first()
        await expect(modal).toBeVisible({ timeout: 10_000 })
        await expect(modal.locator('[data-testid="bracket-watch"]')).toHaveCount(1)
        // torneo ajeno: sin "Abandonar torneo" y sin staging clavado
        await expect(page.getByTestId('tournament-quit')).toHaveCount(0)
        await expect(page.getByTestId('staging-back')).toHaveCount(0)
      },
    )
  })

  test('tournament panel joins the tournament chat over WS (T4)', async ({ page }) => {
    await withFakeServer(() => tournamentScenario(), async () => {
      await login(page, 'e2e')
      const inject = () => injectTournamentPanel(page)
      const panel = page.locator('[data-testid="tournament-panel"]').first()
      // frames tardíos del connect pueden resetear el phase tras la inyección:
      // re-inyectar hasta que el panel aparezca
      await expect(async () => {
        await inject()
        await expect(panel).toBeVisible({ timeout: 2_000 })
      }).toPass({ timeout: 10_000 })
      await panel.getByRole('tab', { name: /Chat|Charla/ }).click()
      const chat = panel.locator('[data-testid="tournament-panel-chat"]').first()
      await expect(chat).toBeVisible({ timeout: 10_000 })
      await chat.locator('.chat-input input').fill('gl en el torneo')
      await chat.locator('.chat-input button[type="submit"]').click()
      await expect(chat.locator('.chat-list')).toContainText('gl en el torneo', { timeout: 10_000 })
    })
  })

  test('TRN-20: a tournament chat message that arrives while another tab is open badges the Chat tab until it is opened (T4b)', async ({ page }) => {
    await withFakeServer(() => tournamentScenario(), async () => {
      await login(page, 'e2e')
      const panel = page.locator('[data-testid="tournament-panel"]').first()
      await expect(async () => {
        await injectTournamentPanel(page)
        await expect(panel).toBeVisible({ timeout: 2_000 })
      }).toPass({ timeout: 10_000 })
      await expect.poll(() => page.evaluate(() => (globalThis as unknown as { __mageStore?: { getState: () => { tournamentChatId: string | null } } }).__mageStore?.getState().tournamentChatId ?? null)).toBe('tournament-chat-tournament-test-1')
      await page.evaluate(() => {
        const store = (globalThis as unknown as { __mageStore?: { getState: () => { chatMessages: unknown[]; tournamentChatId: string | null }; setState: (s: unknown) => void } }).__mageStore
        if (!store) return
        const s = store.getState()
        store.setState({ chatMessages: [...s.chatMessages, { chatId: s.tournamentChatId, username: 'mesa-rival', message: 'gl hf', messageType: 'TALK', time: Date.now() }] })
      })
      const chatTab = panel.getByTestId('tournament-panel-tab-chat')
      await expect(chatTab.getByTestId('tournament-panel-tab-chat-unread')).toHaveText('1')
      await chatTab.click()
      await expect(panel.getByTestId('tournament-panel-tab-chat-unread')).toHaveCount(0)
    })
  })

  test('random packs selector fills the draft sets over WS (T5)', async ({ page }) => {
    await withFakeServer(() => tournamentScenario(), async () => {
      const buffers: CaptureBuffers = { frames: [], sent: [], pageErrors: [] }
      installCapture(page, buffers)
      await login(page, 'e2e')
      await openCreateDialog(page, 'tourney')
      await expect(page.getByRole('heading', { name: /Crear torneo|Create Tournament/i })).toBeVisible()
      await page.getByRole('radio', { name: /Draft de sobres|Booster Draft/i }).click()
      await page.getByRole('radio', { name: /^(Aleatorio|Random)$/ }).click()
      await page.getByTestId('random-packs-open').click()
      const dialog = page.locator('[data-testid="random-packs-selector"]')
      await expect(dialog).toBeVisible({ timeout: 10_000 })
      await expect(dialog).toContainText('M21')
      await dialog.getByTestId('random-packs-apply').click()
      await expect(dialog).toBeHidden()
      await page.getByRole('button', { name: /Siguiente/ }).click()
      await page.getByRole('button', { name: /Siguiente/ }).click()
      await page.getByRole('button', { name: /Crear torneo/ }).click()
      await expect(page.getByRole('heading', { name: /Crear torneo|Create Tournament/i })).toBeHidden({ timeout: 15_000 })
      const sent = buffers.sent as Array<{ action?: string; args?: Record<string, unknown> }>
      const createFrame = sent.find((f) => f?.action === 'createTournamentTable')
      expect(createFrame?.args?.tournamentType).toBe('Booster Draft Elimination (Random)')
      const setCodes = (createFrame?.args?.limitedOptions as { setCodes?: string[] } | undefined)?.setCodes ?? []
      expect(setCodes.length).toBeGreaterThan(0)
    })
  })
})
