/**
 * FixtureServer: implementación determinista del contrato WS del proxy
 * (Mage.Proxy) para los E2E de navegador. Escucha en el puerto dedicado
 * (8788) y responde a las acciones de commands.ts con envelopes
 * {type:'result'} y emite callbacks {type:'event'} según un escenario
 * declarativo. Nada de Java, nada de timing real: los tests de UI corren en
 * segundos y son reproducibles al 100%.
 * Tipado contra src/net/types.ts (el typecheck valida la coherencia fake↔cliente).
 */

import { WebSocketServer, WebSocket } from 'ws'
import type { GameView, RoomUsersView, SeatView, TableView, UserView } from '../src/net/types'

let nextConnId = 1

export interface FakeConn {
  readonly id: number
  /** Callback del servidor (type:'event'); messageId autoincremental. */
  event(method: string, data: unknown, objectId?: string | null): void
  /** Emite el evento a TODAS las conexiones del servidor (la página y el
   *  helper WS del humano ven la misma partida). */
  broadcast(method: string, data: unknown, objectId?: string | null): void
  /** Respuesta a una acción (type:'result'). */
  ok(requestId: string | number, action: string, data?: unknown): void
  fail(requestId: string | number, action: string, error: string, errorCode?: string): void
  /** Broadcast del lobby (type:'lobby'). */
  lobby(tables: TableView[], users?: UserView[]): void
  raw(obj: unknown): void
  isOpen(): boolean
  close(): void
}

export interface Scenario {
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
    { name: 'Three Player', minPlayers: 3, maxPlayers: 3 },
    { name: 'Four Player', minPlayers: 4, maxPlayers: 4 },
  ],
  getPlayerTypes: ['HUMAN', 'SIM', 'COMPUTER_MAD'],
  getDeckTypes: ['Constructed - Modern'],
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
    isTournament: false,
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
  getGameView?: () => GameView
  selectMessage?: string
  onConnect?: (conn: FakeConn) => void
  onStartMatch?: (conn: FakeConn) => void
  onSendPlayerUUID?: (conn: FakeConn, uuid: string, ctx: BaseScenarioActionContext) => void
  onSendPlayerAction?: (conn: FakeConn, value: string, ctx: BaseScenarioActionContext) => void
  onSendPlayerBoolean?: (conn: FakeConn, ctx: BaseScenarioActionContext) => void
  onSendPlayerInteger?: (conn: FakeConn, value: number, ctx: BaseScenarioActionContext) => void
  onSendPlayerString?: (conn: FakeConn, value: string, ctx: BaseScenarioActionContext) => void
  onExtra?: (conn: FakeConn, action: string, args: Record<string, unknown>, requestId: string | number) => boolean
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
  const table = makeTable({ tableId: opts.tableId, tableName: opts.tableName, gameId: opts.gameId })
  const getGv = opts.getGameView ?? (() => opts.gameView as GameView)
  const selectMessage = opts.selectMessage ?? 'Main 1: Cast spells or activate abilities'
  let activeConn: FakeConn | null = null

  return {
    onConnect: (conn) => {
      activeConn = conn
      conn.raw({ type: 'connected', message: 'Proxy ready.' })
      conn.raw({ type: 'info', message: 'Proxy ready.' })
      conn.lobby([table])
      opts.onConnect?.(conn)
    },
    onAction: (conn, action, args, requestId) => {
      activeConn = conn
      const gv = () => getGv()
      const ctx = (): BaseScenarioActionContext => ({ args, activeConn })
      switch (action) {
        case 'connect':
        case 'createTable':
        case 'joinGame':
        case 'watchTable':
        case 'watchGame':
          conn.ok(requestId, action, { tableId: table.tableId })
          conn.lobby([table])
          return
        case 'startMatch': {
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
        default:
          if (opts.onExtra?.(conn, action, args, requestId)) return
          conn.ok(requestId, action, {})
      }
    },
  }
}

class FakeConnection implements FakeConn {
  private seq = 0
  constructor(
    readonly id: number,
    private readonly ws: WebSocket,
    private readonly scenario: Scenario,
    private readonly server: FakeServer,
  ) {}

  isOpen(): boolean {
    return this.ws.readyState === WebSocket.OPEN
  }

  raw(obj: unknown): void {
    if (this.isOpen()) this.ws.send(JSON.stringify(obj))
  }

  event(method: string, data: unknown, objectId: string | null = null): void {
    this.raw({ type: 'event', method, messageId: ++this.seq, objectId, data })
  }

  broadcast(method: string, data: unknown, objectId: string | null = null): void {
    const obj = { type: 'event', method, messageId: ++this.seq, objectId, data }
    this.raw(obj)
    this.server.broadcast(obj, this.id)
  }

  ok(requestId: string | number, action: string, data?: unknown): void {
    this.raw({ type: 'result', action, requestId, ok: true, data })
  }

  fail(requestId: string | number, action: string, error: string, errorCode?: string): void {
    this.raw({ type: 'result', action, requestId, ok: false, error, errorCode })
  }

  lobby(tables: TableView[], users: UserView[] = []): void {
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

export class FakeServer {
  private wss: WebSocketServer
  private conns = new Set<FakeConnection>()
  private cleanups: (() => void)[] = []
  private scenarioInstance: Scenario | null = null

  constructor(readonly port: number, private readonly makeScenario: () => Scenario) {}

  static async start(port: number, makeScenario: () => Scenario): Promise<FakeServer> {
    const server = new FakeServer(port, makeScenario)
    await server.listen()
    return server
  }

  private listen(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.wss = new WebSocketServer({ port: this.port })
      this.wss.on('error', reject)
      this.wss.on('listening', () => {
        this.wss.removeListener('error', reject)
        this.wss.on('error', (err) => {
          console.error(`[fake] error del servidor (puerto ${this.port}): ${err.message}`)
        })
        resolve()
      })
      this.wss.on('connection', (ws) => {
        this.handleConnection(ws)
      })
    })
  }

  private handleConnection(ws: WebSocket) {
    // El escenario se crea UNA vez por servidor (no por conexión): la página y
    // el HumanHelper WS del humano comparten el MISMO estado de juego (partida
    // humana vs Sim) a través del broadcast de FakeConnection.
    if (!this.scenarioInstance) this.scenarioInstance = this.makeScenario()
    const scenario = this.scenarioInstance
    const conn = new FakeConnection(nextConnId++, ws, scenario, this)
    this.conns.add(conn)
    ws.on('close', () => {
      this.conns.delete(conn)
    })
    ws.on('error', () => {
      this.conns.delete(conn)
    })
    scenario.onConnect?.(conn)
    const cleanup = scenario.onStart?.(conn)
    if (cleanup) {
      this.cleanups.push(cleanup)
      ws.on('close', () => {
        const i = this.cleanups.indexOf(cleanup)
        if (i >= 0) this.cleanups.splice(i, 1)
        cleanup()
      })
    }
    ws.on('message', (raw: Buffer) => {
      let msg: Record<string, unknown>
      try {
        msg = JSON.parse(raw.toString()) as Record<string, unknown>
      } catch {
        return
      }
      const action = String(msg.action ?? '')
      const requestId = msg.requestId ?? null
      const args = ((msg.args ?? {}) as Record<string, unknown>) ?? {}
      let answered = false
      const respond = () => {
        if (answered) return
        answered = true
        conn.ok(requestId, action, DEFAULT_RESULTS[action])
      }
      try {
        scenario.onAction?.(conn, action, args, requestId)
      } catch (err) {
        console.error(`[fake] handler de "${action}" falló: ${(err as Error).message}`)
        conn.fail(requestId, action, `fixture error: ${(err as Error).message}`)
        return
      }
      // si el escenario no respondió a la acción, el core responde ok genérico
      respond()
    })
  }

  get connectedConns(): number {
    return this.conns.size
  }

  /** Reenvía un frame a todas las conexiones excepto la emisora. */
  broadcast(obj: unknown, exceptId?: number): void {
    for (const c of this.conns) {
      if (c.id !== exceptId) c.raw(obj)
    }
  }

  async stop(): Promise<void> {
    for (const cleanup of this.cleanups) {
      try {
        cleanup()
      } catch {
        // el escenario puede ya no tener recursos que limpiar
      }
    }
    this.cleanups = []
    for (const c of [...this.conns]) c.close()
    this.conns.clear()
    await new Promise<void>((resolve) => {
      const timer = setTimeout(() => resolve(), 2000)
      this.wss.close(() => {
        clearTimeout(timer)
        resolve()
      })
    })
    await new Promise((r) => setTimeout(r, 500))
  }
}
