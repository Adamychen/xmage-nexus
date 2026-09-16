import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { startFakeServer, loadFake, type FakeConn, type FakeServerHandle } from './support/fakeServer.ts'

const entry = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'src', 'index.ts')

const GAME_ID = 'game-cheat-1'
const TABLE_ID = 'table-cheat-1'

function contentText(result: unknown): string {
  const items = Array.isArray((result as { content?: unknown }).content)
    ? (result as { content: { type?: string; text?: string }[] }).content
    : []
  return items
    .filter((item) => item.type === 'text')
    .map((item) => item.text ?? '')
    .join('\n')
}

const gameView = {
  turn: 1,
  phase: 'PRECOMBAT_MAIN',
  step: 'PRECOMBAT_MAIN',
  activePlayerName: 'me',
  priorityPlayerName: 'me',
  myHand: {},
  canPlayObjects: { objects: {} },
  stack: {},
  combat: [],
  players: [
    {
      playerId: 'p1',
      name: 'me',
      controlled: true,
      isActive: true,
      hasPriority: true,
      life: 20,
      handCount: 0,
      libraryCount: 53,
      battlefield: {},
      graveyard: {},
      manaPool: { green: 0 },
    },
    {
      playerId: 'p2',
      name: 'rival',
      controlled: false,
      isActive: false,
      hasPriority: false,
      life: 20,
      handCount: 7,
      libraryCount: 53,
      battlefield: {},
      graveyard: {},
    },
  ],
}

describe('MCP cheatSetup (test-mode seeding)', () => {
  let fake: FakeServerHandle
  let client: Client
  const received: { playerId: string; zones: Record<string, string[]> }[] = []
  let failNext = false

  const text = async (name: string, args: Record<string, unknown> = {}) =>
    contentText(await client.callTool({ name, arguments: args }))
  const parse = (raw: string): Record<string, unknown> => JSON.parse(raw.slice(raw.indexOf('{'))) as Record<string, unknown>

  beforeAll(async () => {
    const { makeBaseScenario } = await loadFake()
    fake = await startFakeServer(() =>
      makeBaseScenario({
        tableId: TABLE_ID,
        tableName: 'cheat table',
        gameId: GAME_ID,
        gameView,
        onRequest: (conn: FakeConn, action: string, args: Record<string, unknown>, requestId: string | number): boolean => {
          if (action !== 'cheatSetup') return false
          if (failNext) {
            conn.fail(requestId, action, 'FAILED')
            return true
          }
          received.push({
            playerId: String(args.playerId ?? ''),
            zones: (args.zones ?? {}) as Record<string, string[]>,
          })
          conn.ok(requestId, action)
          return true
        },
      }),
    )
    client = new Client({ name: 'cheat-test', version: '0.0.0' })
    await client.connect(new StdioClientTransport({ command: process.execPath, args: [entry] }))
  }, 30_000)

  afterAll(async () => {
    await client?.close()
    await fake?.stop()
  })

  it('siembra zonas por nombre en el jugador controlado y propaga el error del servidor', async () => {
    parse(await text('mage_connect', { proxyUrl: fake.url, host: '127.0.0.1', port: 17_171, username: 'mcpcheat' }))
    parse(await text('mage_create_table', { name: 'cheat' }))
    await text('mage_join_table', {
      tableId: TABLE_ID,
      deck: { name: 'fake deck', cards: [{ cardName: 'Island', setCode: 'M10', cardNumber: '1', amount: 40 }] },
    })
    const started = parse(await text('mage_start_match'))
    expect(started.gameId).toBe(GAME_ID)

    const out = parse(
      await text('mage_cheat_setup', {
        hand: ['Counterspell', 'Counterspell'],
        battlefield: ['Island', 'Island'],
        library: ['Lightning Bolt'],
        graveyard: ['Opt'],
        exile: ['Swords to Plowshares'],
      }),
    )
    expect(out.ok).toBe(true)
    expect(out.playerId).toBe('p1')
    expect(received).toEqual([
      {
        playerId: 'p1',
        zones: {
          hand: ['Counterspell', 'Counterspell'],
          battlefield: ['Island', 'Island'],
          library: ['Lightning Bolt'],
          graveyard: ['Opt'],
          exile: ['Swords to Plowshares'],
        },
      },
    ])

    const rival = parse(await text('mage_cheat_setup', { playerId: 'p2', battlefield: ['Elvish Mystic'] }))
    expect(rival.playerId).toBe('p2')
    expect(received[1]).toEqual({ playerId: 'p2', zones: { battlefield: ['Elvish Mystic'] } })

    const none = await client.callTool({ name: 'mage_cheat_setup', arguments: {} })
    expect(none.isError).toBe(true)
    expect(contentText(none)).toMatch(/al menos una zona/)

    failNext = true
    const failed = await client.callTool({ name: 'mage_cheat_setup', arguments: { battlefield: ['Island'] } })
    expect(failed.isError).toBe(true)
    expect(contentText(failed)).toMatch(/cheatSetup falló/)
    failNext = false
  }, 60_000)
})
