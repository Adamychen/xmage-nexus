import { z } from 'zod'
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import type { GameView } from '../../../web/src/net/types.generated.ts'
import { json, sleep, textResult, truncate } from '../lib.ts'
import { compactGameView } from './compactView.ts'
import { normalizePrompt, type PromptView } from './promptView.ts'
import { ProxyClient, type ProxyEvent } from './wsClient.ts'

const DEFAULT_PROXY_URL = 'ws://127.0.0.1:8787'
const DEFAULT_HOST = '127.0.0.1'
const DEFAULT_PORT = 17_171
const EVENT_RING = 200
const AUTO_PASS_MAX_REPEATS = 5

const deckCardSchema = z.object({
  cardName: z.string(),
  setCode: z.string(),
  cardNumber: z.string(),
  amount: z.number().int().min(1),
})

const deckSchema = z.object({
  name: z.string(),
  cards: z.array(deckCardSchema),
  sideboard: z.array(deckCardSchema).optional(),
})

interface SessionEvent {
  at: number
  method: string
  objectId: string | null
}

interface PromptEntry {
  seq: number
  at: number
  method: string
  view: PromptView
}

interface SessionState {
  client: ProxyClient | null
  loggedIn: boolean
  proxyUrl: string
  host: string | null
  port: number | null
  username: string | null
  password: string | null
  tableId: string | null
  gameId: string | null
  lastGameView: unknown
  lastConnectAttached: boolean | null
  events: SessionEvent[]
  prompts: PromptEntry[]
  promptSeq: number
  pendingPrompt: PromptEntry | null
  autoPass: boolean
  autoPassSignature: string | null
  autoPassRepeats: number
  payingUntil: number
  gameOver: { at: number; data: unknown } | null
}

const DEFAULT_SESSION = 'default'
const sessions = new Map<string, SessionState>()

function createSessionState(): SessionState {
  return {
    client: null,
    loggedIn: false,
    proxyUrl: DEFAULT_PROXY_URL,
    host: null,
    port: null,
    username: null,
    password: null,
    tableId: null,
    gameId: null,
    lastGameView: null,
    lastConnectAttached: null,
    events: [],
    prompts: [],
    promptSeq: 0,
    pendingPrompt: null,
    autoPass: true,
    autoPassSignature: null,
    autoPassRepeats: 0,
    payingUntil: 0,
    gameOver: null,
  }
}

function resolveSession(id: string): SessionState {
  let session = sessions.get(id)
  if (!session) {
    session = createSessionState()
    sessions.set(id, session)
  }
  return session
}

let activeState: SessionState = resolveSession(DEFAULT_SESSION)

function activateSession(id: string): SessionState {
  activeState = resolveSession(id)
  return activeState
}

function sessionIdOf(target: SessionState): string {
  for (const [id, session] of sessions) {
    if (session === target) return id
  }
  return DEFAULT_SESSION
}

function attach(state: SessionState, client: ProxyClient): void {
  client.on('event', (event: ProxyEvent) => {
    const method = String(event.method ?? '')
    if (event.objectId && (method === 'START_GAME' || method.startsWith('GAME_'))) {
      state.gameId = String(event.objectId)
    }
    const data = event.data
    if (data && typeof data === 'object' && 'gameView' in data && data.gameView) {
      state.lastGameView = data.gameView
    }
    if (method === 'GAME_PLAY_MANA' || method === 'GAME_PLAY_XMANA') {
      state.payingUntil = Date.now() + 4_000
    }
    if (method === 'START_GAME') {
      state.gameOver = null
      state.pendingPrompt = null
      state.autoPassSignature = null
      state.autoPassRepeats = 0
    }
    const prompt = normalizePrompt(method, data, state.gameId)
    if (prompt) {
      const entry: PromptEntry = { seq: ++state.promptSeq, at: Date.now(), method, view: prompt }
      state.prompts.push(entry)
      if (state.prompts.length > 50) state.prompts.shift()
      state.pendingPrompt = entry
      void maybeAutoPass(state, entry)
    }
    if (method === 'GAME_OVER') {
      state.gameOver = { at: Date.now(), data }
      state.pendingPrompt = null
    }
    state.events.push({
      at: Date.now(),
      method,
      objectId: event.objectId ? String(event.objectId) : null,
    })
    if (state.events.length > EVENT_RING) state.events.shift()
  })
  client.on('closed', () => {
    if (state.client === client && !client.autoReconnect) {
      state.client = null
    }
    state.loggedIn = false
    state.events.push({ at: Date.now(), method: 'WS_CLOSED', objectId: null })
  })
  client.on('reopened', () => {
    void resyncAfterReconnect(state, client)
  })
}

function controlledPlayerId(state: SessionState): string | undefined {
  const view = state.lastGameView as GameView | null
  return view?.players?.find((player) => player.controlled === true)?.playerId
}

function canAutoPass(state: SessionState, entry: PromptEntry): boolean {
  if (!state.autoPass) return false
  if (entry.view.mode !== 'select') return false
  if (Date.now() < state.payingUntil) return false
  const view = state.lastGameView as GameView | null
  const me = view?.players?.find((player) => player.controlled === true)
  if (me?.isActive === true && entry.view.options.length > 0) return false
  return true
}

function autoPassSignatureOf(state: SessionState, entry: PromptEntry): string {
  const view = state.lastGameView as GameView | null
  const options = entry.view.options.map((option) => option.id).join(',')
  return `${entry.method}|${view?.turn ?? '?'}|${view?.phase ?? '?'}|${view?.step ?? '?'}|${options}`
}

async function maybeAutoPass(state: SessionState, entry: PromptEntry): Promise<void> {
  if (!canAutoPass(state, entry)) return
  const client = state.client
  const gameId = state.gameId
  if (!client?.isOpen || !gameId) return
  const signature = autoPassSignatureOf(state, entry)
  if (signature === state.autoPassSignature) {
    state.autoPassRepeats++
  } else {
    state.autoPassSignature = signature
    state.autoPassRepeats = 1
  }
  if (state.autoPassRepeats > AUTO_PASS_MAX_REPEATS) {
    state.autoPass = false
    state.events.push({ at: Date.now(), method: `AUTO_PASS_STOPPED ${signature}`, objectId: gameId })
    return
  }
  try {
    await client.requestOk('sendPlayerBoolean', { gameId, value: false }, 10_000)
    if (state.pendingPrompt?.seq === entry.seq) state.pendingPrompt = null
    state.events.push({ at: Date.now(), method: 'AUTO_PASS', objectId: gameId })
  } catch (error) {
    state.events.push({ at: Date.now(), method: `AUTO_PASS_FAILED ${(error as Error).message}`, objectId: gameId })
  }
}

function requireClient(state: SessionState): ProxyClient {
  if (!state.client?.isOpen) throw new Error('proxy no conectado — usa mage_connect primero')
  if (!state.loggedIn) throw new Error('sesión XMage no autenticada — usa mage_connect primero')
  return state.client
}

async function waitFor<T>(read: () => T | null, timeoutMs: number, label: string): Promise<T> {
  const started = Date.now()
  while (Date.now() - started < timeoutMs) {
    const value = read()
    if (value !== null) return value
    await sleep(250)
  }
  throw new Error(`timeout esperando ${label} (${timeoutMs}ms)`)
}

async function connectToProxy(state: SessionState, input: {
  proxyUrl: string
  host: string
  port: number
  username: string
  password: string
  timeoutSec: number
}): Promise<void> {
  if (state.client) {
    state.client.close()
    state.client = null
  }
  state.loggedIn = false
  const client = new ProxyClient(input.proxyUrl)
  attach(state, client)
  await client.open(10_000)
  state.client = client
  state.proxyUrl = input.proxyUrl
  state.host = input.host
  state.port = input.port
  state.username = input.username
  state.password = input.password
  state.gameId = null
  state.tableId = null
  state.lastGameView = null
  state.prompts = []
  state.promptSeq = 0
  state.pendingPrompt = null
  state.gameOver = null
  state.payingUntil = 0
  const deadline = Date.now() + input.timeoutSec * 1_000
  let lastError = ''
  try {
    while (Date.now() < deadline) {
      try {
        await client.requestOk(
          'connect',
          { host: input.host, port: input.port, username: input.username, password: input.password },
          60_000,
        )
        state.loggedIn = true
        client.setAutoReconnect(true)
        return
      } catch (error) {
        lastError = (error as Error).message
        if (!lastError.includes('WARMING_UP')) throw error
        await sleep(3_000)
      }
    }
    throw new Error(`connect no completó en ${input.timeoutSec}s (${lastError})`)
  } catch (error) {
    client.close()
    if (state.client === client) state.client = null
    state.loggedIn = false
    throw error
  }
}

async function resyncAfterReconnect(state: SessionState, client: ProxyClient): Promise<{ ok: boolean; error?: string }> {
  state.events.push({ at: Date.now(), method: 'WS_REOPENED', objectId: null })
  try {
    if (!state.host || !state.username) throw new Error('sin credenciales guardadas para re-loguear')
    const data = (await client.requestOk(
      'connect',
      { host: state.host, port: state.port, username: state.username, password: state.password },
      60_000,
    )) as { attached?: boolean } | null
    const attached = data?.attached === true
    state.lastConnectAttached = attached
    state.client = client
    state.loggedIn = true
    state.pendingPrompt = null
    state.payingUntil = 0
    const gameId = state.gameId
    if (gameId && data?.attached === false) {
      state.gameId = null
      state.lastGameView = null
      state.events.push({ at: Date.now(), method: 'RECONNECT_NEW_SESSION', objectId: gameId })
    } else if (gameId) {
      state.lastGameView = null
      const joined = await client.requestOk('joinGame', { gameId }, 20_000)
      if (joined === false) throw new Error('joinGame rechazado')
      try {
        await waitFor(() => state.lastGameView, 15_000, 'gameView tras reconectar')
      } catch {
        state.events.push({ at: Date.now(), method: 'RESYNC_NO_GAMEVIEW', objectId: gameId })
      }
    }
    state.events.push({ at: Date.now(), method: 'RECONNECTED', objectId: gameId })
    return { ok: true }
  } catch (error) {
    state.loggedIn = false
    state.gameId = null
    state.lastGameView = null
    state.events.push({ at: Date.now(), method: `RECONNECT_FAILED ${(error as Error).message}`, objectId: null })
    return { ok: false, error: (error as Error).message }
  }
}

export function registerSessionTools(server: McpServer): void {
  function requireGameId(state: SessionState): string {
    const gameId = state.gameId
    if (!gameId) throw new Error('sin partida activa — arranca una con mage_start_match')
    return gameId
  }

  function currentPromptView(state: SessionState): PromptView | null {
    return state.pendingPrompt?.view ?? null
  }

  async function answer(state: SessionState, action: string, args: Record<string, unknown>, entry: PromptEntry | null): Promise<unknown> {
    const client = requireClient(state)
    const data = await client.requestOk(action, { ...args, gameId: requireGameId(state) }, 20_000)
    if (entry && state.pendingPrompt?.seq === entry.seq) state.pendingPrompt = null
    state.autoPassSignature = null
    state.autoPassRepeats = 0
    return data
  }

  function modeMismatch(kind: string, view: PromptView | null): string | null {
    if (!view) return null
    const allowed: Record<string, string[]> = {
      uuid: ['uuid', 'mana', 'combat', 'select'],
      boolean: ['boolean', 'combat', 'select'],
      integer: ['integer'],
      string: ['string', 'order', 'multiString'],
      manaType: ['mana'],
    }
    const modes = allowed[kind] ?? []
    return modes.includes(view.mode) ? null : `kind "${kind}" no responde a un prompt modo "${view.mode}" (${view.method})`
  }

  const compactState = (state: SessionState) => {
    const view = state.lastGameView as GameView | null
    return view ? compactGameView(view) : null
  }

  const promptSummary = (state: SessionState) => {
    const entry = state.pendingPrompt
    return entry ? { seq: entry.seq, method: entry.method, mode: entry.view.mode, title: entry.view.title } : null
  }

  server.registerTool(
    'mage_connect',
    {
      title: 'Connect to XMage via proxy',
      description:
        'Abre el WS contra el proxy y hace login en el servidor XMage. Por defecto local ' +
        '(ws://127.0.0.1:8787 → 127.0.0.1:17171) con una cuenta autogenerada y password "x"; ' +
        'para beta usa host=beta.xmage.today, port=17171 y tus credenciales. Reintenta si el ' +
        'proxy responde WARMING_UP (construcción inicial de la card DB). session nombra la sesión MCP ' +
        '(multi-sesión: conecta varias cuentas/partidas y cambia con mage_use_session).',
      inputSchema: {
        session: z.string().default(DEFAULT_SESSION),
        proxyUrl: z.string().default(DEFAULT_PROXY_URL),
        host: z.string().default(DEFAULT_HOST),
        port: z.number().int().min(1).max(65_535).default(DEFAULT_PORT),
        username: z.string().optional(),
        password: z.string().default('x'),
        timeoutSec: z.number().int().min(5).max(300).default(90),
      },
      annotations: { readOnlyHint: false },
    },
    async ({ session, proxyUrl, host, port, username, password, timeoutSec }) => {
      const state = activateSession(session)
      const account = username && username.length > 0 ? username : `mcp-${Date.now().toString(36).slice(-8)}`
      if (account.length > 14) throw new Error(`XMage limita el usuario a 14 caracteres: "${account}"`)
      await connectToProxy(state, { proxyUrl, host, port, username: account, password, timeoutSec })
      return textResult(`conectado a ${host}:${port} como ${account} (sesión ${session})\n\n${json(sessionSnapshot(state))}`)
    },
  )

  server.registerTool(
    'mage_disconnect',
    {
      title: 'Disconnect from XMage',
      description: 'Cierra la sesión WS con el proxy (los asientos SIM se detienen en el proxy).',
      inputSchema: {},
      annotations: { readOnlyHint: false },
    },
    async () => {
      const state = activeState
      const client = state.client
      state.client = null
      state.loggedIn = false
      client?.close()
      return textResult('sesión cerrada')
    },
  )

  server.registerTool(
    'mage_reconnect',
    {
      title: 'Reconnect and resync the session',
      description:
        'Reabre el WS contra el proxy con las credenciales guardadas, re-loguea (attach si la sesión ' +
        'XMage sigue viva; el proxy la mantiene 60s de gracia) y resincroniza la partida en curso con ' +
        'joinGame. El auto-reconnect ya lo hace solo; usa esta tool para forzarlo o si el auto falló.',
      inputSchema: {},
      annotations: { readOnlyHint: false },
    },
    async () => {
      const state = activeState
      if (!state.host || !state.username) throw new Error('sin conexión previa — usa mage_connect')
      let client = state.client
      if (!client?.isOpen) {
        client = new ProxyClient(state.proxyUrl)
        attach(state, client)
        await client.open(10_000)
      }
      client.setAutoReconnect(true)
      const result = await resyncAfterReconnect(state, client)
      if (!result.ok) throw new Error(`reconexión fallida: ${result.error}`)
      return textResult(`reconectado\n\n${json(sessionSnapshot(state))}`)
    },
  )

  server.registerTool(
    'mage_lobby',
    {
      title: 'Lobby tables and users',
      description: 'Lista las mesas de la sala principal (id, nombre, tipo, asientos, estado) y el resumen de usuarios.',
      inputSchema: {
        limit: z.number().int().min(1).max(100).default(20),
      },
      annotations: { readOnlyHint: true },
    },
    async ({ limit }) => {
      const state = activeState
      const client = requireClient(state)
      const tables = (await client.requestOk('getTables', {}, 15_000)) as TableLike[]
      const users = (await client.requestOk('getRoomUsers', {}, 15_000)) as {
        numberActiveGames?: number
        numberGameThreads?: number
        numberMaxGames?: number
        usersView?: unknown[]
      }
      const summary = (Array.isArray(tables) ? tables : []).slice(0, limit).map((table) => ({
        tableId: table.tableId,
        name: table.tableName,
        gameType: table.gameType,
        deckType: table.deckType,
        state: table.tableStateText ?? table.tableState,
        seats: table.seatsInfo,
        players: (table.seats ?? []).map((seat) => ({
          name: seat.playerName,
          type: seat.playerType ?? null,
          seat: seat.seatIndex,
        })),
        tournament: table.isTournament === true,
        passworded: table.passworded === true,
      }))
      return textResult(
        json({
          tables: summary,
          totalTables: Array.isArray(tables) ? tables.length : 0,
          users: {
            online: users.usersView?.length ?? 0,
            activeGames: users.numberActiveGames ?? 0,
            gameThreads: users.numberGameThreads ?? 0,
            maxGames: users.numberMaxGames ?? 0,
          },
          session: { username: state.username, tableId: state.tableId, gameId: state.gameId },
        }),
      )
    },
  )

  server.registerTool(
    'mage_create_table',
    {
      title: 'Create a table',
      description:
        'Crea una mesa. Defaults: Two Player Duel, Constructed - Pioneer, 1 victoria, asientos ' +
        '["HUMAN","SIM"] (oponente simulado del proxy). simDecks alimenta los asientos SIM ' +
        '(si falta usa tierras por defecto); skipInitShuffling/skipStartingPlayerChoice ' +
        'deterministas para tests. Devuelve tableId.',
      inputSchema: {
        name: z.string().optional(),
        gameType: z.string().default('Two Player Duel'),
        deckType: z.string().default('Constructed - Pioneer'),
        winsNeeded: z.number().int().min(1).max(5).default(1),
        playerTypes: z.array(z.string()).default(['HUMAN', 'SIM']),
        simDecks: z.array(deckSchema).optional(),
        seatSkills: z.array(z.number().int().min(0).max(10)).optional(),
        password: z.string().optional(),
        skipInitShuffling: z.boolean().default(false),
        skipStartingPlayerChoice: z.boolean().default(false),
      },
      annotations: { readOnlyHint: false },
    },
    async (input) => {
      const state = activeState
      const client = requireClient(state)
      const args: Record<string, unknown> = {
        name: input.name ?? `mcp-${Date.now().toString(36)}`,
        gameType: input.gameType,
        deckType: input.deckType,
        winsNeeded: input.winsNeeded,
        playerTypes: input.playerTypes,
      }
      if (input.simDecks?.length) args.simDecks = input.simDecks
      if (input.seatSkills?.length) args.seatSkills = input.seatSkills
      if (input.password) args.password = input.password
      if (input.skipInitShuffling) args.skipInitShuffling = true
      if (input.skipStartingPlayerChoice) args.skipStartingPlayerChoice = true
      const data = (await client.requestOk('createTable', args, 30_000)) as {
        tableId?: string
        table?: { tableId?: string }
      }
      const tableId = data?.tableId ?? data?.table?.tableId ?? null
      state.tableId = tableId
      if (!tableId) throw new Error(`createTable no devolvió tableId: ${json(data)}`)
      return textResult(`mesa creada: ${tableId}\n\n${json({ tableId, args })}`)
    },
  )

  server.registerTool(
    'mage_join_table',
    {
      title: 'Join a table',
      description:
        'Se une a una mesa como jugador con un mazo (formato DeckJson del protocolo: ' +
        '{name, cards:[{cardName,setCode,cardNumber,amount}], sideboard?}).',
      inputSchema: {
        tableId: z.string(),
        deck: deckSchema,
        playerName: z.string().optional(),
        playerType: z.string().default('HUMAN'),
        skill: z.number().int().min(0).max(10).default(1),
        password: z.string().optional(),
      },
      annotations: { readOnlyHint: false },
    },
    async (input) => {
      const state = activeState
      const client = requireClient(state)
      const args: Record<string, unknown> = {
        tableId: input.tableId,
        playerName: input.playerName ?? state.username,
        playerType: input.playerType,
        skill: input.skill,
        deck: input.deck,
      }
      if (input.password) args.password = input.password
      await client.requestOk('joinTable', args, 30_000)
      state.tableId = input.tableId
      return textResult(`unido a ${input.tableId} como ${String(args.playerName)} (${input.playerType})`)
    },
  )

  server.registerTool(
    'mage_start_match',
    {
      title: 'Start a match',
      description:
        'Arranca la partida de la mesa y espera el START_GAME/GAME_INIT para devolver el gameId. ' +
        'Requiere la mesa completa (humano + SIM ya unidos; el proxy une los SIM al crear la mesa).',
      inputSchema: {
        tableId: z.string().optional(),
        waitMs: z.number().int().min(0).max(120_000).default(30_000),
      },
      annotations: { readOnlyHint: false },
    },
    async ({ tableId, waitMs }) => {
      const state = activeState
      const client = requireClient(state)
      const id = tableId ?? state.tableId
      if (!id) throw new Error('sin tableId — pasa uno o crea/únete a una mesa primero')
      await client.requestOk('startMatch', { tableId: id }, 30_000)
      state.tableId = id
      state.gameId = null
      const gameId = await waitFor(() => state.gameId, waitMs, 'START_GAME')
      return textResult(`partida arrancada\n\n${json({ tableId: id, gameId, session: sessionSnapshot(state) })}`)
    },
  )

  server.registerTool(
    'mage_leave_table',
    {
      title: 'Leave / remove a table',
      description: 'Sale de la mesa (leaveTable) o la elimina (removeTable, solo dueño).',
      inputSchema: {
        tableId: z.string().optional(),
        remove: z.boolean().default(false),
      },
      annotations: { readOnlyHint: false },
    },
    async ({ tableId, remove }) => {
      const state = activeState
      const client = requireClient(state)
      const id = tableId ?? state.tableId
      if (!id) throw new Error('sin tableId')
      await client.requestOk(remove ? 'removeTable' : 'leaveTable', { tableId: id }, 20_000)
      if (state.tableId === id) state.tableId = null
      return textResult(`${remove ? 'mesa eliminada' : 'salida de mesa'}: ${id}`)
    },
  )

  server.registerTool(
    'mage_game_state',
    {
      title: 'Compact game state',
      description:
        'Estado de la partida actual: turno/fase/prioridad, vidas y contadores por jugador, mano, ' +
        'battlefield (mías/rivales con girada, P/T, daño y contadores), stack, ids jugables y combate, ' +
        'más el prompt pendiente si lo hay. level=full incluye el GameView crudo (grande) truncado.',
      inputSchema: {
        level: z.enum(['compact', 'full']).default('compact'),
      },
      annotations: { readOnlyHint: true },
    },
    async ({ level }) => {
      const state = activeState
      const view = state.lastGameView as GameView | null
      if (!view) {
        return textResult(json({ session: sessionSnapshot(state), state: null, prompt: currentPromptView(state) }))
      }
      const compact = compactGameView(view)
      if (level === 'full') {
        return textResult(truncate(json({ state: compact, prompt: currentPromptView(state), raw: view }), 40_000))
      }
      return textResult(
        json({
          state: compact,
          prompt: currentPromptView(state),
          promptSeq: state.promptSeq,
          autoPass: state.autoPass,
          gameOver: state.gameOver ? { at: state.gameOver.at, data: state.gameOver.data } : null,
        }),
      )
    },
  )

  server.registerTool(
    'mage_wait_for_prompt',
    {
      title: 'Wait for a game prompt',
      description:
        'Bloquea hasta que el servidor pida una decisión (prompt normalizado con opciones) o hasta ' +
        'que la partida termine. afterSeq permite esperar SOLO un prompt posterior a la última acción ' +
        '(usa el promptSeq devuelto por las acciones). Si expira devuelve timeout=true con el estado.',
      inputSchema: {
        timeoutMs: z.number().int().min(1_000).max(120_000).default(30_000),
        afterSeq: z.number().int().min(0).default(0),
      },
      annotations: { readOnlyHint: true },
    },
    async ({ timeoutMs, afterSeq }) => {
      const state = activeState
      const started = Date.now()
      while (Date.now() - started < timeoutMs) {
        if (state.gameOver) {
          return textResult(
            json({
              gameOver: true,
              at: state.gameOver.at,
              data: state.gameOver.data,
              promptSeq: state.promptSeq,
              state: compactState(state),
            }),
          )
        }
        const entry = state.pendingPrompt
        if (entry && entry.seq > afterSeq) {
          return textResult(
            json({ prompt: entry.view, promptSeq: entry.seq, state: compactState(state) }),
          )
        }
        await sleep(150)
      }
      return textResult(
        json({
          timeout: true,
          promptSeq: state.promptSeq,
          prompt: currentPromptView(state),
          state: compactState(state),
        }),
      )
    },
  )

  server.registerTool(
    'mage_action',
    {
      title: 'Send a raw game action',
      description:
        'Responde al servidor. kind=uuid|boolean|integer|string|manaType mapea a sendPlayerUUID/' +
        'sendPlayerBoolean/sendPlayerInteger/sendPlayerString/sendPlayerManaType; kind=playerAction ' +
        'usa {action, data}. Valida el kind contra el prompt pendiente (usa force=true para saltarte ' +
        'la validación). Devuelve promptSeq para encadenar mage_wait_for_prompt(afterSeq).',
      inputSchema: {
        kind: z.enum(['uuid', 'boolean', 'integer', 'string', 'manaType', 'playerAction']),
        value: z.union([z.string(), z.number(), z.boolean()]).optional(),
        action: z.string().optional(),
        data: z.unknown().optional(),
        playerId: z.string().optional(),
        force: z.boolean().default(false),
      },
      annotations: { readOnlyHint: false },
    },
    async ({ kind, value, action, data, playerId, force }) => {
      const state = activeState
      const pending = state.pendingPrompt
      if (kind !== 'playerAction' && !force) {
        const mismatch = modeMismatch(kind, pending?.view ?? null)
        if (mismatch) {
          throw new Error(`${mismatch}. Llama a mage_wait_for_prompt/mage_game_state, o pasa force=true`)
        }
      }
      switch (kind) {
        case 'uuid': {
          if (typeof value !== 'string') throw new Error('kind=uuid requiere value:string (id de carta/fuente/objetivo)')
          await answer(state, 'sendPlayerUUID', { value }, pending)
          break
        }
        case 'boolean': {
          await answer(state, 'sendPlayerBoolean', { value: value === true || value === 'true' }, pending)
          break
        }
        case 'integer': {
          if (typeof value !== 'number') throw new Error('kind=integer requiere value:number')
          await answer(state, 'sendPlayerInteger', { value }, pending)
          break
        }
        case 'string': {
          if (typeof value !== 'string') throw new Error('kind=string requiere value:string')
          await answer(state, 'sendPlayerString', { value }, pending)
          break
        }
        case 'manaType': {
          if (typeof value !== 'string') throw new Error('kind=manaType requiere value:string (W/U/B/R/G/C)')
          const targetPlayer = playerId ?? pending?.view.playerId ?? controlledPlayerId(state)
          if (!targetPlayer) throw new Error('sin playerId de maná')
          await answer(state, 'sendPlayerManaType', { playerId: targetPlayer, manaType: value }, pending)
          break
        }
        case 'playerAction': {
          if (!action) throw new Error('kind=playerAction requiere action')
          await answer(state, 'sendPlayerAction', { action, data: data ?? null }, null)
          break
        }
      }
      return textResult(json({ ok: true, kind, promptSeq: state.promptSeq, pending: promptSummary(state) }))
    },
  )

  server.registerTool(
    'mage_choose',
    {
      title: 'Answer the pending prompt',
      description:
        'Responde al prompt pendiente por optionId (id o value de las opciones), value (integer/string/' +
        'boolean), values (order: índices en el orden deseado → se envían los ids de las cartas; ' +
        'multiString: cantidades) o sin argumentos para pasar (modo select/combat). ' +
        'optionId="special" pulsa el botón especial del prompt (auto-pago de maná, "all attack").',
      inputSchema: {
        optionId: z.string().optional(),
        value: z.union([z.string(), z.number(), z.boolean()]).optional(),
        values: z.array(z.number()).optional(),
      },
      annotations: { readOnlyHint: false },
    },
    async ({ optionId, value, values }) => {
      const state = activeState
      const entry = state.pendingPrompt
      if (!entry) {
        throw new Error(`no hay prompt pendiente (promptSeq ${state.promptSeq}) — usa mage_wait_for_prompt`)
      }
      const view = entry.view
      if (optionId === 'special') {
        await answer(state, 'sendPlayerString', { value: 'special' }, entry)
        return textResult(json({ ok: true, answered: view.method, special: true, promptSeq: state.promptSeq, pending: promptSummary(state) }))
      }
      if (values?.length) {
        if (view.mode === 'order') {
          const ids = values.map((index) => {
            const option = view.options[index]
            if (!option) {
              throw new Error(`values[${index}] no es un índice válido (0..${Math.max(0, view.options.length - 1)})`)
            }
            return option.value
          })
          await answer(state, 'sendPlayerString', { value: ids.join(' ') }, entry)
        } else {
          await answer(state, 'sendPlayerString', { value: values.join(' ') }, entry)
        }
      } else if (optionId) {
        const option = view.options.find((item) => item.id === optionId) ?? view.options.find((item) => item.value === optionId)
        if (!option) {
          throw new Error(`opción "${optionId}" no existe; ids: ${view.options.map((item) => item.id).join(', ')}`)
        }
        if (view.mode === 'boolean') await answer(state, 'sendPlayerBoolean', { value: option.value === 'true' }, entry)
        else if (view.mode === 'select' || view.mode === 'combat' || view.mode === 'mana' || view.mode === 'uuid') {
          await answer(state, 'sendPlayerUUID', { value: option.value }, entry)
        } else await answer(state, 'sendPlayerString', { value: option.value }, entry)
      } else if (value !== undefined) {
        if (view.mode === 'integer') await answer(state, 'sendPlayerInteger', { value: Number(value) }, entry)
        else if (view.mode === 'boolean') await answer(state, 'sendPlayerBoolean', { value: value === true || value === 'true' }, entry)
        else await answer(state, 'sendPlayerString', { value: String(value) }, entry)
      } else if (view.mode === 'select' || view.mode === 'combat' || view.mode === 'mana') {
        await answer(state, 'sendPlayerBoolean', { value: false }, entry)
      } else {
        throw new Error(`el prompt modo "${view.mode}" requiere optionId o value`)
      }
      return textResult(json({ ok: true, answered: view.method, promptSeq: state.promptSeq, pending: promptSummary(state) }))
    },
  )

  server.registerTool(
    'mage_play_card',
    {
      title: 'Play a card or ability',
      description: 'Envía sendPlayerUUID con el id de una carta/fuente jugable (mano, battlefield o habilidad).',
      inputSchema: {
        cardId: z.string(),
      },
      annotations: { readOnlyHint: false },
    },
    async ({ cardId }) => {
      const state = activeState
      await answer(state, 'sendPlayerUUID', { value: cardId }, state.pendingPrompt)
      return textResult(json({ ok: true, cardId, promptSeq: state.promptSeq, pending: promptSummary(state) }))
    },
  )

  server.registerTool(
    'mage_pay_mana',
    {
      title: 'Pay mana',
      description:
        'Paga maná: sourceId (sendPlayerUUID de una fuente) o manaType (sendPlayerManaType W/U/B/R/G/C ' +
        'del pool). special=true envía sendPlayerString("special") para pulsar el botón especial de ' +
        'maná (auto-pago). Para cancelar un pago usa mage_choose sin argumentos o mage_action ' +
        'kind=boolean value=false.',
      inputSchema: {
        sourceId: z.string().optional(),
        manaType: z.string().optional(),
        special: z.boolean().default(false),
      },
      annotations: { readOnlyHint: false },
    },
    async ({ sourceId, manaType, special }) => {
      const state = activeState
      if (special) {
        await answer(state, 'sendPlayerString', { value: 'special' }, state.pendingPrompt)
      } else if (sourceId) {
        await answer(state, 'sendPlayerUUID', { value: sourceId }, state.pendingPrompt)
      } else if (manaType) {
        const targetPlayer = state.pendingPrompt?.view.playerId ?? controlledPlayerId(state)
        if (!targetPlayer) throw new Error('sin playerId de maná')
        await answer(state, 'sendPlayerManaType', { playerId: targetPlayer, manaType: manaType.toUpperCase() }, state.pendingPrompt)
      } else {
        throw new Error('pasa sourceId, manaType o special=true')
      }
      return textResult(json({ ok: true, sourceId, manaType, special, promptSeq: state.promptSeq, pending: promptSummary(state) }))
    },
  )

  server.registerTool(
    'mage_pass_priority',
    {
      title: 'Pass priority / confirm',
      description: 'Envía sendPlayerBoolean(false): pasar prioridad, confirmar atacantes/bloqueadores o rechazar (no).',
      inputSchema: {},
      annotations: { readOnlyHint: false },
    },
    async () => {
      const state = activeState
      await answer(state, 'sendPlayerBoolean', { value: false }, state.pendingPrompt)
      return textResult(json({ ok: true, promptSeq: state.promptSeq, pending: promptSummary(state) }))
    },
  )

  server.registerTool(
    'mage_combat',
    {
      title: 'Declare attackers/blockers',
      description:
        'Declara combate: envía sendPlayerUUID por cada id de attackers/blockers y confirma con ' +
        'sendPlayerBoolean(false) si confirm=true. Ids válidos en el prompt de combate (mode=combat).',
      inputSchema: {
        attackers: z.array(z.string()).optional(),
        blockers: z.array(z.string()).optional(),
        confirm: z.boolean().default(true),
      },
      annotations: { readOnlyHint: false },
    },
    async ({ attackers, blockers, confirm }) => {
      const state = activeState
      const sent = [...(attackers ?? []), ...(blockers ?? [])]
      for (const id of sent) await answer(state, 'sendPlayerUUID', { value: id }, null)
      if (confirm) await answer(state, 'sendPlayerBoolean', { value: false }, state.pendingPrompt)
      return textResult(json({ ok: true, sent, confirmed: confirm, promptSeq: state.promptSeq, pending: promptSummary(state) }))
    },
  )

  server.registerTool(
    'mage_auto_pass',
    {
      title: 'Toggle auto-pass',
      description:
        'Activa/desactiva el auto-pass: con enabled=true el MCP pasa prioridad automáticamente en ' +
        'ventanas GAME_SELECT de prioridad del rival o sin objetos jugables (nunca en asks/targets/maná ' +
        'ni durante un pago). Anti-flood: si el servidor repite el mismo prompt más de ' +
        `${AUTO_PASS_MAX_REPEATS} veces seguidas, desactiva el auto-pass y lo registra ` +
        '(AUTO_PASS_STOPPED). Por defecto está activado.',
      inputSchema: {
        enabled: z.boolean(),
      },
      annotations: { readOnlyHint: false },
    },
    async ({ enabled }) => {
      const state = activeState
      state.autoPass = enabled
      if (enabled) {
        state.autoPassSignature = null
        state.autoPassRepeats = 0
      }
      if (enabled && state.pendingPrompt) void maybeAutoPass(state, state.pendingPrompt)
      return textResult(json({ autoPass: state.autoPass, repeats: state.autoPassRepeats }))
    },
  )

  server.registerTool(
    'mage_concede',
    {
      title: 'Concede the game',
      description: 'Envía sendPlayerAction CONCEDE (solo la partida actual; no abandona el match).',
      inputSchema: {},
      annotations: { readOnlyHint: false },
    },
    async () => {
      const state = activeState
      await answer(state, 'sendPlayerAction', { action: 'CONCEDE', data: null }, state.pendingPrompt)
      return textResult(json({ ok: true, promptSeq: state.promptSeq }))
    },
  )

  server.registerTool(
    'mage_chat',
    {
      title: 'Send game chat',
      description: 'Envía un mensaje al chat de la partida actual (o al chatId indicado).',
      inputSchema: {
        text: z.string(),
        chatId: z.string().optional(),
      },
      annotations: { readOnlyHint: false },
    },
    async ({ text, chatId }) => {
      const state = activeState
      const client = requireClient(state)
      let target = chatId
      if (!target) {
        const gameId = state.gameId
        if (!gameId) throw new Error('sin partida activa — pasa chatId o arranca una partida')
        target = (await client.requestOk('getGameChatId', { gameId }, 10_000)) as string
      }
      if (!target) throw new Error('no hay chatId')
      await client.requestOk('sendChatMessage', { chatId: target, text }, 10_000)
      return textResult(json({ ok: true, chatId: target }))
    },
  )

  server.registerTool(
    'mage_session',
    {
      title: 'Current MCP XMage session',
      description:
        'Estado de la sesión MCP ACTIVA (id, conexión, mesa, gameId, turno/fase/prioridad) y cola de eventos ' +
        'recientes. Usa mage_sessions para listar todas y mage_use_session para cambiar la activa.',
      inputSchema: {},
      annotations: { readOnlyHint: true },
    },
    async () => textResult(json({ sessionId: sessionIdOf(activeState), ...sessionSnapshot(activeState) })),
  )

  server.registerTool(
    'mage_sessions',
    {
      title: 'List MCP XMage sessions',
      description: 'Lista todas las sesiones nombradas del proceso MCP (id, activa, conexión, username, mesa, gameId).',
      inputSchema: {},
      annotations: { readOnlyHint: true },
    },
    async () => {
      const list = [...sessions.entries()]
        .filter(([, session]) => session.loggedIn || session.client || session.username || session.gameId || session.events.length > 0)
        .map(([id, session]) => ({
          sessionId: id,
          active: session === activeState,
          ...sessionSnapshot(session),
        }))
      return textResult(json(list))
    },
  )

  server.registerTool(
    'mage_use_session',
    {
      title: 'Switch the active MCP session',
      description:
        'Cambia la sesión activa: todas las tools de juego (excepto mage_connect/sessions) operan sobre ella. ' +
        'Las sesiones no usadas siguen recibiendo eventos (auto-pass incluido) en segundo plano.',
      inputSchema: {
        session: z.string(),
      },
      annotations: { readOnlyHint: false },
    },
    async ({ session }) => {
      const state = activateSession(session)
      return textResult(json({ sessionId: session, ...sessionSnapshot(state) }))
    },
  )
}

interface TableLike {
  tableId?: string
  tableName?: string
  gameType?: string
  deckType?: string
  tableState?: string
  tableStateText?: string
  seatsInfo?: string
  isTournament?: boolean
  passworded?: boolean
  seats?: { playerName?: string; playerType?: string; seatIndex?: number }[]
}

function sessionSnapshot(state: SessionState) {
  const view = state.lastGameView as
    | {
        turn?: number
        phase?: string
        step?: string
        players?: { controlled?: boolean; hasPriority?: boolean }[]
      }
    | null
  const me = view?.players?.find((player) => player.controlled)
  return {
    connected: state.client?.isOpen ?? false,
    loggedIn: state.loggedIn,
    reconnecting: state.client ? state.client.autoReconnect && !state.client.isOpen : false,
    lastConnectAttached: state.lastConnectAttached,
    proxyUrl: state.proxyUrl,
    host: state.host,
    port: state.port,
    username: state.username,
    tableId: state.tableId,
    gameId: state.gameId,
    autoPass: state.autoPass,
    autoPassRepeats: state.autoPassRepeats,
    promptSeq: state.promptSeq,
    pendingPrompt: state.pendingPrompt
      ? { seq: state.pendingPrompt.seq, method: state.pendingPrompt.method, mode: state.pendingPrompt.view.mode }
      : null,
    gameOver: state.gameOver ? { at: state.gameOver.at } : null,
    game: view
      ? { turn: view.turn ?? null, phase: view.phase ?? null, step: view.step ?? null, priority: me?.hasPriority === true }
      : null,
    events: state.events.slice(-20),
  }
}
