import type { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { startFakeServer, loadFake, type FakeConn, type FakeServerHandle } from './support/fakeServer.ts'
import { contentText, startTestClient } from './support/mcp.ts'

const GAME_1 = 'game-cursor-1'
const GAME_2 = 'game-cursor-2'
const WATCH_GAME = 'game-cursor-watch'
const TABLE_ID = 'table-cursor-1'
const NOISE = 250

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

function gameView() {
  return {
    turn: 2,
    phase: 'PRECOMBAT_MAIN',
    step: 'PRECOMBAT_MAIN',
    activePlayerName: 'me',
    priorityPlayerName: 'me',
    myHand: {},
    canPlayObjects: { objects: {} },
    stack: {},
    combat: [],
    players: [
      { playerId: 'p1', name: 'me', controlled: true, isActive: true, hasPriority: true, life: 20, handCount: 0, libraryCount: 53, battlefield: {}, graveyard: {} },
      { playerId: 'p2', name: 'rival', controlled: false, isActive: false, hasPriority: false, life: 20, handCount: 7, libraryCount: 53, battlefield: {}, graveyard: {} },
    ],
  }
}

describe('event cursors on a busy session', () => {
  let fake: FakeServerHandle
  let client: Client
  let starts = 0

  const text = async (name: string, args: Record<string, unknown> = {}) =>
    contentText(await client.callTool({ name, arguments: args }))

  const jsonOf = (value: string): Record<string, any> =>
    JSON.parse(value.includes('\n\n') ? value.slice(value.lastIndexOf('\n\n') + 2) : value)

  const noise = (conn: FakeConn) => {
    for (let i = 0; i < NOISE; i++) conn.event('CHATMESSAGE', { message: `noise ${i}` }, null)
  }

  beforeAll(async () => {
    const { makeBaseScenario } = await loadFake()
    fake = await startFakeServer(() =>
      makeBaseScenario({
        tableId: TABLE_ID,
        tableName: 'cursor table',
        gameId: GAME_1,
        gameView: gameView(),
        onRequest: (conn: FakeConn, action: string, _args: Record<string, unknown>, requestId: string | number) => {
          if (action === 'getRoomUsers') {
            noise(conn)
            conn.ok(requestId, action, { usersView: [] })
            return true
          }
          if (action === 'watchTournamentTable') {
            conn.ok(requestId, action, {})
            noise(conn)
            conn.event('WATCHGAME', { gameId: WATCH_GAME, tableName: 'watch' }, WATCH_GAME)
            return true
          }
          if (action === 'watchGame') {
            conn.ok(requestId, action, {})
            conn.event('GAME_INIT', { gameView: gameView() }, WATCH_GAME)
            return true
          }
          if (action === 'startMatch') {
            starts++
            if (starts === 1) return false
            conn.ok(requestId, action, {})
            conn.event('GAME_OVER', { winner: 'me' }, GAME_1)
            conn.event('START_GAME', { gameId: GAME_2, tableName: 'bo3' }, GAME_2)
            conn.event('GAME_INIT', { gameView: gameView() }, GAME_2)
            conn.event('GAME_UPDATE', { gameView: gameView() }, GAME_1)
            return true
          }
          return false
        },
      }),
    )
    client = await startTestClient('event-cursor-test')
  }, 30_000)

  afterAll(async () => {
    await client?.close()
    await fake?.stop()
  })

  it('finds WATCHGAME after the event ring is full', async () => {
    jsonOf(await text('mage_connect', { proxyUrl: fake.url, host: '127.0.0.1', port: 17_171, username: 'mcpcursor' }))
    await text('mage_auto_pass', { enabled: false })
    jsonOf(await text('mage_lobby'))
    await sleep(300)
    const watch = jsonOf(await text('mage_watch_tournament_match', { tableId: TABLE_ID, waitMs: 3_000 }))
    expect(watch.gameId).toBe(WATCH_GAME)
    expect(watch.freshGameView).toBe(true)
  }, 30_000)

  it('returns the new game id after a Bo3 game over and ignores late events of the previous game', async () => {
    jsonOf(await text('mage_connect', { proxyUrl: fake.url, host: '127.0.0.1', port: 17_171, username: 'mcpcursor' }))
    await text('mage_auto_pass', { enabled: false })
    const first = jsonOf(await text('mage_start_match', { tableId: TABLE_ID, waitMs: 5_000 }))
    expect(first.gameId).toBe(GAME_1)
    const second = jsonOf(await text('mage_start_match', { tableId: TABLE_ID, waitMs: 5_000 }))
    expect(second.gameId).toBe(GAME_2)
    await sleep(300)
    const session = jsonOf(await text('mage_session'))
    expect(session.gameId).toBe(GAME_2)
  }, 30_000)
})
