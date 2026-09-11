import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { startFakeServer, loadFake, type FakeConn, type FakeServerHandle } from './support/fakeServer.ts'

const entry = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'src', 'index.ts')

const GAME_ID = 'game-fake-1'
const TABLE_ID = 'table-fake-1'
const GOBLIN_ID = 'card-goblin'

function contentText(result: unknown): string {
  const items = Array.isArray((result as { content?: unknown }).content)
    ? (result as { content: { type?: string; text?: string }[] }).content
    : []
  return items
    .filter((item) => item.type === 'text')
    .map((item) => item.text ?? '')
    .join('\n')
}

function gameView(played: boolean) {
  return {
    turn: 1,
    phase: 'PRECOMBAT_MAIN',
    step: 'PRECOMBAT_MAIN',
    activePlayerName: 'me',
    priorityPlayerName: 'me',
    myHand: played ? {} : { [GOBLIN_ID]: { id: GOBLIN_ID, name: 'Raging Goblin', displayName: 'Raging Goblin', manaCostLeftStr: ['{R}'], cardTypes: ['Creature'] } },
    canPlayObjects: { objects: played ? {} : { [GOBLIN_ID]: { id: GOBLIN_ID, value: 'Cast' } } },
    stack: {},
    combat: [],
    players: [
      {
        playerId: 'p1',
        name: 'me',
        controlled: true,
        isHuman: true,
        isActive: true,
        hasPriority: true,
        life: 20,
        handCount: played ? 0 : 1,
        libraryCount: 53,
        battlefield: played
          ? { [GOBLIN_ID]: { id: GOBLIN_ID, name: 'Raging Goblin', displayName: 'Raging Goblin', power: '1', toughness: '1', cardTypes: ['Creature'], tapped: true } }
          : {},
        graveyard: {},
        manaPool: { red: 0, green: 0, blue: 0, white: 0, black: 0, colorless: 0 },
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
}

describe('MCP against the web FixtureServer', () => {
  let fake: FakeServerHandle
  let client: Client
  let played = false

  const text = async (name: string, args: Record<string, unknown> = {}) =>
    contentText(await client.callTool({ name, arguments: args }))

  const jsonOf = (value: string): Record<string, any> =>
    JSON.parse(value.includes('\n\n') ? value.slice(value.lastIndexOf('\n\n') + 2) : value)

  beforeAll(async () => {
    const { makeBaseScenario } = await loadFake()
    fake = await startFakeServer(() =>
      makeBaseScenario({
        tableId: TABLE_ID,
        tableName: 'fake table',
        gameId: GAME_ID,
        getGameView: () => gameView(played),
        onSendPlayerUUID: (conn: FakeConn, uuid: string) => {
          if (uuid !== GOBLIN_ID) return
          played = true
          conn.broadcast('GAME_UPDATE', { gameView: gameView(played) }, GAME_ID)
          conn.broadcast('GAME_SELECT', { message: 'Main 1', options: { specialButton: 'Pass' }, gameView: gameView(played) }, GAME_ID)
        },
        onSendPlayerBoolean: (conn: FakeConn) => {
          conn.broadcast('GAME_OVER', { winner: 'me' }, GAME_ID)
        },
      }),
    )
    client = new Client({ name: 'fake-game-test', version: '0.0.0' })
    await client.connect(new StdioClientTransport({ command: process.execPath, args: [entry] }))
  }, 30_000)

  afterAll(async () => {
    await client?.close()
    await fake?.stop()
  })

  it('plays connect → table → start → playable → pass → GAME_OVER against the fake server', async () => {
    const connect = jsonOf(await text('mage_connect', { proxyUrl: fake.url, host: '127.0.0.1', port: 17_171, username: 'mcpfake' }))
    expect(connect.loggedIn).toBe(true)

    await text('mage_auto_pass', { enabled: false })
    const table = jsonOf(await text('mage_create_table', { name: 'fake' }))
    expect(table.tableId).toBe(TABLE_ID)

    const joined = await text('mage_join_table', {
      tableId: TABLE_ID,
      deck: { name: 'fake deck', cards: [{ cardName: 'Mountain', setCode: 'M10', cardNumber: '1', amount: 40 }] },
    })
    expect(joined).toContain(`unido a ${TABLE_ID}`)

    const started = jsonOf(await text('mage_start_match'))
    expect(started.gameId).toBe(GAME_ID)

    const wait = JSON.parse(await text('mage_wait_for_prompt', { timeoutMs: 5_000 }))
    expect(wait.prompt.mode).toBe('select')
    expect(wait.prompt.options[0].id).toBe(GOBLIN_ID)

    let state = JSON.parse(await text('mage_game_state'))
    expect(state.state.me.life).toBe(20)
    expect(state.state.hand).toHaveLength(1)

    await text('mage_play_card', { cardId: GOBLIN_ID })
    state = JSON.parse(await text('mage_game_state'))
    expect(state.state.battlefield.mine).toHaveLength(1)
    expect(state.state.battlefield.mine[0].name).toBe('Raging Goblin')

    await text('mage_pass_priority')
    const over = JSON.parse(await text('mage_wait_for_prompt', { timeoutMs: 5_000 }))
    expect(over.gameOver).toBe(true)
  }, 30_000)
})
