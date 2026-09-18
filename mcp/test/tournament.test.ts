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

const DECK = {
  name: 'P2 sealed build',
  cards: [{ cardName: 'Forest', setCode: 'M20', cardNumber: '280', amount: 40 }],
  sideboard: [],
}

const CANNED: Record<string, (args: Record<string, unknown>) => unknown> = {
  connect: () => ({ serverVersion: 'test' }),
  createTournamentTable: () => ({ tableId: 't-tour' }),
  joinTournamentTable: () => null,
  startTournament: () => null,
  joinTournament: () => null,
  joinGame: () => null,
  getTournament: () => ({ tournamentName: 'P2 Cup', tournamentState: 'Running', rounds: [] }),
  submitDeck: () => null,
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

describe('MCP tournament harness (B.12)', () => {
  let wss: WebSocketServer
  let url = ''
  const sockets = new Set<WebSocket>()
  const received: ProxyRequest[] = []
  const client = new Client({ name: 'tournament-test', version: '0.0.0' })

  const text = async (name: string, args: Record<string, unknown> = {}) =>
    contentText(await client.callTool({ name, arguments: args }))
  const parse = (raw: string): Record<string, unknown> => JSON.parse(raw.slice(raw.indexOf('{'))) as Record<string, unknown>
  const okText = async (name: string, args: Record<string, unknown> = {}) => {
    const result = await client.callTool({ name, arguments: args })
    if (result.isError) throw new Error(`${name}: ${contentText(result)}`)
    return contentText(result)
  }
  const requestsFor = (action: string) => received.filter((request) => request.action === action)
  const pushEvent = (event: Record<string, unknown>) => {
    for (const socket of sockets) socket.send(JSON.stringify({ type: 'event', ...event }))
  }

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
        const canned = CANNED[message.action]
        socket.send(
          JSON.stringify({
            type: 'result',
            requestId: message.requestId,
            action: message.action,
            ok: true,
            data: canned ? canned(message.args ?? {}) : null,
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

  it('create/join/start capturan tableId y tournamentId del evento', async () => {
    await okText('mage_connect', { session: 'p2-t', proxyUrl: url, host: 'localhost', port: 17171, username: 'p2test' })

    const created = parse(
      await okText('mage_create_tournament_table', {
        session: 'p2-t',
        name: 'p2-harness-unit',
        tournamentType: 'Sealed Elimination',
        limited: true,
        limitedOptions: { setCodes: ['M20', 'M20'], numberBoosters: 2, constructionTime: 60 },
        playerTypes: ['HUMAN', 'HUMAN'],
      }),
    )
    expect(created.tableId).toBe('t-tour')
    const sentCreate = requestsFor('createTournamentTable').at(-1)?.args ?? {}
    expect(sentCreate).toMatchObject({
      tournamentType: 'Sealed Elimination',
      deckType: 'Limited',
      limited: true,
      playerTypes: ['HUMAN', 'HUMAN'],
    })
    expect(sentCreate.limitedOptions).toMatchObject({ numberBoosters: 2, constructionTime: 60 })

    await okText('mage_join_tournament_table', { session: 'p2-t', tableId: 't-tour' })
    expect(requestsFor('joinTournamentTable').at(-1)?.args).toMatchObject({ tableId: 't-tour', playerType: 'HUMAN' })

    setTimeout(() => pushEvent({ method: 'START_TOURNAMENT', objectId: 'tr-1', data: { currentTableId: 't-tour' } }), 150)
    const started = parse(await okText('mage_start_tournament', { session: 'p2-t', tableId: 't-tour', waitMs: 10_000 }))
    expect(started.tournamentId).toBe('tr-1')

    const session = parse(await okText('mage_session', { session: 'p2-t' }))
    expect(session.tournamentId).toBe('tr-1')
  }, 20_000)

  it('joinTournament/getTournament usan el id de la sesión y submitDeck envía el mazo', async () => {
    await okText('mage_join_tournament', { session: 'p2-t' })
    expect(requestsFor('joinTournament').at(-1)?.args).toMatchObject({ tournamentId: 'tr-1' })

    const tourney = parse(await okText('mage_get_tournament', { session: 'p2-t' }))
    expect(tourney.tournamentId).toBe('tr-1')
    expect((tourney.tournament as { tournamentName?: string }).tournamentName).toBe('P2 Cup')
    expect(requestsFor('getTournament').at(-1)?.args).toMatchObject({ tournamentId: 'tr-1' })

    const submitted = parse(await okText('mage_submit_deck', { session: 'p2-t', deck: DECK }))
    expect(submitted.ok).toBe(true)
    expect(requestsFor('submitDeck').at(-1)?.args).toMatchObject({ tableId: 't-tour', deck: { name: 'P2 sealed build' } })
  })

  it('joinGame fija gameId y espera la vista fresca', async () => {
    pushEvent({ method: 'START_GAME', objectId: 'g-9', data: { gameId: 'g-9' } })
    await new Promise((resolve) => setTimeout(resolve, 200))
    setTimeout(
      () =>
        pushEvent({
          method: 'GAME_UPDATE',
          objectId: 'g-9',
          data: { gameView: { turn: 1, phase: 'BEGINNING', step: 'UNTAP', players: [] } },
        }),
      150,
    )
    const joined = parse(await okText('mage_join_game', { session: 'p2-t', waitMs: 10_000 }))
    expect(joined.gameId).toBe('g-9')
    expect(joined.freshGameView).toBe(true)
    expect(requestsFor('joinGame').at(-1)?.args).toMatchObject({ gameId: 'g-9' })
  }, 20_000)

  it('mage_create_tournament_table default es un nombre registrado del config', async () => {
    const { tools } = await client.listTools()
    const tool = tools.find((candidate) => candidate.name === 'mage_create_tournament_table')
    const schema = tool?.inputSchema as { properties?: Record<string, { default?: unknown }> } | undefined
    expect(schema?.properties?.tournamentType?.default).toBe('Constructed Elimination')

    await okText('mage_create_tournament_table', { session: 'p2-t', name: 'p2-default-tourney' })
    expect(requestsFor('createTournamentTable').at(-1)?.args).toMatchObject({
      tournamentType: 'Constructed Elimination',
    })
  })

  it('falla sin ids cuando la sesión no conoce torneo ni partida', async () => {
    await okText('mage_connect', { session: 'p2-empty', proxyUrl: url, host: 'localhost', port: 17171, username: 'p2empty' })
    for (const tool of ['mage_join_tournament', 'mage_get_tournament', 'mage_join_game']) {
      const result = await client.callTool({ name: tool, arguments: { session: 'p2-empty' } })
      expect(result.isError).toBe(true)
      expect(contentText(result)).toMatch(/sin (tournamentId|gameId)/)
    }
  })
})
