import type { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { startFakeServer, loadFake, type FakeConn, type FakeServerHandle } from './support/fakeServer.ts'
import { baseGameView, contentText, startTestClient } from './support/mcp.ts'

describe('session pin per call', () => {
  let fakeA: FakeServerHandle
  let fakeB: FakeServerHandle
  let client: Client
  let turnA = 1
  let turnB = 1

  const text = async (name: string, args: Record<string, unknown> = {}) =>
    contentText(await client.callTool({ name, arguments: args }))

  const jsonOf = (value: string): Record<string, any> =>
    JSON.parse(value.includes('\n\n') ? value.slice(value.lastIndexOf('\n\n') + 2) : value)

  async function startGame(session: string, url: string, tableId: string, targetId: string, gameId: string) {
    jsonOf(await text('mage_connect', { session, proxyUrl: url, host: '127.0.0.1', port: 17_171, username: `mcp-${session}-1` }))
    await text('mage_auto_pass', { enabled: false })
    jsonOf(await text('mage_create_table', { name: session }))
    await text('mage_join_table', {
      tableId,
      deck: { name: `${session} deck`, cards: [{ cardName: 'Mountain', setCode: 'M10', cardNumber: '1', amount: 40 }] },
    })
    const started = jsonOf(await text('mage_start_match'))
    expect(started.gameId).toBe(gameId)
    const wait = JSON.parse(await text('mage_wait_for_prompt', { timeoutMs: 5_000 }))
    expect(wait.prompt.options.map((option: { id: string }) => option.id)).toContain(targetId)
  }

  beforeAll(async () => {
    const { makeBaseScenario } = await loadFake()
    fakeA = await startFakeServer(() =>
      makeBaseScenario({
        tableId: 'table-pin-a',
        tableName: 'pin-A',
        gameId: 'game-pin-a',
        getGameView: () => baseGameView(turnA),
        onStartMatch: (conn: FakeConn) => conn.broadcast('GAME_TARGET', { message: 'Choose target A', targets: ['ta'], gameView: baseGameView(turnA) }, 'game-pin-a'),
        onSendPlayerUUID: (conn: FakeConn) => {
          turnA = 2
          conn.broadcast('GAME_UPDATE', { gameView: baseGameView(turnA) }, 'game-pin-a')
        },
      }),
    )
    fakeB = await startFakeServer(() =>
      makeBaseScenario({
        tableId: 'table-pin-b',
        tableName: 'pin-B',
        gameId: 'game-pin-b',
        getGameView: () => baseGameView(turnB),
        onStartMatch: (conn: FakeConn) => conn.broadcast('GAME_TARGET', { message: 'Choose target B', targets: ['tb'], gameView: baseGameView(turnB) }, 'game-pin-b'),
        onSendPlayerUUID: (conn: FakeConn) => {
          turnB = 3
          conn.broadcast('GAME_UPDATE', { gameView: baseGameView(turnB) }, 'game-pin-b')
        },
      }),
    )
    client = await startTestClient('session-pin-test')
  }, 30_000)

  afterAll(async () => {
    await client?.close()
    await fakeA?.stop()
    await fakeB?.stop()
  })

  it('reads and acts on the pinned session without touching the active one', async () => {
    await startGame('pa', fakeA.url, 'table-pin-a', 'ta', 'game-pin-a')
    await startGame('pb', fakeB.url, 'table-pin-b', 'tb', 'game-pin-b')

    const activeBefore = jsonOf(await text('mage_session', {}))
    expect(activeBefore.sessionId).toBe('pb')

    const pinnedState = JSON.parse(await text('mage_game_state', { session: 'pa' }))
    expect(pinnedState.state.turn).toBe(1)
    expect(pinnedState.state.me.life).toBe(20)

    const pinnedSession = jsonOf(await text('mage_session', { session: 'pa' }))
    expect(pinnedSession.sessionId).toBe('pa')
    expect(pinnedSession.gameId).toBe('game-pin-a')

    const stillActive = jsonOf(await text('mage_session', {}))
    expect(stillActive.sessionId).toBe('pb')

    await text('mage_choose', { session: 'pa', optionId: 'ta' })
    const afterA = JSON.parse(await text('mage_game_state', { session: 'pa' }))
    expect(afterA.state.turn).toBe(2)

    const afterB = JSON.parse(await text('mage_game_state', {}))
    expect(afterB.state.turn).toBe(1)
  }, 60_000)
})
