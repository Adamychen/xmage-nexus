import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { startFakeServer, loadFake, type FakeConn, type FakeServerHandle } from './support/fakeServer.ts'

const entry = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'src', 'index.ts')

const GAME_ID = 'game-autopass-1'
const TABLE_ID = 'table-autopass-1'
const MAX_REPEATS = 5

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

function contentText(result: unknown): string {
  const items = Array.isArray((result as { content?: unknown }).content)
    ? (result as { content: { type?: string; text?: string }[] }).content
    : []
  return items
    .filter((item) => item.type === 'text')
    .map((item) => item.text ?? '')
    .join('\n')
}

function gameView() {
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

describe('auto-pass anti-flood', () => {
  let fake: FakeServerHandle
  let client: Client
  let booleanSends = 0

  const text = async (name: string, args: Record<string, unknown> = {}) =>
    contentText(await client.callTool({ name, arguments: args }))

  const jsonOf = (value: string): Record<string, any> =>
    JSON.parse(value.includes('\n\n') ? value.slice(value.lastIndexOf('\n\n') + 2) : value)

  beforeAll(async () => {
    const { makeBaseScenario } = await loadFake()
    fake = await startFakeServer(() =>
      makeBaseScenario({
        tableId: TABLE_ID,
        tableName: 'autopass table',
        gameId: GAME_ID,
        gameView: gameView(),
        onSendPlayerBoolean: (conn: FakeConn) => {
          booleanSends++
          conn.broadcast('GAME_SELECT', { message: 'opponent priority', options: { specialButton: 'Pass' }, gameView: gameView() }, GAME_ID)
        },
      }),
    )
    client = new Client({ name: 'autopass-test', version: '0.0.0' })
    await client.connect(new StdioClientTransport({ command: process.execPath, args: [entry] }))
  }, 30_000)

  afterAll(async () => {
    await client?.close()
    await fake?.stop()
  })

  it('stops auto-passing after the server repeats the same prompt', async () => {
    jsonOf(await text('mage_connect', { proxyUrl: fake.url, host: '127.0.0.1', port: 17_171, username: 'mcpap' }))
    jsonOf(await text('mage_create_table', { name: 'autopass' }))
    await text('mage_join_table', {
      tableId: TABLE_ID,
      deck: { name: 'fake deck', cards: [{ cardName: 'Mountain', setCode: 'M10', cardNumber: '1', amount: 40 }] },
    })
    jsonOf(await text('mage_start_match'))

    let session: Record<string, any> = {}
    const deadline = Date.now() + 10_000
    while (Date.now() < deadline) {
      session = JSON.parse(await text('mage_session'))
      if (session.autoPass === false) break
      await sleep(200)
    }
    expect(session.autoPass).toBe(false)
    expect(booleanSends).toBe(MAX_REPEATS)
    expect(session.events.some((event: { method: string }) => event.method.startsWith('AUTO_PASS_STOPPED'))).toBe(true)

    const wait = JSON.parse(await text('mage_wait_for_prompt', { timeoutMs: 2_000 }))
    expect(wait.prompt.mode).toBe('select')
  }, 30_000)
})
