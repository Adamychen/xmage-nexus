import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js'
import { WebSocketServer, WebSocket } from 'ws'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

const entry = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'src', 'index.ts')

interface ProxyRequest {
  requestId: string
  action: string
  args?: Record<string, unknown>
}

const controlledPlayer = {
  playerId: 'p1',
  name: 'me',
  controlled: true,
  isActive: true,
  hasPriority: true,
  life: 20,
  handCount: 1,
  libraryCount: 53,
  battlefield: {},
  graveyard: {},
  manaPool: { red: 0, green: 0, blue: 0, white: 0, black: 0, colorless: 0 },
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

describe('MCP game session flow', () => {
  let wss: WebSocketServer
  let url = ''
  const sockets = new Set<WebSocket>()
  const received: ProxyRequest[] = []
  const client = new Client({ name: 'session-test', version: '0.0.0' })

  const text = async (name: string, args: Record<string, unknown> = {}) =>
    contentText(await client.callTool({ name, arguments: args }))
  const requestsFor = (action: string) => received.filter((request) => request.action === action)
  const pushEvent = (event: Record<string, unknown>) => {
    for (const socket of sockets) socket.send(JSON.stringify({ type: 'event', ...event }))
  }
  const priorityEvent = (isActive: boolean, turn: number) => ({
    method: 'GAME_SELECT',
    objectId: 'g1',
    data: {
      message: 'Play instants',
      options: { queryType: 'PLAY_ABILITY' },
      gameView: {
        turn,
        phase: 'PRECOMBAT_MAIN',
        step: 'PRECOMBAT_MAIN',
        activePlayerName: isActive ? 'me' : 'rival',
        priorityPlayerName: 'me',
        myHand: {},
        canPlayObjects: { objects: {} },
        players: [{ ...controlledPlayer, isActive, hasPriority: true }],
      },
    },
  })

  beforeAll(async () => {
    wss = new WebSocketServer({ port: 0 })
    await new Promise<void>((resolve) => wss.once('listening', () => resolve()))
    const address = wss.address()
    url = `ws://127.0.0.1:${typeof address === 'object' && address ? address.port : 0}`
    wss.on('connection', (socket) => {
      sockets.add(socket)
      socket.on('close', () => sockets.delete(socket))
      socket.on('message', (raw) => {
        const message = JSON.parse(String(raw)) as ProxyRequest
        received.push(message)
        socket.send(
          JSON.stringify({
            type: 'result',
            requestId: message.requestId,
            action: message.action,
            ok: true,
            data: message.action === 'connect' ? { serverVersion: 'test' } : null,
          }),
        )
      })
    })
    await client.connect(new StdioClientTransport({ command: process.execPath, args: [entry] }))
  }, 30_000)

  afterAll(async () => {
    await client.close()
    for (const socket of sockets) socket.terminate()
    await new Promise<void>((resolve) => wss.close(() => resolve()))
  })

  it('waits for a priority prompt and answers by option id', async () => {
    const connectText = await text('mage_connect', { proxyUrl: url, host: 'localhost', port: 17171, username: 'mcptest' })
    expect(connectText).toContain('"loggedIn": true')

    pushEvent({ method: 'START_GAME', objectId: 'g1', data: { gameId: 'g1' } })
    pushEvent({
      method: 'GAME_SELECT',
      objectId: 'g1',
      data: {
        message: 'Play spells and abilities',
        options: { queryType: 'PLAY_ABILITY' },
        gameView: {
          turn: 2,
          phase: 'PRECOMBAT_MAIN',
          step: 'PRECOMBAT_MAIN',
          activePlayerName: 'me',
          priorityPlayerName: 'me',
          myHand: { bolt: { name: 'Lightning Bolt', cardTypes: ['INSTANT'] } },
          canPlayObjects: { objects: { bolt: { basicCastAbilities: [{ id: 'a1', value: 'Cast' }] } } },
          players: [controlledPlayer],
        },
      },
    })

    const wait = JSON.parse(await text('mage_wait_for_prompt', { timeoutMs: 5_000 }))
    expect(wait.prompt.mode).toBe('select')
    expect(wait.prompt.options[0].id).toBe('bolt')

    await text('mage_choose', { optionId: 'bolt' })
    expect(requestsFor('sendPlayerUUID').at(-1)?.args).toMatchObject({ value: 'bolt', gameId: 'g1' })
  })

  it('surfaces a mulligan ask and answers keep with sendPlayerBoolean(false)', async () => {
    const before = requestsFor('sendPlayerBoolean').length
    pushEvent({
      method: 'GAME_ASK',
      objectId: 'g1',
      data: { question: 'Keep your hand?', options: { 'UI.left.btn.text': 'Mulligan', 'UI.right.btn.text': 'Keep' } },
    })
    const wait = JSON.parse(await text('mage_wait_for_prompt', { timeoutMs: 5_000 }))
    expect(wait.prompt.flags).toContain('mulligan')
    await text('mage_choose', { optionId: 'right' })
    expect(requestsFor('sendPlayerBoolean').length).toBe(before + 1)
    expect(requestsFor('sendPlayerBoolean').at(-1)?.args).toMatchObject({ value: false, gameId: 'g1' })
  })

  it('auto-passes opponent priority windows and respects the toggle', async () => {
    const before = requestsFor('sendPlayerBoolean').length
    pushEvent(priorityEvent(false, 3))
    await new Promise((resolve) => setTimeout(resolve, 400))
    expect(requestsFor('sendPlayerBoolean').length).toBe(before + 1)
    expect(requestsFor('sendPlayerBoolean').at(-1)?.args).toMatchObject({ value: false, gameId: 'g1' })

    await text('mage_auto_pass', { enabled: false })
    const beforeOff = requestsFor('sendPlayerBoolean').length
    pushEvent(priorityEvent(false, 4))
    await new Promise((resolve) => setTimeout(resolve, 400))
    expect(requestsFor('sendPlayerBoolean').length).toBe(beforeOff)

    await text('mage_auto_pass', { enabled: true })
    const beforeOn = requestsFor('sendPlayerBoolean').length
    pushEvent(priorityEvent(false, 5))
    await new Promise((resolve) => setTimeout(resolve, 400))
    expect(requestsFor('sendPlayerBoolean').length).toBe(beforeOn + 1)
  }, 15_000)
})
