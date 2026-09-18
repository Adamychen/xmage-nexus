import { fakeOnly } from './support/fake-mode'
import { test, expect } from './fixtures'
import { DECK } from '../fixtures/deck-names'
import { startGame } from './support/start-game'
import { withFakeServer } from './support/fake-backend'
import { parseSent, sentOf } from './support/frames'
import { makeBaseScenario } from '../fixtures/fake'
import { makeCard, makeGameView, makePlayer, makePermanent } from '../src/__fixtures__/gameViews'
import {
  GAME_ID, HUMAN_NAME, HUMAN_PLAYER_ID, SIM_NAME, SIM_PLAYER_ID, TABLE_ID,
} from '../fixtures/humanGameConstants'
import type { GameView } from '../src/net/types'
import type { Page } from '@playwright/test'

fakeOnly()

const FEEL_TABLE = 'game-feel-test'

function feelView(): GameView {
  return makeGameView({
    players: [
      makePlayer({
        playerId: HUMAN_PLAYER_ID,
        name: HUMAN_NAME,
        controlled: true,
        isHuman: true,
        isActive: true,
        hasPriority: true,
        life: 20,
        battlefield: {
          'feel-land': makePermanent({ name: 'Mountain', parentId: 'feel-land', controlled: true, cardTypes: ['Land'] }),
        },
      }),
      makePlayer({ playerId: SIM_PLAYER_ID, name: SIM_NAME, isActive: false, hasPriority: false }),
    ],
    myPlayerId: HUMAN_PLAYER_ID,
    myHand: {
      'feel-mountain': makeCard({ name: 'Mountain', parentId: 'feel-mountain', cardTypes: ['Land'] }),
      'feel-bolt': makeCard({ name: 'Lightning Bolt', parentId: 'feel-bolt', cardTypes: ['Instant'], manaValue: 1 }),
    },
    activePlayerId: HUMAN_PLAYER_ID,
    activePlayerName: HUMAN_NAME,
    priorityPlayerName: HUMAN_NAME,
    phase: 'PRECOMBAT_MAIN',
    step: 'PRECOMBAT_MAIN',
    turn: 1,
  })
}

/** Partida humana vs Sim estática (la prioridad siempre es del humano) con
 *  reanudación: `joinGame` reemite el GAME_INIT, como hace el proxy al re-attach. */
function gameFeelScenario() {
  const view = feelView()
  return makeBaseScenario({
    tableId: TABLE_ID,
    tableName: FEEL_TABLE,
    gameId: GAME_ID,
    gameView: view,
    onJoinGame: (conn, gameId) => {
      conn.broadcast('GAME_INIT', { gameView: view }, gameId)
    },
  })
}

async function startFeelGame(page: Page) {
  const session = await startGame(page, {
    prefix: 'feel',
    tableName: FEEL_TABLE,
    deck: DECK.advanced,
    skipAsks: true,
  })
  await expect(page.locator('.game-board')).toBeVisible({ timeout: 20_000 })
  return session
}

/** Añade una carta a la mano por el store (mismo truco que flights.spec.ts):
 *  dispara un vuelo biblioteca→mano del game transition engine. */
async function launchDrawFlight(page: Page): Promise<void> {
  await page.evaluate(() => {
    const w = window as unknown as {
      __mageStore?: { getState: () => { game: { myHand: Record<string, unknown> } | null; gameId: string | null }; handleMessage: (m: unknown) => void }
    }
    const st = w.__mageStore
    if (!st) throw new Error('sin __mageStore')
    const state = st.getState()
    if (!state.game) throw new Error('sin partida')
    const next = structuredClone(state.game)
    const src = Object.values(next.myHand)[0] ?? {}
    next.myHand['feel-draw'] = { ...(src as Record<string, unknown>), id: 'feel-draw', name: 'Probe Draw' }
    st.handleMessage({
      type: 'event',
      method: 'GAME_UPDATE',
      messageId: Date.now(),
      objectId: state.gameId,
      data: { gameView: next },
    })
  })
  await page.waitForFunction(
    () => {
      const w = window as unknown as { __mageFlights?: { active: () => unknown[] } }
      return (w.__mageFlights?.active() ?? []).length > 0
    },
    null,
    { timeout: 5_000 },
  )
}

async function passButton(page: Page) {
  const btn = page.locator('.big-action-btn')
  await expect(btn).toBeEnabled({ timeout: 20_000 })
  return btn
}

test('game-feel: reduced-motion apaga el movimiento y la entrada sigue viva @gamefeel', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await withFakeServer(gameFeelScenario, async () => {
    const { pageErrors } = await startFeelGame(page)

    await expect
      .poll(
        () => page.evaluate(() => document.getAnimations().filter((a) => a.playState === 'running').length),
        { timeout: 10_000 },
      )
      .toBe(0)

    await (await passButton(page)).click()
    await expect
      .poll(() => parseSent(sentOf(page)).some((f) => f.action === 'sendPlayerBoolean' && f.args?.value === false))
      .toBe(true)

    expect(pageErrors, `pageerrors: ${pageErrors.map(String).join(' | ')}`).toEqual([])
  })
})

test('game-feel: un vuelo activo no bloquea el pase de prioridad @gamefeel', async ({ page }) => {
  await withFakeServer(gameFeelScenario, async () => {
    const { pageErrors } = await startFeelGame(page)

    await page.evaluate(() => {
      const store = (window as unknown as { __mageStore?: { setSetting?: (k: string, v: unknown) => void } }).__mageStore
      store?.setSetting?.('animationSpeed', 0.5)
      const w = window as unknown as { __flightAtPassClick?: boolean | null }
      w.__flightAtPassClick = null
      window.addEventListener(
        'pointerdown',
        (e) => {
          if ((e.target as Element | null)?.closest?.('.big-action-btn')) {
            w.__flightAtPassClick = document.querySelectorAll('.flying-card-item').length > 0
          }
        },
        true,
      )
    })

    await launchDrawFlight(page)
    await (await passButton(page)).click()

    await expect
      .poll(() => parseSent(sentOf(page)).some((f) => f.action === 'sendPlayerBoolean' && f.args?.value === false))
      .toBe(true)
    expect(
      await page.evaluate(() => (window as unknown as { __flightAtPassClick?: boolean | null }).__flightAtPassClick),
      'el clic debe haber caído con el vuelo en pantalla',
    ).toBe(true)

    expect(pageErrors, `pageerrors: ${pageErrors.map(String).join(' | ')}`).toEqual([])
  })
})

test('game-feel: tras recargar no quedan animaciones colgadas y el tablero pinta @gamefeel', async ({ page }) => {
  await withFakeServer(gameFeelScenario, async () => {
    const { pageErrors } = await startFeelGame(page)

    await launchDrawFlight(page)
    await page.reload()

    await expect(page.locator('.game-board')).toBeVisible({ timeout: 30_000 })
    await expect
      .poll(() => page.locator('.flight-hidden, .entering, .flying-card-item').count(), { timeout: 10_000 })
      .toBe(0)
    await expect(page.locator('[data-testid="hand-bar"] .hand-card').first()).toBeVisible()

    expect(pageErrors, `pageerrors: ${pageErrors.map(String).join(' | ')}`).toEqual([])
  })
})
