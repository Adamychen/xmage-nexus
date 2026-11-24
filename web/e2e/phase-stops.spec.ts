import { test, expect } from './fixtures'
import { fakeOnly } from './support/fake-mode'
import { withFakeServer } from './support/fake-backend'
import { login, quickStartGame } from './support/start-game'
import { makeBaseScenario } from '../fixtures/fake'
import { playerGameView } from '../src/__fixtures__/gameViews'
import { manaPaymentScenario, PHASE_PREFS } from '../fixtures/scenarios/manaPayment'

fakeOnly()

function lobbyScenario() {
  return makeBaseScenario({
    tableId: 'table-ps-room',
    tableName: 'phase-stops-room',
    gameId: 'game-ps-room',
    gameView: playerGameView,
  })
}

test.describe('Phase stops', { tag: '@phasestops' }, () => {
  test('lobby defaults persist across sessions', async ({ page }) => {
    await withFakeServer(lobbyScenario, async () => {
      await login(page, 'ps-lobby')
      await page.getByTestId('open-settings').click()
      await page.getByTestId('settings-nav-gameplay').click()
      const block = page.getByTestId('settings-phase-stops')
      await expect(block).toBeVisible()
      await expect(block.locator('.phase-stop-btn')).toHaveCount(14)
      const main1 = block.getByTestId('settings-stop-your-main1')
      await expect(main1).toHaveClass(/active/)
      await main1.click()
      await expect(main1).not.toHaveClass(/active/)
      const stored = await page.evaluate(() => window.localStorage.getItem('mage-web-phase-stops'))
      expect(JSON.parse(stored ?? '{}').yourTurn.main1).toBe(false)

      await page.reload()
      let inLobby = false
      for (let i = 0; i < 40 && !inLobby; i++) {
        if ((await page.getByTestId('open-settings').count()) > 0) {
          inLobby = true
        } else {
          await page.waitForTimeout(500)
        }
      }
      if (!inLobby) {
        await login(page, 'ps-lobby')
      }
      await page.getByTestId('open-settings').click()
      await page.getByTestId('settings-nav-gameplay').click()
      await expect(page.getByTestId('settings-stop-your-main1')).not.toHaveClass(/active/)
      await expect(page.getByTestId('settings-stop-opp-main1')).toHaveClass(/active/)
    })
  })

  test('SET-11: the board shows and edits the Settings stops, both ways', async ({ page }) => {
    PHASE_PREFS.length = 0
    await page.addInitScript(() => {
      window.localStorage.setItem(
        'mage-web-phase-stops',
        JSON.stringify({ yourTurn: { main1: false }, opponentTurn: {} }),
      )
    })
    await withFakeServer(manaPaymentScenario, async () => {
      const { pageErrors } = await quickStartGame(page, {
        prefix: 'ps',
        skipAsks: true,
      })
      expect(pageErrors).toEqual([])

      await expect.poll(() => PHASE_PREFS.length, { timeout: 5000 }).toBeGreaterThan(0)
      const seeded = PHASE_PREFS[PHASE_PREFS.length - 1] as { yourTurn: Record<string, boolean>; opponentTurn: Record<string, boolean> }
      expect(seeded.yourTurn.main1).toBe(false)
      expect(seeded.yourTurn.upkeep).toBe(true)
      expect(seeded.opponentTurn.main1).toBe(true)

      // board -> Settings: the change is saved and pushed to the running game
      const ladder = page.getByTestId('phase-ladder')
      await expect(ladder).toBeVisible()
      const mine = (await ladder.getAttribute('data-shown-turn')) === 'yourTurn'
      const yourButton = mine ? 'left' : 'right'
      const yourMark = mine ? '.ladder-stop-notch' : '.ladder-stop-dot'
      const m1 = page.getByTestId('phase-ladder-step-PRECOMBAT_MAIN')
      await expect(m1.locator(yourMark)).toHaveCount(0)
      let before = PHASE_PREFS.length
      await m1.click({ button: yourButton })
      await expect(m1.locator(yourMark)).toHaveCount(1)
      await expect.poll(() => PHASE_PREFS.length, { timeout: 5000 }).toBeGreaterThan(before)
      expect((PHASE_PREFS[PHASE_PREFS.length - 1] as { yourTurn: Record<string, boolean> }).yourTurn.main1).toBe(true)
      const stored = await page.evaluate(() => window.localStorage.getItem('mage-web-phase-stops'))
      expect(JSON.parse(stored ?? '{}').yourTurn.main1).toBe(true)

      await page.locator('[data-testid="game-menu-btn"]').click()
      await page.locator('[data-testid="game-menu-settings"]').click()
      const settingsM1 = page.getByTestId('settings-stop-your-main1')
      await expect(settingsM1).toHaveClass(/active/)

      // Settings -> board: the same toggle, the same result
      before = PHASE_PREFS.length
      await settingsM1.click()
      await expect(settingsM1).not.toHaveClass(/active/)
      await expect.poll(() => PHASE_PREFS.length, { timeout: 5000 }).toBeGreaterThan(before)
      expect((PHASE_PREFS[PHASE_PREFS.length - 1] as { yourTurn: Record<string, boolean> }).yourTurn.main1).toBe(false)
      await page.getByTestId('settings-close').click()
      await expect(m1.locator(yourMark)).toHaveCount(0)
    })
  })

  test('BRD-62: the ladder sits inline beside the turn counter in the top strip with combat steps directly clickable', async ({ page }) => {
    await withFakeServer(manaPaymentScenario, async () => {
      await quickStartGame(page, { prefix: 'psl', skipAsks: true })
      const ladder = page.getByTestId('phase-ladder')
      await expect(ladder).toBeVisible()
      await expect(page.locator('.phase-bar')).toHaveCount(0)
      const status = page.getByTestId('game-status')
      await expect(status).toBeVisible()
      const l = (await ladder.boundingBox())!
      const s = (await status.boundingBox())!
      expect(l.x).toBeGreaterThanOrEqual(s.x + s.width - 1)
      expect(Math.abs((l.y + l.height / 2) - (s.y + s.height / 2))).toBeLessThan(8)
      expect(await page.locator('.ladder-step.is-current').count()).toBe(1)

      const combat = page.getByTestId('phase-ladder-combat-steps')
      await expect(combat).toBeVisible()
      const c = (await combat.boundingBox())!
      expect(Math.abs((c.y + c.height / 2) - (l.y + l.height / 2))).toBeLessThan(4)
      const begin = page.getByTestId('phase-ladder-step-BEGIN_COMBAT')
      const mine = (await ladder.getAttribute('data-shown-turn')) === 'yourTurn'
      const before = await page.evaluate(() => JSON.parse(window.localStorage.getItem('mage-web-phase-stops') ?? '{}'))
      await begin.click({ button: 'right' })
      const other = mine ? 'opponentTurn' : 'yourTurn'
      await expect.poll(async () => (await page.evaluate(() => JSON.parse(window.localStorage.getItem('mage-web-phase-stops') ?? '{}')))[other]?.beginCombat)
        .toBe(!before[other]?.beginCombat)
    })
  })

  test('SET-11: a rejoin with no GAME_INIT still shows the Settings stops', async ({ page }) => {
    const allOff = () => Object.fromEntries(['upkeep', 'draw', 'main1', 'beginCombat', 'endCombat', 'main2', 'endStep'].map((k) => [k, false]))
    await page.addInitScript((stops) => {
      // only on the first load: the reload must keep what the page saved
      if (!window.sessionStorage.getItem('ps-seeded')) {
        window.localStorage.setItem('mage-web-phase-stops', JSON.stringify(stops))
        window.sessionStorage.setItem('ps-seeded', '1')
      }
    }, { yourTurn: allOff(), opponentTurn: allOff() })
    // the rejoin brings back only the last state, as the proxy's replay does
    const rejoinScenario = () => makeBaseScenario({
      tableId: 'table-ps-rejoin',
      tableName: 'phase-stops-rejoin',
      gameId: 'game-ps-rejoin',
      gameView: playerGameView,
      onJoinGame: (conn, gameId) => {
        conn.broadcast('GAME_UPDATE', { gameView: playerGameView }, gameId)
      },
    })
    await withFakeServer(rejoinScenario, async () => {
      await quickStartGame(page, { prefix: 'psr', skipAsks: true })
      const bar = page.getByTestId('phase-ladder')
      await expect(bar).toBeVisible()
      await expect(page.locator('.ladder-stop-notch, .ladder-stop-dot')).toHaveCount(0)

      await page.reload({ waitUntil: 'domcontentloaded' })
      await expect(page.locator('.arena-board').first()).toBeVisible({ timeout: 30_000 })
      await expect(bar).toBeVisible()
      await expect(page.locator('.ladder-stop-notch, .ladder-stop-dot')).toHaveCount(0)
    })
  })
})
