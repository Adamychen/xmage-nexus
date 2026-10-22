import type { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { startFakeServer, loadFake, type FakeConn, type FakeServerHandle } from './support/fakeServer.ts'
import { contentText, startTestClient } from './support/mcp.ts'

const GAME_ID = 'game-guards-1'
const TABLE_ID = 'table-guards-1'

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

function rivalTurnView() {
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
    players: [
      { playerId: 'p1', name: 'me', controlled: true, isActive: false, hasPriority: true, life: 20, handCount: 0, libraryCount: 53, battlefield: {}, graveyard: {} },
      { playerId: 'p2', name: 'rival', controlled: false, isActive: true, hasPriority: false, life: 20, handCount: 7, libraryCount: 53, battlefield: {}, graveyard: {} },
    ],
  }
}

describe('decision tools need a pending prompt', () => {
  let fake: FakeServerHandle
  let client: Client
  let startKind: 'none' | 'target' | 'ask' | 'priority' = 'none'
  let ackDelayMs = 0
  let booleanSends = 0
  const uuidSends: string[] = []

  const text = async (name: string, args: Record<string, unknown> = {}) =>
    contentText(await client.callTool({ name, arguments: args }))

  const call = (name: string, args: Record<string, unknown> = {}) => client.callTool({ name, arguments: args })

  const jsonOf = (value: string): Record<string, any> =>
    JSON.parse(value.includes('\n\n') ? value.slice(value.lastIndexOf('\n\n') + 2) : value)

  const reset = () => {
    booleanSends = 0
    uuidSends.length = 0
  }

  beforeAll(async () => {
    const { makeBaseScenario } = await loadFake()
    fake = await startFakeServer(() =>
      makeBaseScenario({
        tableId: TABLE_ID,
        tableName: 'guards table',
        gameId: GAME_ID,
        gameView: rivalTurnView(),
        onStartMatch: (conn: FakeConn) => {
          if (startKind === 'target') conn.broadcast('GAME_TARGET', { message: 'Choose target', targets: ['t1', 't2'] }, GAME_ID)
          if (startKind === 'ask') conn.broadcast('GAME_ASK', { message: 'Pay the cost?', options: {} }, GAME_ID)
          if (startKind === 'priority') {
            conn.broadcast('GAME_SELECT', { message: 'Priority', options: { specialButton: 'Pass' }, gameView: rivalTurnView() }, GAME_ID)
          }
        },
        onSendPlayerUUID: (_conn: FakeConn, uuid: string) => {
          uuidSends.push(uuid)
        },
        onRequest: (conn: FakeConn, action: string, _args: Record<string, unknown>, requestId: string | number) => {
          if (action !== 'sendPlayerBoolean') return false
          booleanSends++
          if (ackDelayMs === 0) return false
          setTimeout(() => conn.ok(requestId, action, {}), ackDelayMs)
          return true
        },
      }),
    )
    client = await startTestClient('prompt-guards-test')
    jsonOf(await text('mage_connect', { proxyUrl: fake.url, host: '127.0.0.1', port: 17_171, username: 'mcpguards' }))
  }, 30_000)

  afterAll(async () => {
    await client?.close()
    await fake?.stop()
  })

  const startWith = async (kind: typeof startKind) => {
    startKind = kind
    reset()
    await text('mage_auto_pass', { enabled: false })
    jsonOf(await text('mage_start_match', { tableId: TABLE_ID, waitMs: 5_000 }))
  }

  it('mage_play_card refuses to send when no prompt is pending', async () => {
    await startWith('none')
    const result = await call('mage_play_card', { cardId: 'c1' })
    expect(result.isError).toBe(true)
    expect(uuidSends).toEqual([])
  }, 30_000)

  it('mage_pass_priority refuses to answer a target prompt', async () => {
    await startWith('target')
    const result = await call('mage_pass_priority')
    expect(result.isError).toBe(true)
    expect(booleanSends).toBe(0)
  }, 30_000)

  it('mage_pay_mana refuses a source id when the pending prompt is a yes/no ask', async () => {
    await startWith('ask')
    const result = await call('mage_pay_mana', { sourceId: 's1' })
    expect(result.isError).toBe(true)
    expect(uuidSends).toEqual([])
  }, 30_000)

  it('mage_combat refuses to declare when no prompt is pending', async () => {
    await startWith('none')
    const result = await call('mage_combat', { blockers: ['b1'] })
    expect(result.isError).toBe(true)
    expect(uuidSends).toEqual([])
  }, 30_000)

  it('mage_action kind=boolean requires an explicit value', async () => {
    await startWith('ask')
    const result = await call('mage_action', { kind: 'boolean' })
    expect(result.isError).toBe(true)
    expect(booleanSends).toBe(0)
  }, 30_000)

  it('rejects an answer that arrives while the auto-pass ack is in flight', async () => {
    await startWith('priority')
    ackDelayMs = 1_500
    await text('mage_auto_pass', { enabled: true })
    const deadline = Date.now() + 10_000
    let session: Record<string, any> = {}
    while (Date.now() < deadline) {
      session = jsonOf(await text('mage_session'))
      if (session.autoPassRepeats >= 1) break
      await sleep(100)
    }
    expect(session.autoPassRepeats).toBe(1)
    const result = await call('mage_pass_priority')
    await sleep(2_000)
    ackDelayMs = 0
    expect(result.isError).toBe(true)
    expect(booleanSends).toBe(1)
  }, 30_000)

  it('mage_action refuses to send a uuid when no prompt is pending', async () => {
    await startWith('none')
    const result = await call('mage_action', { kind: 'uuid', value: 'c1' })
    expect(result.isError).toBe(true)
    expect(uuidSends).toEqual([])
  }, 30_000)

  it('unknown session ids are an error instead of a new empty session', async () => {
    const use = await call('mage_use_session', { session: 'tpyo' })
    expect(use.isError).toBe(true)
    const inspect = await call('mage_session', { session: 'tpyo' })
    expect(inspect.isError).toBe(true)
    const list = jsonOf(await text('mage_sessions'))
    expect(list.map((entry: { sessionId: string }) => entry.sessionId)).not.toContain('tpyo')
  }, 30_000)
})
