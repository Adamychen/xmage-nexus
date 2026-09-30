import type { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { startFakeServer, loadFake, type FakeConn, type FakeServerHandle } from './support/fakeServer.ts'
import { contentText, startTestClient } from './support/mcp.ts'

const GAME_ID = 'game-gang-1'
const TABLE_ID = 'table-gang-1'

const blockersData = {
  message: 'Select blockers',
  options: { possibleBlockers: ['b1', 'b2'], queryType: 'SELECT' },
}

const targetData = (id: string) => ({
  message: 'Choose attacker',
  targets: [id],
})

describe('mage_combat gang-block', () => {
  let fake: FakeServerHandle
  let client: Client
  const received: { action: string; value: unknown }[] = []
  let activeConn: FakeConn | null = null

  const text = async (name: string, args: Record<string, unknown> = {}) =>
    contentText(await client.callTool({ name, arguments: args }))

  const jsonOf = (value: string): Record<string, any> =>
    JSON.parse(value.includes('\n\n') ? value.slice(value.lastIndexOf('\n\n') + 2) : value)

  beforeAll(async () => {
    const { makeBaseScenario } = await loadFake()
    fake = await startFakeServer(() =>
      makeBaseScenario({
        tableId: TABLE_ID,
        tableName: 'gang table',
        gameId: GAME_ID,
        onConnect: (conn: FakeConn) => {
          activeConn = conn
        },
        onStartMatch: (conn: FakeConn) => {
          activeConn = conn
          conn.broadcast('GAME_SELECT', blockersData, GAME_ID)
        },
        onSendPlayerUUID: (conn: FakeConn, uuid: string) => {
          received.push({ action: 'sendPlayerUUID', value: uuid })
          if (uuid === 'b1' || uuid === 'b2' || uuid === 'b9') {
            conn.broadcast('GAME_TARGET', targetData('a1'), GAME_ID)
          } else {
            conn.broadcast('GAME_SELECT', blockersData, GAME_ID)
          }
        },
        onSendPlayerBoolean: (conn: FakeConn, ctx: { args: Record<string, unknown> }) => {
          received.push({ action: 'sendPlayerBoolean', value: ctx.args.value === true || ctx.args.value === 'true' })
          conn.broadcast('GAME_OVER', { winner: 'me' }, GAME_ID)
        },
      }),
    )
    client = await startTestClient('gang-block-test')
  }, 30_000)

  afterAll(async () => {
    await client?.close()
    await fake?.stop()
  })

  it('answers one GAME_TARGET per blocker and confirms', async () => {
    jsonOf(await text('mage_connect', { proxyUrl: fake.url, host: '127.0.0.1', port: 17_171, username: 'mcpgang' }))
    await text('mage_auto_pass', { enabled: false })
    jsonOf(await text('mage_create_table', { name: 'gang' }))
    await text('mage_join_table', {
      tableId: TABLE_ID,
      deck: { name: 'fake deck', cards: [{ cardName: 'Mountain', setCode: 'M10', cardNumber: '1', amount: 40 }] },
    })
    jsonOf(await text('mage_start_match'))
    const wait = JSON.parse(await text('mage_wait_for_prompt', { timeoutMs: 5_000 }))
    expect(wait.prompt.method).toBe('GAME_SELECT')
    expect(wait.prompt.title).toBe('declare blockers')

    const result = jsonOf(
      await text('mage_combat', { blockers: ['b1', 'b2'], blockTargets: ['a1', 'a1'], confirm: true }),
    )
    expect(result.ok).toBe(true)
    expect(result.sent).toEqual(['b1', 'a1', 'b2', 'a1'])
    expect(result.targetsAnswered).toEqual([
      { blocker: 'b1', attacker: 'a1' },
      { blocker: 'b2', attacker: 'a1' },
    ])
    expect(result.unresolved).toEqual([])
    expect(result.confirmed).toBe(true)
    expect(received).toEqual([
      { action: 'sendPlayerUUID', value: 'b1' },
      { action: 'sendPlayerUUID', value: 'a1' },
      { action: 'sendPlayerUUID', value: 'b2' },
      { action: 'sendPlayerUUID', value: 'a1' },
      { action: 'sendPlayerBoolean', value: false },
    ])
  }, 60_000)
})
