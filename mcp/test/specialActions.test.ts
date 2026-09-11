import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { startFakeServer, loadFake, type FakeConn, type FakeServerHandle } from './support/fakeServer.ts'

const entry = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'src', 'index.ts')

const GAME_ID = 'game-special-1'
const TABLE_ID = 'table-special-1'

function contentText(result: unknown): string {
  const items = Array.isArray((result as { content?: unknown }).content)
    ? (result as { content: { type?: string; text?: string }[] }).content
    : []
  return items
    .filter((item) => item.type === 'text')
    .map((item) => item.text ?? '')
    .join('\n')
}

function players() {
  return [
    { playerId: 'p1', name: 'me', controlled: true, isActive: true, hasPriority: true, life: 20, handCount: 1, libraryCount: 53, battlefield: {}, graveyard: {} },
    { playerId: 'p2', name: 'rival', controlled: false, isActive: false, hasPriority: false, life: 20, handCount: 7, libraryCount: 53, battlefield: {}, graveyard: {} },
  ]
}

const manaView = {
  turn: 1,
  phase: 'PRECOMBAT_MAIN',
  step: 'PRECOMBAT_MAIN',
  activePlayerName: 'me',
  priorityPlayerName: 'me',
  myHand: {},
  canPlayObjects: { objects: { land1: { id: 'land1', basicManaAbilities: [{ id: 'm1', value: 'Add {R}' }] } } },
  stack: {},
  combat: [],
  players: [
    { ...players()[0], battlefield: { land1: { id: 'land1', name: 'Mountain' } } },
    players()[1],
  ],
}

const combatView = {
  ...manaView,
  canPlayObjects: { objects: {} },
  players: [
    { ...players()[0], battlefield: { a1: { id: 'a1', name: 'Raging Goblin' } } },
    players()[1],
  ],
}

describe('special button actions', () => {
  let fake: FakeServerHandle
  let client: Client
  const specials: string[] = []

  const text = async (name: string, args: Record<string, unknown> = {}) =>
    contentText(await client.callTool({ name, arguments: args }))

  const jsonOf = (value: string): Record<string, any> =>
    JSON.parse(value.includes('\n\n') ? value.slice(value.lastIndexOf('\n\n') + 2) : value)

  beforeAll(async () => {
    const { makeBaseScenario } = await loadFake()
    fake = await startFakeServer(() =>
      makeBaseScenario({
        tableId: TABLE_ID,
        tableName: 'special table',
        gameId: GAME_ID,
        gameView: manaView,
        onStartMatch: (conn: FakeConn) =>
          conn.broadcast('GAME_PLAY_MANA', { message: 'Pay {R}', options: { queryType: 'PLAY_MANA' }, gameView: manaView }, GAME_ID),
        onSendPlayerString: (conn: FakeConn, value: string) => {
          specials.push(value)
          conn.broadcast(
            'GAME_SELECT',
            { message: 'Declare attackers', options: { possibleAttackers: ['a1'], specialButton: 'All attack' }, gameView: combatView },
            GAME_ID,
          )
        },
      }),
    )
    client = new Client({ name: 'special-test', version: '0.0.0' })
    await client.connect(new StdioClientTransport({ command: process.execPath, args: [entry] }))
  }, 30_000)

  afterAll(async () => {
    await client?.close()
    await fake?.stop()
  })

  it('sends sendPlayerString("special") for auto-pay and all-attack', async () => {
    jsonOf(await text('mage_connect', { proxyUrl: fake.url, host: '127.0.0.1', port: 17_171, username: 'mcpspecial' }))
    jsonOf(await text('mage_create_table', { name: 'special' }))
    await text('mage_join_table', {
      tableId: TABLE_ID,
      deck: { name: 'fake deck', cards: [{ cardName: 'Mountain', setCode: 'M10', cardNumber: '1', amount: 40 }] },
    })
    jsonOf(await text('mage_start_match'))

    const mana = JSON.parse(await text('mage_wait_for_prompt', { timeoutMs: 5_000 }))
    expect(mana.prompt.mode).toBe('mana')
    expect(mana.prompt.special).toBe(true)
    const pay = jsonOf(await text('mage_pay_mana', { special: true }))
    expect(pay.special).toBe(true)

    const combat = JSON.parse(await text('mage_wait_for_prompt', { timeoutMs: 5_000 }))
    expect(combat.prompt.mode).toBe('combat')
    expect(combat.prompt.specialLabel).toBe('All attack')
    await text('mage_choose', { optionId: 'special' })

    expect(specials).toEqual(['special', 'special'])
  }, 30_000)
})
