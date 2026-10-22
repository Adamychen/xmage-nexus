import type { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { startFakeServer, loadFake, type FakeConn, type FakeServerHandle } from './support/fakeServer.ts'
import { contentText, startTestClient } from './support/mcp.ts'

const GAME_ID = 'game-malformed-1'
const TABLE_ID = 'table-malformed-1'

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

function rivalTurnView(players: unknown[]) {
  return {
    turn: 2,
    phase: 'PRECOMBAT_MAIN',
    step: 'PRECOMBAT_MAIN',
    activePlayerName: 'rival',
    priorityPlayerName: 'me',
    myHand: {},
    canPlayObjects: { objects: {} },
    stack: {},
    combat: [],
    players,
  }
}

describe('a malformed gameView does not crash the MCP process', () => {
  let fake: FakeServerHandle
  let client: Client

  const text = async (name: string, args: Record<string, unknown> = {}) =>
    contentText(await client.callTool({ name, arguments: args }))

  const jsonOf = (value: string): Record<string, any> =>
    JSON.parse(value.includes('\n\n') ? value.slice(value.lastIndexOf('\n\n') + 2) : value)

  beforeAll(async () => {
    const { makeBaseScenario } = await loadFake()
    fake = await startFakeServer(() =>
      makeBaseScenario({
        tableId: TABLE_ID,
        tableName: 'malformed table',
        gameId: GAME_ID,
        gameView: rivalTurnView([null]),
        onStartMatch: (conn: FakeConn) => {
          conn.broadcast('GAME_SELECT', { message: 'Priority', options: { specialButton: 'Pass' }, gameView: rivalTurnView([null]) }, GAME_ID)
        },
      }),
    )
    client = await startTestClient('malformed-frame-test')
  }, 30_000)

  afterAll(async () => {
    await client?.close()
    await fake?.stop()
  })

  it('keeps answering after a null player in the gameView', async () => {
    jsonOf(await text('mage_connect', { proxyUrl: fake.url, host: '127.0.0.1', port: 17_171, username: 'mcpmalform' }))
    const started = await client.callTool({ name: 'mage_start_match', arguments: { tableId: TABLE_ID, waitMs: 5_000 } })
    expect(started.isError).not.toBe(true)
    await sleep(500)
    const session = await client.callTool({ name: 'mage_session', arguments: {} })
    expect(session.isError).not.toBe(true)
    expect(jsonOf(contentText(session)).connected).toBe(true)
  }, 30_000)

  it('mage_game_state answers with a null player in the gameView', async () => {
    const state = await client.callTool({ name: 'mage_game_state', arguments: {} })
    expect(state.isError).not.toBe(true)
    const body = jsonOf(contentText(state))
    expect(body.state.turn).toBe(2)
    expect(body.state.me).toBeNull()
    expect(body.state.opponents).toEqual([])
  }, 30_000)
})
