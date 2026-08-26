import type { FakeConn, Scenario } from '../fake'
import type { TournamentView, RoundView, TournamentPlayerView, TournamentGameView, TableView } from '../../src/net/types'

const TOURNAMENT_ID = 'tournament-test-1'
const TABLE_ID = 'table-tournament-1'
const GAME_ID = 'game-tournament-1'

function localMakeTable(opts: { tableId: string; tableName: string; gameId: string; gameType?: string; deckType?: string }): TableView {
  return {
    tableId: opts.tableId,
    gameType: opts.gameType ?? 'Commander / Free For All',
    deckType: opts.deckType ?? 'Commander',
    tableName: opts.tableName,
    controllerName: 'host',
    additionalInfoShort: '3/4',
    additionalInfoFull: '',
    createTime: Date.now(),
    tableState: 'DUELING',
    skillLevel: 'Casual',
    tableStateText: 'Dueling',
    seatsInfo: '3/4',
    isTournament: true,
    seats: [
      { playerName: 'host', seatIndex: 0, playerType: 'HUMAN' },
      { playerName: 'alice', seatIndex: 1, playerType: 'HUMAN' },
      { playerName: 'bob', seatIndex: 2, playerType: 'HUMAN' },
      { playerName: 'charlie', seatIndex: 3, playerType: 'HUMAN' },
    ],
    games: [opts.gameId],
    quitRatio: '100',
    minimumRating: '0',
    limited: false,
    rated: false,
    passworded: false,
    spectatorsAllowed: true,
  } as TableView
}

export function sampleTournamentView(overrides: Partial<TournamentView> = {}): TournamentView {
  const now = Date.now()
  const players: TournamentPlayerView[] = [
    { name: 'alice', state: 'Dueling', points: 6, results: '2-0', history: 'W-W', flagName: 'es', quit: false },
    { name: 'bob', state: 'Dueling', points: 3, results: '1-1', history: 'W-L', flagName: 'us', quit: false },
    { name: 'charlie', state: 'Eliminated', points: 0, results: '0-2', history: 'L-L', flagName: 'de', quit: true },
    { name: 'diana', state: 'Dueling', points: 3, results: '1-1', history: 'L-W', flagName: 'fr', quit: false },
  ]
  const rounds: RoundView[] = [
    {
      games: [
        { roundNum: 1, state: 'Finished', players: 'alice vs bob', result: '2-0', tableId: 'table-g1', matchId: 'match-1', gameId: 'game-1' },
        { roundNum: 1, state: 'Finished', players: 'charlie vs diana', result: '0-2', tableId: 'table-g2', matchId: 'match-2', gameId: 'game-2' },
      ] as TournamentGameView[],
    },
    {
      games: [
        { roundNum: 2, state: 'Dueling', players: 'alice vs diana', result: '', tableId: 'table-g3', matchId: 'match-3', gameId: 'game-3' },
        { roundNum: 2, state: 'Ready', players: 'bob vs charlie', result: '', tableId: 'table-g4', matchId: 'match-4', gameId: 'game-4' },
      ] as TournamentGameView[],
    },
  ]
  return {
    tournamentName: 'Commander Clash',
    tournamentType: 'Swiss',
    tournamentState: 'Dueling',
    startTime: now - 3600_000,
    endTime: null,
    stepStartTime: now - 120_000,
    serverTime: now,
    constructionTime: 600,
    watchingAllowed: true,
    rounds,
    players,
    runningInfo: 'Ronda 2 en curso — 2 mesas activas',
    ...overrides,
  }
}

export interface TournamentScenarioOptions {
  view?: TournamentView
  includeStartTournament?: boolean
  includeInit?: boolean
  emitUpdates?: number
}

export function makeTournamentScenario(opts: TournamentScenarioOptions = {}): Scenario {
  const view = opts.view ?? sampleTournamentView()
  const includeStart = opts.includeStartTournament ?? true
  const includeInit = opts.includeInit ?? true
  const emitUpdates = opts.emitUpdates ?? 1

  let currentView: TournamentView = { ...view, rounds: [...view.rounds], players: [...view.players] }
  let activeConn: FakeConn | null = null

  const tournamentTable = localMakeTable({
    tableId: TABLE_ID,
    tableName: view.tournamentName,
    gameId: GAME_ID,
    gameType: view.tournamentType,
    deckType: 'Commander',
  })

  function broadcastTournament(method: string, v: TournamentView) {
    if (!activeConn) return
    activeConn.broadcast(method, v, TOURNAMENT_ID)
  }

  return {
    onConnect(conn) {
      activeConn = conn
      conn.raw({ type: 'connected', message: 'Proxy ready.' })
      conn.raw({ type: 'info', message: 'Proxy ready.' })
      conn.lobby([tournamentTable])
      setTimeout(() => {
        if (includeStart) {
          conn.broadcast('START_TOURNAMENT', { currentTableId: TABLE_ID }, TABLE_ID)
        }
        if (includeInit) {
          conn.broadcast('TOURNAMENT_INIT', currentView, TOURNAMENT_ID)
        }
        let count = 0
        const interval = setInterval(() => {
          if (count >= emitUpdates) {
            clearInterval(interval)
            return
          }
          count++
          currentView = { ...currentView, serverTime: Date.now(), runningInfo: `Update ${count} — ${currentView.runningInfo}` }
          broadcastTournament('TOURNAMENT_UPDATE', currentView)
        }, 300)
      }, 120)
    },
    onAction(conn, action, args, requestId) {
      activeConn = conn
      const argStr = (k: string) => String((args as Record<string, unknown>)[k] ?? '')
      switch (action) {
        case 'connect':
          conn.ok(requestId, action, {})
          conn.lobby([tournamentTable])
          return
        case 'createTable':
        case 'createTournamentTable':
          conn.ok(requestId, action, { tableId: TABLE_ID })
          conn.lobby([tournamentTable])
          setTimeout(() => {
            conn.broadcast('TOURNAMENT_INIT', currentView, TOURNAMENT_ID)
          }, 80)
          return
        case 'joinTable':
        case 'joinTournamentTable':
          conn.ok(requestId, action, {})
          return
        case 'getTournament': {
          const tid = argStr('tournamentId') || TOURNAMENT_ID
          void tid
          conn.ok(requestId, action, currentView)
          return
        }
        case 'quitTournament': {
          conn.ok(requestId, action, true)
          const quitView: TournamentView = {
            ...currentView,
            players: currentView.players.map((p) => (p.name === 'alice' ? { ...p, quit: true, state: 'Quit' } : p)),
            runningInfo: 'alice abandonó el torneo',
          }
          currentView = quitView
          setTimeout(() => broadcastTournament('TOURNAMENT_UPDATE', quitView), 50)
          return
        }
        case 'watchTournamentTable':
          conn.ok(requestId, action, {})
          return
        case 'getGameTypes':
          conn.ok(requestId, action, [
            { name: 'Commander / Free For All', minPlayers: 2, maxPlayers: 4 },
            { name: 'Two Player Duel', minPlayers: 2, maxPlayers: 2 },
          ])
          return
        case 'getDeckTypes':
          conn.ok(requestId, action, ['Commander'])
          return
        default:
          conn.ok(requestId, action, {})
          return
      }
    },
  }
}

export function tournamentScenario(): Scenario {
  return makeTournamentScenario()
}

export { TOURNAMENT_ID, TABLE_ID, GAME_ID }
