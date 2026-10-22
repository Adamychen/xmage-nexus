import type { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { startFakeServer, loadFake, type FakeConn, type FakeServerHandle } from './support/fakeServer.ts'
import { contentText, startTestClient } from './support/mcp.ts'

const GAME_ID = 'game-combat-target-1'
const TABLE_ID = 'table-combat-target-1'

const blockersData = {
  message: 'Select blockers',
  options: { possibleBlockers: ['b1', 'b2'], queryType: 'SELECT' },
}

const targetData = (targets: string[]) => ({
  message: 'Select attacker to block',
  targets,
})

describe('mage_combat and unanswered GAME_TARGET', () => {
  let fake: FakeServerHandle
  let client: Client
  let onBlocker: (conn: FakeConn, uuid: string) => void = () => {}
  const received: { action: string; value: unknown }[] = []

  const text = async (name: string, args: Record<string, unknown> = {}) =>
    contentText(await client.callTool({ name, arguments: args }))

  const jsonOf = (value: string): Record<string, any> =>
    JSON.parse(value.includes('\n\n') ? value.slice(value.lastIndexOf('\n\n') + 2) : value)

  beforeAll(async () => {
    const { makeBaseScenario } = await loadFake()
    fake = await startFakeServer(() =>
      makeBaseScenario({
        tableId: TABLE_ID,
        tableName: 'combat target table',
        gameId: GAME_ID,
        onStartMatch: (conn: FakeConn) => {
          conn.broadcast('GAME_SELECT', blockersData, GAME_ID)
        },
        onSendPlayerUUID: (conn: FakeConn, uuid: string) => {
          received.push({ action: 'sendPlayerUUID', value: uuid })
          if (uuid.startsWith('b')) onBlocker(conn, uuid)
          else conn.broadcast('GAME_UPDATE', {}, GAME_ID)
        },
        onSendPlayerBoolean: (conn: FakeConn, ctx: { args: Record<string, unknown> }) => {
          received.push({ action: 'sendPlayerBoolean', value: ctx.args.value === true || ctx.args.value === 'true' })
          conn.broadcast('GAME_UPDATE', {}, GAME_ID)
        },
      }),
    )
    client = await startTestClient('combat-target-test')
    jsonOf(await text('mage_connect', { proxyUrl: fake.url, host: '127.0.0.1', port: 17_171, username: 'mcpcombat' }))
    await text('mage_auto_pass', { enabled: false })
  }, 30_000)

  afterAll(async () => {
    await client?.close()
    await fake?.stop()
  })

  const startBlockers = async () => {
    received.length = 0
    jsonOf(await text('mage_start_match', { tableId: TABLE_ID, waitMs: 5_000 }))
  }

  it('stops at a GAME_TARGET it cannot resolve instead of sending the next blocker', async () => {
    onBlocker = (conn: FakeConn) => conn.broadcast('GAME_TARGET', targetData(['a1', 'a2']), GAME_ID)
    await startBlockers()
    const result = jsonOf(await text('mage_combat', { blockers: ['b1', 'b2'], targetTimeoutMs: 1_000 }))
    expect(received).toEqual([{ action: 'sendPlayerUUID', value: 'b1' }])
    expect(result.sent).toEqual(['b1'])
    expect(result.unresolved).toEqual(['b1'])
    expect(result.confirmed).toBe(false)
    expect(result.stopped).toBe('pendingTarget')
    expect(result.pending.mode).toBe('uuid')
  }, 30_000)

  it('stops when the GAME_TARGET arrives after targetTimeoutMs', async () => {
    onBlocker = (conn: FakeConn, uuid: string) => {
      if (uuid === 'b1') setTimeout(() => conn.broadcast('GAME_TARGET', targetData(['a1', 'a2']), GAME_ID), 1_200)
    }
    await startBlockers()
    const result = jsonOf(
      await text('mage_combat', { blockers: ['b1', 'b2'], blockTargets: ['a1', 'a2'], targetTimeoutMs: 500 }),
    )
    await new Promise((resolve) => setTimeout(resolve, 1_500))
    expect(received).toEqual([{ action: 'sendPlayerUUID', value: 'b1' }])
    expect(result.sent).toEqual(['b1'])
    expect(result.confirmed).toBe(false)
    expect(result.stopped).toBe('noResponse')
    expect(result.unresolved).toEqual(['b1'])
  }, 30_000)

  it('still confirms a block the server resolves without a GAME_TARGET', async () => {
    onBlocker = (conn: FakeConn) => conn.broadcast('GAME_SELECT', blockersData, GAME_ID)
    await startBlockers()
    const result = jsonOf(await text('mage_combat', { blockers: ['b1'], targetTimeoutMs: 500 }))
    expect(result.confirmed).toBe(true)
    expect(result.stopped).toBeFalsy()
    expect(received).toEqual([
      { action: 'sendPlayerUUID', value: 'b1' },
      { action: 'sendPlayerBoolean', value: false },
    ])
  }, 30_000)
})
