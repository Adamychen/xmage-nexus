import { test, expect } from './fixtures'
import { FAKE_MODE } from './dual'
import { startGame } from './support/start-game'
import { DECK } from '../fixtures/deck-names'
import { HEARTBEAT_INTERVAL_MS, HEARTBEAT_TIMEOUT_MS } from '../src/net/Gateway'

/**
 * Mid-game connection loss against the real proxy + server: the public proxy
 * sits behind a TCP tunnel whose sockets drop (1006) or stall half-open, and
 * players had to reload to unfreeze the game. The client must reconnect on its
 * own, re-attach to the same session and rejoin the game without ever passing
 * through the lobby, and keep receiving the game afterwards.
 * Real only: the attach + `connected` + rejoin replay is proxy behavior.
 */
test.skip(FAKE_MODE, 'Solo real: re-attach de sesión y replay de joinGame son lógica del proxy real.')

test.setTimeout(240_000)

type SocketsWindow = Window & { __nexusSockets?: WebSocket[]; __phases?: string[]; __g0?: unknown }

async function trackSocketsAndPhases(page: import('@playwright/test').Page): Promise<void> {
  await page.addInitScript(() => {
    const w = window as SocketsWindow
    const Native = window.WebSocket
    w.__nexusSockets = []
    class Tracked extends Native {
      constructor(url: string | URL, protocols?: string | string[]) {
        super(url, protocols)
        w.__nexusSockets!.push(this)
      }
    }
    window.WebSocket = Tracked as typeof WebSocket
  })
}

async function socketCount(page: import('@playwright/test').Page): Promise<number> {
  return page.evaluate(() => (window as SocketsWindow).__nexusSockets?.length ?? 0)
}

async function startPhaseLog(page: import('@playwright/test').Page): Promise<void> {
  await page.evaluate(() => {
    const w = window as SocketsWindow
    const store = (globalThis as unknown as {
      __mageStore: { getState: () => { phase: string; game: unknown }; subscribe: (fn: () => void) => void }
    }).__mageStore
    w.__phases = [store.getState().phase]
    w.__g0 = store.getState().game
    store.subscribe(() => w.__phases!.push(store.getState().phase))
  })
}

async function phasesSeen(page: import('@playwright/test').Page): Promise<string[]> {
  return page.evaluate(() => [...new Set((window as SocketsWindow).__phases ?? [])])
}

async function gameMovedOn(page: import('@playwright/test').Page): Promise<boolean> {
  return page.evaluate(() => {
    const store = (globalThis as unknown as { __mageStore: { getState: () => { game: unknown } } }).__mageStore
    const g = store.getState().game
    return g != null && g !== (window as SocketsWindow).__g0
  })
}

async function inGame(page: import('@playwright/test').Page): Promise<void> {
  await expect
    .poll(() => page.evaluate(() => {
      const s = (globalThis as unknown as { __mageStore: { getState: () => { phase: string; game: unknown } } }).__mageStore.getState()
      return s.phase === 'game' && s.game != null
    }), { timeout: 60_000 })
    .toBe(true)
}

test('a dropped socket mid-game reconnects and rejoins without leaving the board', { tag: '@reconnect' }, async ({ page }) => {
  await trackSocketsAndPhases(page)
  const { pageErrors } = await startGame(page, { prefix: 'rcd', deck: DECK.lands, simDeck: DECK.aiLands })
  await inGame(page)
  const before = await socketCount(page)
  await startPhaseLog(page)

  await page.evaluate(() => {
    const sockets = (window as SocketsWindow).__nexusSockets!
    sockets[sockets.length - 1].close()
  })

  await expect.poll(() => socketCount(page), { timeout: 20_000 }).toBeGreaterThan(before)
  await expect.poll(() => gameMovedOn(page), { timeout: 60_000 }).toBe(true)
  expect(await phasesSeen(page)).toEqual(['game'])
  expect(pageErrors, `pageerrors: ${pageErrors.map(String).join(' | ')}`).toEqual([])
})

test('a half-open socket is detected by the heartbeat and the game recovers without a reload', { tag: '@reconnect' }, async ({ page }) => {
  await trackSocketsAndPhases(page)
  const { pageErrors } = await startGame(page, { prefix: 'rch', deck: DECK.lands, simDeck: DECK.aiLands })
  await inGame(page)
  const before = await socketCount(page)

  // Stalled tunnel: the socket stays OPEN but nothing gets through either way.
  await page.evaluate(() => {
    const sockets = (window as SocketsWindow).__nexusSockets!
    const ws = sockets[sockets.length - 1]
    ws.onmessage = null
    ws.send = () => {}
  })
  await startPhaseLog(page)

  await expect
    .poll(() => socketCount(page), { timeout: HEARTBEAT_INTERVAL_MS + HEARTBEAT_TIMEOUT_MS + 20_000 })
    .toBeGreaterThan(before)
  await expect.poll(() => gameMovedOn(page), { timeout: 60_000 }).toBe(true)
  expect(await phasesSeen(page)).toEqual(['game'])
  expect(pageErrors, `pageerrors: ${pageErrors.map(String).join(' | ')}`).toEqual([])
})
