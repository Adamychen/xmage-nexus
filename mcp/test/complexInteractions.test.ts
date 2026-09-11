import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { startFakeServer, loadFake, type FakeConn, type FakeServerHandle } from './support/fakeServer.ts'

const entry = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'src', 'index.ts')

const GAME_ID = 'game-complex-1'
const TABLE_ID = 'table-complex-1'

type Call = (name: string, args?: Record<string, unknown>) => Promise<string>

interface ScriptedStep {
  label: string
  method: string
  data: Record<string, unknown>
  check?: (prompt: any) => void
  driver: (call: Call) => Promise<void>
  expected: { action: string; value: unknown }
}

function contentText(result: unknown): string {
  const items = Array.isArray((result as { content?: unknown }).content)
    ? (result as { content: { type?: string; text?: string }[] }).content
    : []
  return items
    .filter((item) => item.type === 'text')
    .map((item) => item.text ?? '')
    .join('\n')
}

const manaView = {
  turn: 1,
  phase: 'PRECOMBAT_MAIN',
  step: 'PRECOMBAT_MAIN',
  activePlayerName: 'me',
  priorityPlayerName: 'me',
  myHand: {},
  canPlayObjects: { objects: { 'creature-mystic': { id: 'creature-mystic' }, 'land-forest': { id: 'land-forest' } } },
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
      battlefield: { 'creature-mystic': { id: 'creature-mystic', name: 'Elvish Mystic' }, 'land-forest': { id: 'land-forest', name: 'Forest' } },
      graveyard: {},
      manaPool: { green: 0 },
    },
    { playerId: 'p2', name: 'rival', controlled: false, isActive: false, hasPriority: false, life: 20, handCount: 7, libraryCount: 53, battlefield: {}, graveyard: {} },
  ],
}

const steps: ScriptedStep[] = [
  {
    label: 'phyrexian GAME_ASK',
    method: 'GAME_ASK',
    data: { message: 'Pay 2 life to cast?', options: {} },
    check: (prompt) => expect(prompt.mode).toBe('boolean'),
    driver: async (call) => void (await call('mage_choose', { optionId: 'yes' })),
    expected: { action: 'sendPlayerBoolean', value: true },
  },
  {
    label: 'kicker GAME_ASK',
    method: 'GAME_ASK',
    data: { message: 'Kicker {1}{R}?', options: {} },
    driver: async (call) => void (await call('mage_choose', { optionId: 'yes' })),
    expected: { action: 'sendPlayerBoolean', value: true },
  },
  {
    label: 'split card GAME_CHOOSE_ABILITY',
    method: 'GAME_CHOOSE_ABILITY',
    data: { message: 'Choose Fire or Ice', choices: { fire: { label: 'Fire' }, ice: { label: 'Ice' } } },
    check: (prompt) => expect(prompt.mode).toBe('uuid'),
    driver: async (call) => void (await call('mage_choose', { optionId: 'ice' })),
    expected: { action: 'sendPlayerUUID', value: 'ice' },
  },
  {
    label: 'adventure GAME_CHOOSE_ABILITY',
    method: 'GAME_CHOOSE_ABILITY',
    data: { message: 'Cast Stomp or creature?', choices: { creature: { label: 'Bonecrusher Giant' }, adventure: { label: 'Stomp' } } },
    driver: async (call) => void (await call('mage_choose', { optionId: 'adventure' })),
    expected: { action: 'sendPlayerUUID', value: 'adventure' },
  },
  {
    label: 'convoke mana step 1',
    method: 'GAME_PLAY_MANA',
    data: { message: 'Pay {2}{G}', options: { queryType: 'PLAY_MANA' }, gameView: manaView },
    check: (prompt) => {
      expect(prompt.mode).toBe('mana')
      expect(prompt.options.map((option: { id: string }) => option.id)).toContain('creature-mystic')
    },
    driver: async (call) => void (await call('mage_pay_mana', { sourceId: 'creature-mystic' })),
    expected: { action: 'sendPlayerUUID', value: 'creature-mystic' },
  },
  {
    label: 'convoke mana step 2',
    method: 'GAME_PLAY_MANA',
    data: { message: 'Pay {G}', options: { queryType: 'PLAY_MANA' }, gameView: manaView },
    driver: async (call) => void (await call('mage_pay_mana', { sourceId: 'land-forest' })),
    expected: { action: 'sendPlayerUUID', value: 'land-forest' },
  },
  {
    label: 'X mana confirm',
    method: 'GAME_PLAY_XMANA',
    data: { message: 'Pay X mana?' },
    check: (prompt) => expect(prompt.mode).toBe('boolean'),
    driver: async (call) => void (await call('mage_choose', { optionId: 'yes' })),
    expected: { action: 'sendPlayerBoolean', value: true },
  },
  {
    label: 'X amount',
    method: 'GAME_GET_AMOUNT',
    data: { message: 'Choose X', min: 0, max: 5 },
    check: (prompt) => {
      expect(prompt.mode).toBe('integer')
      expect(prompt.max).toBe(5)
    },
    driver: async (call) => void (await call('mage_choose', { value: 3 })),
    expected: { action: 'sendPlayerInteger', value: 3 },
  },
  {
    label: 'choose pile',
    method: 'GAME_CHOOSE_PILE',
    data: { message: 'Choose pile', cardsView1: { a: { id: 'a', name: 'A' } }, cardsView2: { b: { id: 'b', name: 'B' } } },
    driver: async (call) => void (await call('mage_choose', { optionId: 'pile1' })),
    expected: { action: 'sendPlayerBoolean', value: true },
  },
  {
    label: 'choose mode',
    method: 'GAME_CHOOSE_MODE',
    data: { message: 'Choose mode', choices: { m1: { label: 'Mode 1' }, m2: { label: 'Mode 2' } } },
    driver: async (call) => void (await call('mage_choose', { optionId: 'm2' })),
    expected: { action: 'sendPlayerUUID', value: 'm2' },
  },
  {
    label: 'choose color',
    method: 'GAME_CHOOSE_COLOR',
    data: { message: 'Choose a color' },
    driver: async (call) => void (await call('mage_choose', { optionId: 'R' })),
    expected: { action: 'sendPlayerString', value: 'R' },
  },
  {
    label: 'order cards by index',
    method: 'GAME_CHOOSE_CARDS_ORDER',
    data: {
      message: 'Order cards',
      cardsView1: { c1: { id: 'c1', name: 'A' }, c2: { id: 'c2', name: 'B' }, c3: { id: 'c3', name: 'C' } },
    },
    check: (prompt) => expect(prompt.mode).toBe('order'),
    driver: async (call) => void (await call('mage_choose', { values: [2, 0, 1] })),
    expected: { action: 'sendPlayerString', value: 'c3 c1 c2' },
  },
  {
    label: 'multi amount',
    method: 'GAME_GET_MULTI_AMOUNT',
    data: {
      message: 'Distribute',
      min: 0,
      max: 6,
      messages: [
        { id: 'a', message: 'A', min: 0, max: 3, defaultValue: 1 },
        { id: 'b', message: 'B', min: 0, max: 3, defaultValue: 0 },
      ],
    },
    check: (prompt) => expect(prompt.mode).toBe('multiString'),
    driver: async (call) => void (await call('mage_choose', { values: [1, 2] })),
    expected: { action: 'sendPlayerString', value: '1 2' },
  },
  {
    label: 'trigger order',
    method: 'GAME_TARGET',
    data: {
      message: 'Pick triggered ability (goes to the stack first)',
      options: { queryType: 'PICK_ABILITY' },
      targets: ['t1', 't2'],
      cardsView1: { t1: { id: 't1', name: 'Soul Warden' }, t2: { id: 't2', name: 'Blood Artist' } },
      gameView: manaView,
    },
    check: (prompt) => {
      expect(prompt.mode).toBe('uuid')
      expect(prompt.flags).toContain('trigger-order')
    },
    driver: async (call) => void (await call('mage_choose', { optionId: 't2' })),
    expected: { action: 'sendPlayerUUID', value: 't2' },
  },
]

describe('complex interactions matrix', () => {
  let fake: FakeServerHandle
  let client: Client
  const received: { action: string; value: unknown }[] = []
  let activeConn: FakeConn | null = null
  let cursor = 0

  const text = async (name: string, args: Record<string, unknown> = {}) =>
    contentText(await client.callTool({ name, arguments: args }))

  const jsonOf = (value: string): Record<string, any> =>
    JSON.parse(value.includes('\n\n') ? value.slice(value.lastIndexOf('\n\n') + 2) : value)

  beforeAll(async () => {
    const { makeBaseScenario } = await loadFake()
    fake = await startFakeServer(() => {
      const emit = () => {
        const step = steps[cursor]
        if (step) activeConn?.broadcast(step.method, step.data, GAME_ID)
      }
      const advance = (action: string, value: unknown) => {
        received.push({ action, value })
        cursor++
        if (cursor < steps.length) emit()
        else activeConn?.broadcast('GAME_OVER', { winner: 'me' }, GAME_ID)
      }
      return makeBaseScenario({
        tableId: TABLE_ID,
        tableName: 'complex table',
        gameId: GAME_ID,
        gameView: manaView,
        onConnect: (conn: FakeConn) => {
          activeConn = conn
        },
        onStartMatch: (conn: FakeConn) => {
          activeConn = conn
          emit()
        },
        onSendPlayerUUID: (_conn: FakeConn, uuid: string) => advance('sendPlayerUUID', uuid),
        onSendPlayerBoolean: (_conn: FakeConn, ctx: { args: Record<string, unknown> }) =>
          advance('sendPlayerBoolean', ctx.args.value === true || ctx.args.value === 'true'),
        onSendPlayerInteger: (_conn: FakeConn, value: number) => advance('sendPlayerInteger', value),
        onSendPlayerString: (_conn: FakeConn, value: string) => advance('sendPlayerString', value),
      })
    })
    client = new Client({ name: 'complex-test', version: '0.0.0' })
    await client.connect(new StdioClientTransport({ command: process.execPath, args: [entry] }))
  }, 30_000)

  afterAll(async () => {
    await client?.close()
    await fake?.stop()
  })

  it('answers every interaction with the web-compatible action', async () => {
    jsonOf(await text('mage_connect', { proxyUrl: fake.url, host: '127.0.0.1', port: 17_171, username: 'mcpcomplex' }))
    await text('mage_auto_pass', { enabled: false })
    jsonOf(await text('mage_create_table', { name: 'complex' }))
    await text('mage_join_table', {
      tableId: TABLE_ID,
      deck: { name: 'fake deck', cards: [{ cardName: 'Mountain', setCode: 'M10', cardNumber: '1', amount: 40 }] },
    })
    jsonOf(await text('mage_start_match'))

    let lastSeq = 0
    for (const step of steps) {
      const wait = JSON.parse(await text('mage_wait_for_prompt', { timeoutMs: 5_000, afterSeq: lastSeq }))
      expect(wait.timeout, `timeout en "${step.label}"`).toBeUndefined()
      expect(wait.prompt, `sin prompt en "${step.label}"`).toBeTruthy()
      expect(wait.prompt.method, `método en "${step.label}"`).toBe(step.method)
      lastSeq = wait.promptSeq
      step.check?.(wait.prompt)
      await step.driver(text)
    }

    const over = JSON.parse(await text('mage_wait_for_prompt', { timeoutMs: 5_000, afterSeq: lastSeq }))
    expect(over.gameOver).toBe(true)
    expect(received).toEqual(steps.map((step) => step.expected))
  }, 60_000)
})
