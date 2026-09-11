import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { startFakeServer, loadFake, type FakeConn, type FakeServerHandle } from './support/fakeServer.ts'

const entry = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'src', 'index.ts')

function contentText(result: unknown): string {
  const items = Array.isArray((result as { content?: unknown }).content)
    ? (result as { content: { type?: string; text?: string }[] }).content
    : []
  return items
    .filter((item) => item.type === 'text')
    .map((item) => item.text ?? '')
    .join('\n')
}

function view(turn: number) {
  return {
    turn,
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

describe('multi-session MCP', () => {
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
        tableId: 'table-a',
        tableName: 'A',
        gameId: 'game-a',
        getGameView: () => view(turnA),
        onStartMatch: (conn: FakeConn) => conn.broadcast('GAME_TARGET', { message: 'Choose target A', targets: ['ta'], gameView: view(turnA) }, 'game-a'),
        onSendPlayerUUID: (conn: FakeConn) => {
          turnA = 2
          conn.broadcast('GAME_UPDATE', { gameView: view(turnA) }, 'game-a')
        },
      }),
    )
    fakeB = await startFakeServer(() =>
      makeBaseScenario({
        tableId: 'table-b',
        tableName: 'B',
        gameId: 'game-b',
        getGameView: () => view(turnB),
        onStartMatch: (conn: FakeConn) => conn.broadcast('GAME_TARGET', { message: 'Choose target B', targets: ['tb'], gameView: view(turnB) }, 'game-b'),
        onSendPlayerUUID: (conn: FakeConn) => {
          turnB = 3
          conn.broadcast('GAME_UPDATE', { gameView: view(turnB) }, 'game-b')
        },
      }),
    )
    client = new Client({ name: 'multi-session-test', version: '0.0.0' })
    await client.connect(new StdioClientTransport({ command: process.execPath, args: [entry] }))
  }, 30_000)

  afterAll(async () => {
    await client?.close()
    await fakeA?.stop()
    await fakeB?.stop()
  })

  it('runs two independent games and isolates their state', async () => {
    await startGame('s1', fakeA.url, 'table-a', 'ta', 'game-a')
    await startGame('s2', fakeB.url, 'table-b', 'tb', 'game-b')

    const s1 = jsonOf(await text('mage_use_session', { session: 's1' }))
    expect(s1.sessionId).toBe('s1')
    expect(s1.gameId).toBe('game-a')
    let state = JSON.parse(await text('mage_game_state'))
    expect(state.state.turn).toBe(1)
    expect(state.state.me.life).toBe(20)

    const s2 = jsonOf(await text('mage_use_session', { session: 's2' }))
    expect(s2.gameId).toBe('game-b')

    await text('mage_use_session', { session: 's1' })
    await text('mage_choose', { optionId: 'ta' })
    state = JSON.parse(await text('mage_game_state'))
    expect(state.state.turn).toBe(2)

    await text('mage_use_session', { session: 's2' })
    state = JSON.parse(await text('mage_game_state'))
    expect(state.state.turn).toBe(1)
    await text('mage_choose', { optionId: 'tb' })
    state = JSON.parse(await text('mage_game_state'))
    expect(state.state.turn).toBe(3)

    const list = JSON.parse(await text('mage_sessions'))
    expect(list).toHaveLength(2)
    const entryS1 = list.find((item: { sessionId: string }) => item.sessionId === 's1')
    const entryS2 = list.find((item: { sessionId: string }) => item.sessionId === 's2')
    expect(entryS1.gameId).toBe('game-a')
    expect(entryS2.gameId).toBe('game-b')
    expect(entryS2.active).toBe(true)
    expect(entryS1.active).toBe(false)
  }, 60_000)

  it('disconnecting one session leaves the other connected', async () => {
    await text('mage_use_session', { session: 's1' })
    await text('mage_disconnect')

    const list = JSON.parse(await text('mage_sessions'))
    const entryS1 = list.find((item: { sessionId: string }) => item.sessionId === 's1')
    const entryS2 = list.find((item: { sessionId: string }) => item.sessionId === 's2')
    expect(entryS1.connected).toBe(false)
    expect(entryS2.connected).toBe(true)
    expect(entryS2.loggedIn).toBe(true)

    await text('mage_use_session', { session: 's2' })
    const state = JSON.parse(await text('mage_game_state'))
    expect(state.state.turn).toBe(3)
  }, 30_000)
})
