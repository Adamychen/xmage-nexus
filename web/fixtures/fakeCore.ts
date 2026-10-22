/**
 * FixtureServer: implementación determinista del contrato WS del proxy
 * (Mage.Proxy) para los E2E de navegador. Cada test lo arranca en un puerto
 * libre (`FakeServer.start(0)`; el test publica el asignado vía setFakePort) y
 * responde a las acciones de commands.ts con envelopes
 * {type:'result'} y emite callbacks {type:'event'} según un escenario
 * declarativo. Nada de Java, nada de timing real: los tests de UI corren en
 * segundos y son reproducibles al 100%.
 * Tipado contra src/net/types.ts (el typecheck valida la coherencia fake↔cliente).
 */

import type { GameView, RoomUsersView, SeatView, TableView, UsersView } from '../src/net/types'

let nextConnId = 1

export interface FakeServerOptions {
  /**
   * Retardo artificial del "servidor" (ms) para los tests de latencia percibida
   * (plan4 §5.4): se difieren los eventos de partida y las respuestas a las
   * acciones de decisión (`sendPlayer*`, `sendCardPick`), de modo que el acuse
   * local (busy/pending) quede visible durante el eco. 0 = inmediato (default).
   */
  echoDelayMs?: number
}

/** Reglas de `Mage.Server` (`Session.validateUserNameLength` + `config.xml`
 *  `minUserNameLength`/`maxUserNameLength`). Sin esto fake mode acepta nombres
 *  que el servidor real rechaza y el drift pasa desapercibido. */
export const SERVER_MIN_USER_NAME_LENGTH = 3
export const SERVER_MAX_USER_NAME_LENGTH = 14

export function validateServerUserName(userName: string): string | null {
  if (userName.length < SERVER_MIN_USER_NAME_LENGTH) {
    return `User name may not be shorter than ${SERVER_MIN_USER_NAME_LENGTH} characters`
  }
  if (userName.length > SERVER_MAX_USER_NAME_LENGTH) {
    return `User name may not be longer than ${SERVER_MAX_USER_NAME_LENGTH} characters`
  }
  return null
}

export interface FakeConn {
  readonly id: number
  /** Usuario de la conexión (login); el proxy real ecoa el chat con este nombre. */
  username?: string
  /** Callback del servidor (type:'event'); messageId autoincremental. */
  event(method: string, data: unknown, objectId?: string | null): void
  /** Emite el evento a TODAS las conexiones del servidor (la página y el
   *  helper WS del humano ven la misma partida). */
  broadcast(method: string, data: unknown, objectId?: string | null): void
  /** Respuesta a una acción (type:'result'). */
  ok(requestId: string | number, action: string, data?: unknown): void
  fail(requestId: string | number, action: string, error: string, errorCode?: string): void
  /** Broadcast del lobby (type:'lobby'). */
  lobby(tables: TableView[], users?: UsersView[]): void
  raw(obj: unknown): void
  isOpen(): boolean
  close(): void
}

export interface Scenario {
  /** Informes `report_issue` recibidos durante el escenario. */
  receivedReports?: { kind: string; args: Record<string, unknown> }[]
  /** Handler por acción recibida del cliente. Si no llama a ok/fail, el core
   *  responde ok con el default (ver DEFAULT_RESULTS). */
  onAction?(
    conn: FakeConn,
    action: string,
    args: Record<string, unknown>,
    requestId: string | number,
  ): void
  /** Al abrir la conexión (el proxy real manda 'connected' + 'info'). */
  onConnect?(conn: FakeConn): void
  /** Timers del escenario (broadcasts de lobby, updates de partida...). */
  onStart?(conn: FakeConn): (() => void) | void
}

export const DEFAULT_RESULTS: Record<string, unknown> = {
  getGameTypes: [
    { name: 'Two Player Duel', minPlayers: 2, maxPlayers: 2 },
    { name: 'Free For All', minPlayers: 3, maxPlayers: 10 },
    { name: 'Commander Free For All', minPlayers: 3, maxPlayers: 10 },
  ],
  getPlayerTypes: ['HUMAN', 'SIM', 'COMPUTER_MAD', 'COMPUTER_DRAFT_BOT'],
  getDeckTypes: ['Constructed - Modern', 'Limited'],
  getTournamentTypes: [
    'Constructed Elimination',
    'Constructed Swiss',
    'Booster Draft Elimination',
    'Booster Draft Swiss',
    'Sealed Elimination',
    'Sealed Swiss',
  ],
}

/**
 * Construye el literal de `TableView` que reutilizan todos los escenarios
 * (antes se copiaba ~25 campos en cada archivo de `fixtures/scenarios/*`).
 */
export interface MakeTableOptions {
  tableId: string
  tableName: string
  gameId: string
  gameType?: string
  deckType?: string
  controllerName?: string
  seats?: SeatView[]
  isTournament?: boolean
}

export function makeTable(opts: MakeTableOptions): TableView {
  const seats = opts.seats ?? [
    { playerName: 'e2e', seatIndex: 0, playerType: 'HUMAN' },
    { playerName: 'sim', seatIndex: 1, playerType: 'SIM' },
  ]
  return {
    tableId: opts.tableId,
    gameType: opts.gameType ?? 'Two Player Duel',
    deckType: opts.deckType ?? 'Constructed - Modern',
    tableName: opts.tableName,
    controllerName: opts.controllerName ?? 'e2e',
    additionalInfoShort: '2/2',
    additionalInfoFull: '',
    createTime: Date.now(),
    tableState: 'READY_TO_START',
    skillLevel: 'Casual',
    tableStateText: 'Lista',
    seatsInfo: '2/2',
    isTournament: opts.isTournament ?? false,
    seats,
    games: [opts.gameId],
    quitRatio: '100',
    minimumRating: '0',
    limited: false,
    rated: false,
    passworded: false,
    spectatorsAllowed: false,
  }
}

export interface BaseScenarioActionContext {
  args: Record<string, unknown>
  /** Última conexión activa; útil para broadcasts diferidos (setTimeout). */
  activeConn: FakeConn | null
}

/**
 * Escenario base que implementa el ciclo canónico del proxy:
 * `connected`/`info` + lobby en `onConnect`, y el switch
 * `connect`/`createTable`/`joinGame`/`watch*`/`startMatch`/`sendPlayer*`
 * en `onAction`. Los escenarios con lógica propia pasan callbacks
 * (`onSendPlayerUUID`, `onStartMatch`, `onExtra`, …) y el resto del
 * boilerplate desaparece de cada archivo.
 */
export interface BaseScenarioOptions {
  tableId: string
  tableName: string
  gameId: string
  gameView?: GameView
  seats?: SeatView[]
  gameType?: string
  isTournament?: boolean
  getGameView?: () => GameView
  selectMessage?: string
  onConnect?: (conn: FakeConn) => void
  onStartMatch?: (conn: FakeConn) => void
  onSendPlayerUUID?: (conn: FakeConn, uuid: string, ctx: BaseScenarioActionContext) => void
  onSendPlayerAction?: (conn: FakeConn, value: string, ctx: BaseScenarioActionContext) => void
  onSendPlayerBoolean?: (conn: FakeConn, ctx: BaseScenarioActionContext) => void
  onSendPlayerInteger?: (conn: FakeConn, value: number, ctx: BaseScenarioActionContext) => void
  onSendPlayerString?: (conn: FakeConn, value: string, ctx: BaseScenarioActionContext) => void
  onJoinGame?: (conn: FakeConn, gameId: string, ctx: BaseScenarioActionContext) => void
  /** Intercepta cualquier acción antes del switch del escenario. Devolver true
   *  significa "ya respondida" (p. ej. `conn.fail(...)` para probar errores). */
  onRequest?: (conn: FakeConn, action: string, args: Record<string, unknown>, requestId: string | number) => boolean
  onExtra?: (conn: FakeConn, action: string, args: Record<string, unknown>, requestId: string | number) => boolean
  /** Informe que devuelve la acción `validateDeck` (pre-validación de mazos).
   *  Si no se define, la respuesta es un mazo válido sin problemas. */
  onValidateDeck?: (deck?: { name?: string; cards?: unknown[]; sideboard?: unknown[] }) => import('../src/net/types').DeckValidationResult
}

const argString = (args: Record<string, unknown>, ...keys: string[]): string => {
  for (const k of keys) {
    const v = args[k]
    if (v !== undefined && v !== null) return String(v)
  }
  if (args[0] !== undefined && args[0] !== null) return String(args[0])
  return ''
}

export function makeBaseScenario(opts: BaseScenarioOptions): Scenario {
  const table = makeTable({ tableId: opts.tableId, tableName: opts.tableName, gameId: opts.gameId, seats: opts.seats, gameType: opts.gameType, isTournament: opts.isTournament })
  const getGv = opts.getGameView ?? (() => opts.gameView as GameView)
  const selectMessage = opts.selectMessage ?? 'Main 1: Cast spells or activate abilities'
  let activeConn: FakeConn | null = null
  /** Informes recibidos, para que un test pueda afirmar sobre lo que el cliente mandó. */
  const receivedReports: { kind: string; args: Record<string, unknown> }[] = []

  return {
    receivedReports,
    onConnect: (conn) => {
      activeConn = conn
      conn.raw({ type: 'connected', message: 'Proxy ready.' })
      conn.raw({ type: 'info', message: 'Proxy ready.' })
      conn.lobby([table])
      opts.onConnect?.(conn)
    },
    onAction: (conn, action, args, requestId) => {
      activeConn = conn
      if (opts.onRequest?.(conn, action, args, requestId)) return
      const gv = () => getGv()
      const ctx = (): BaseScenarioActionContext => ({ args, activeConn })
      switch (action) {
        case 'connect': {
          const username = String((args as Record<string, unknown>).username ?? '').trim()
          if (username) conn.username = username
          conn.ok(requestId, action, { tableId: table.tableId })
          conn.lobby([table])
          return
        }
        case 'createTable':
        case 'createTournamentTable':
          conn.ok(requestId, action, { tableId: table.tableId })
          conn.lobby([table])
          return
        case 'joinGame':
        case 'watchTable':
        case 'watchGame':
          conn.ok(requestId, action, { tableId: table.tableId })
          conn.lobby([table])
          if (action === 'joinGame' && opts.onJoinGame) {
            opts.onJoinGame(conn, argString(args, 'gameId'), ctx())
          }
          return
        case 'joinTable': {
          conn.ok(requestId, action, {})
          const isHuman = (args as Record<string, unknown>)?.playerType === 'HUMAN' || !(args as Record<string, unknown>)?.playerType
          if (isHuman) {
            conn.event('JOINED_TABLE', { roomId: 'room-fake', currentTableId: table.tableId, parentTableId: null, flag: false })
          }
          return
        }
        case 'joinTournamentTable': {
          conn.ok(requestId, action, {})
          const isHuman = (args as Record<string, unknown>)?.playerType === 'HUMAN' || !(args as Record<string, unknown>)?.playerType
          if (isHuman) {
            conn.event('JOINED_TABLE', { roomId: 'room-fake', currentTableId: table.tableId, parentTableId: null, flag: true })
          }
          return
        }
        case 'joinTournament':
        case 'joinDraft': {
          conn.ok(requestId, action, {})
          return
        }
        case 'swapSeats': {
          const a = Number((args as Record<string, unknown>).seatNum1)
          const b = Number((args as Record<string, unknown>).seatNum2)
          const seats = table.seats ?? []
          const okSwap = Number.isInteger(a) && Number.isInteger(b) && a >= 0 && b >= 0 && a < seats.length && b < seats.length
          if (okSwap) {
            const tmp = seats[a]
            seats[a] = seats[b]
            seats[b] = tmp
            conn.ok(requestId, action, {})
            conn.lobby([table])
          } else {
            conn.fail(requestId, action, 'bad seat indices')
          }
          return
        }
        case 'startMatch':
        case 'startTournament': {
          conn.ok(requestId, action, {})
          conn.broadcast('START_GAME', { gameId: opts.gameId, tableName: table.tableName }, opts.gameId)
          conn.broadcast('GAME_INIT', { gameView: gv() }, opts.gameId)
          if (opts.onStartMatch) {
            // El escenario controla por completo el primer prompt (GAME_ASK,
            // GAME_SELECT_PLAYER, GAME_SELECT de atacantes, …). No emitimos el
            // GAME_SELECT por defecto para no duplicar prompts.
            opts.onStartMatch(conn)
          } else {
            conn.broadcast(
              'GAME_SELECT',
              { message: selectMessage, options: { specialButton: 'Pass' }, gameView: gv() },
              opts.gameId,
            )
          }
          return
        }
        case 'sendPlayerUUID': {
          conn.ok(requestId, action, {})
          if (opts.onSendPlayerUUID) opts.onSendPlayerUUID(conn, argString(args, 'value', 'uuid'), ctx())
          else conn.broadcast('GAME_UPDATE', { gameView: gv() }, opts.gameId)
          return
        }
        case 'sendPlayerAction': {
          conn.ok(requestId, action, {})
          if (opts.onSendPlayerAction) opts.onSendPlayerAction(conn, argString(args, 'action'), ctx())
          else conn.broadcast('GAME_UPDATE', { gameView: gv() }, opts.gameId)
          return
        }
        case 'sendPlayerBoolean': {
          conn.ok(requestId, action, {})
          if (opts.onSendPlayerBoolean) opts.onSendPlayerBoolean(conn, ctx())
          else conn.broadcast('GAME_UPDATE', { gameView: gv() }, opts.gameId)
          return
        }
        case 'sendPlayerInteger': {
          conn.ok(requestId, action, {})
          const value = Number(argString(args, 'value'))
          if (opts.onSendPlayerInteger) opts.onSendPlayerInteger(conn, value, ctx())
          else conn.broadcast('GAME_UPDATE', { gameView: gv() }, opts.gameId)
          return
        }
        case 'sendPlayerString': {
          conn.ok(requestId, action, {})
          if (opts.onSendPlayerString) opts.onSendPlayerString(conn, argString(args, 'value'), ctx())
          else conn.broadcast('GAME_UPDATE', { gameView: gv() }, opts.gameId)
          return
        }
        case 'validateDeck': {
          const deck = args.deck as { name?: string; cards?: unknown[]; sideboard?: unknown[] } | undefined
          conn.ok(requestId, action, opts.onValidateDeck?.(deck) ?? { ready: true, missing: [], mismatches: [] })
          return
        }
        case 'getRoomChatId':
          conn.ok(requestId, action, 'room-fake')
          return
        case 'getTableChatId':
          conn.ok(requestId, action, `table-chat-${table.tableId}`)
          return
        case 'getGameChatId':
          conn.ok(requestId, action, `game-chat-${opts.gameId}`)
          return
        case 'getTournamentChatId': {
          const tid = String((args as Record<string, unknown>).tournamentId ?? 'tournament')
          conn.ok(requestId, action, `tournament-chat-${tid}`)
          return
        }
        case 'joinChat':
        case 'leaveChat':
          conn.ok(requestId, action, true)
          return
        case 'sendChatMessage': {
          const text = String((args as Record<string, unknown>).text ?? '')
          const scopeChatId = String((args as Record<string, unknown>).chatId ?? '')
          conn.ok(requestId, action, true)
          if (text && scopeChatId) {
            conn.broadcast('CHATMESSAGE', { chatId: scopeChatId, username: conn.username ?? 'mesa-rival', message: text, time: Date.now() }, scopeChatId)
          }
          return
        }
        case 'report_issue': {
          // El proxy falso no guarda nada: la respuesta es lo que prueba el diálogo de informes.
          receivedReports.push({ kind: String((args as Record<string, unknown>).kind ?? ''), args })
          conn.ok(requestId, action, { stored: true, id: `fake-report-${receivedReports.length}` })
          return
        }
        default:
          if (opts.onExtra?.(conn, action, args, requestId)) return
          conn.ok(requestId, action, {})
      }
    },
  }
}

/** Acciones de decisión cuyo `ok` se difiere con echoDelayMs (viaje de ida y
 *  vuelta realista): así el busy/pending dura lo que el eco, no lo que el ACK. */
const DELAYED_RESULT_ACTIONS = /^(sendPlayer|sendCardPick)/

export interface FakeSocket {
  isOpen(): boolean
  send(data: string): void
  close(): void
}

export interface FakeSocketHandle {
  message(raw: string): void
  close(): void
}

class FakeConnection implements FakeConn {
  username?: string
  private answering: { requestId: string | number; answered: boolean } | null = null
  constructor(
    readonly id: number,
    private readonly ws: FakeSocket,
    private readonly server: FakeServerCore,
    private readonly echoDelayMs = 0,
  ) {}

  isOpen(): boolean {
    return this.ws.isOpen()
  }

  raw(obj: unknown): void {
    if (this.isOpen()) this.ws.send(JSON.stringify(obj))
  }

  private delayed(send: () => void): void {
    if (this.echoDelayMs > 0) setTimeout(send, this.echoDelayMs)
    else send()
  }

  event(method: string, data: unknown, objectId: string | null = null): void {
    const obj = { type: 'event', method, messageId: this.server.nextMessageId(), objectId, data }
    this.delayed(() => this.raw(obj))
  }

  broadcast(method: string, data: unknown, objectId: string | null = null): void {
    const obj = { type: 'event', method, messageId: this.server.nextMessageId(), objectId, data }
    this.delayed(() => {
      this.raw(obj)
      this.server.broadcast(obj, this.id)
    })
  }

  beginRequest(requestId: string | number): void {
    this.answering = { requestId, answered: false }
  }

  endRequest(): boolean {
    const answered = this.answering?.answered ?? false
    this.answering = null
    return answered
  }

  ok(requestId: string | number, action: string, data?: unknown): void {
    this.markAnswered(requestId)
    const obj = { type: 'result', action, requestId, ok: true, data }
    if (this.echoDelayMs > 0 && DELAYED_RESULT_ACTIONS.test(action)) {
      this.delayed(() => this.raw(obj))
    } else {
      this.raw(obj)
    }
  }

  fail(requestId: string | number, action: string, error: string, errorCode?: string): void {
    this.markAnswered(requestId)
    this.raw({ type: 'result', action, requestId, ok: false, error, errorCode })
  }

  private markAnswered(requestId: string | number): void {
    if (this.answering?.requestId === requestId) this.answering.answered = true
  }

  lobby(tables: TableView[], users: UsersView[] = []): void {
    const usersView: RoomUsersView = {
      numberActiveGames: 0,
      numberGameThreads: 0,
      numberMaxGames: 10,
      usersView: users,
    }
    this.raw({ type: 'lobby', roomId: 'room-fake', tables, users: usersView, serverMessages: [] })
  }

  close(): void {
    this.ws.close()
  }
}

export class FakeServerCore {
  private conns = new Set<FakeConnection>()
  private cleanups: (() => void)[] = []
  private scenarioInstance: Scenario | null = null
  private messageSeq = 0

  constructor(
    private readonly makeScenario: () => Scenario,
    private readonly options: FakeServerOptions = {},
  ) {}

  attach(socket: FakeSocket): FakeSocketHandle {
    // One scenario per server (not per connection): every connection shares the same game state.
    if (!this.scenarioInstance) this.scenarioInstance = this.makeScenario()
    const scenario = this.scenarioInstance
    const conn = new FakeConnection(nextConnId++, socket, this, this.options.echoDelayMs ?? 0)
    this.conns.add(conn)
    let cleanup: (() => void) | void = undefined
    let closed = false
    const close = () => {
      if (closed) return
      closed = true
      this.conns.delete(conn)
      if (cleanup) {
        const i = this.cleanups.indexOf(cleanup)
        if (i >= 0) this.cleanups.splice(i, 1)
        cleanup()
      }
    }
    scenario.onConnect?.(conn)
    cleanup = scenario.onStart?.(conn)
    if (cleanup) this.cleanups.push(cleanup)
    const message = (raw: string) => {
      let msg: Record<string, unknown>
      try {
        msg = JSON.parse(raw) as Record<string, unknown>
      } catch {
        return
      }
      const action = String(msg.action ?? '')
      const requestId = (msg.requestId ?? null) as string | number
      const args = (msg.args ?? {}) as Record<string, unknown>
      if (action === 'ping') {
        conn.ok(requestId, action, 'pong')
        return
      }
      if (action === 'connect') {
        const nameError = validateServerUserName(String(args.username ?? '').trim())
        if (nameError) {
          conn.fail(requestId, action, `Error while connecting to server\n${nameError}`)
          return
        }
      }
      conn.beginRequest(requestId)
      try {
        scenario.onAction?.(conn, action, args, requestId)
      } catch (err) {
        console.error(`[fake] handler for "${action}" failed: ${(err as Error).message}`)
        conn.fail(requestId, action, `fixture error: ${(err as Error).message}`)
        conn.endRequest()
        return
      }
      if (!conn.endRequest()) conn.ok(requestId, action, DEFAULT_RESULTS[action])
    }
    return { message, close }
  }

  /** Session messageId (one server-wide counter, like the proxy's): the client orders a
   *  game's events by it, so an event emitted from another connection must never look
   *  older than the ones before it. */
  nextMessageId(): number {
    return ++this.messageSeq
  }

  broadcast(obj: unknown, exceptId?: number): void {
    for (const c of this.conns) {
      if (c.id !== exceptId) c.raw(obj)
    }
  }

  shutdown(): void {
    for (const cleanup of this.cleanups) {
      try {
        cleanup()
      } catch {
        // the scenario may have nothing left to clean
      }
    }
    this.cleanups = []
    for (const c of [...this.conns]) c.close()
    this.conns.clear()
  }
}
