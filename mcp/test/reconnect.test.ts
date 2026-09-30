import type { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { startFakeServer, loadFake, type FakeConn, type FakeServerHandle } from './support/fakeServer.ts'
import { baseGameView, contentText, startTestClient } from './support/mcp.ts'

const GAME_ID = 'game-reconnect-1'
const TABLE_ID = 'table-reconnect-1'

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

describe('MCP reconnect against the FixtureServer', () => {
  let fake: FakeServerHandle
  let client: Client
  const conns: FakeConn[] = []

  const text = async (name: string, args: Record<string, unknown> = {}) =>
    contentText(await client.callTool({ name, arguments: args }))

  const jsonOf = (value: string): Record<string, any> =>
    JSON.parse(value.includes('\n\n') ? value.slice(value.lastIndexOf('\n\n') + 2) : value)

  beforeAll(async () => {
    const { makeBaseScenario } = await loadFake()
    fake = await startFakeServer(() =>
      makeBaseScenario({
        tableId: TABLE_ID,
        tableName: 'reconnect table',
        gameId: GAME_ID,
        gameView: baseGameView(1),
        onConnect: (conn: FakeConn) => conns.push(conn),
        onJoinGame: (conn: FakeConn) => conn.broadcast('GAME_INIT', { gameView: baseGameView(1) }, GAME_ID),
      }),
    )
    client = await startTestClient('reconnect-test')
  }, 30_000)

  afterAll(async () => {
    await client?.close()
    await fake?.stop()
  })

  async function connectAndStart() {
    const connect = jsonOf(await text('mage_connect', { proxyUrl: fake.url, host: '127.0.0.1', port: 17_171, username: 'mcprec' }))
    expect(connect.loggedIn).toBe(true)
    await text('mage_auto_pass', { enabled: false })
    jsonOf(await text('mage_create_table', { name: 'reconnect' }))
    await text('mage_join_table', {
      tableId: TABLE_ID,
      deck: { name: 'fake deck', cards: [{ cardName: 'Mountain', setCode: 'M10', cardNumber: '1', amount: 40 }] },
    })
    const started = jsonOf(await text('mage_start_match'))
    expect(started.gameId).toBe(GAME_ID)
    await text('mage_wait_for_prompt', { timeoutMs: 5_000 })
  }

  async function waitForSession(predicate: (session: Record<string, any>) => boolean, timeoutMs = 20_000) {
    const deadline = Date.now() + timeoutMs
    let session: Record<string, any> = {}
    while (Date.now() < deadline) {
      session = JSON.parse(await text('mage_session'))
      if (predicate(session)) return session
      await sleep(250)
    }
    return session
  }

  it('auto-reconnects and resyncs the game after the WS drops', async () => {
    await connectAndStart()
    const before = conns.length
    conns.at(-1)?.close()
    const session = await waitForSession((s) =>
      s.connected === true &&
      s.loggedIn === true &&
      s.gameId === GAME_ID &&
      conns.length > before &&
      s.events.some((event: { method: string }) => event.method === 'RECONNECTED'),
    )
    expect(session.connected).toBe(true)
    expect(session.loggedIn).toBe(true)
    expect(session.gameId).toBe(GAME_ID)
    expect(session.reconnecting).toBe(false)
    const state = JSON.parse(await text('mage_game_state'))
    expect(state.state.me.life).toBe(20)
  }, 60_000)

  it('mage_reconnect forces a manual reconnection and resync', async () => {
    const before = conns.length
    conns.at(-1)?.close()
    await sleep(300)
    const out = await text('mage_reconnect')
    expect(out).toContain('reconectado')
    const session = await waitForSession((s) => s.connected === true && s.loggedIn === true && conns.length > before)
    expect(session.gameId).toBe(GAME_ID)
    const state = JSON.parse(await text('mage_game_state'))
    expect(state.state.turn).toBe(1)
  }, 60_000)
})
