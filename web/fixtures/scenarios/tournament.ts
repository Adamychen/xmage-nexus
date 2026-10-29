import type { FakeConn, Scenario } from '../fake'
import type { TournamentView, RoundView, TournamentPlayerView, TournamentGameView, TableView } from '../../src/net/types'

const TOURNAMENT_ID = 'tournament-test-1'
const TABLE_ID = 'table-tournament-1'
const GAME_ID = 'game-tournament-1'

function localMakeTable(opts: { tableId: string; tableName: string; gameId: string; gameType?: string; deckType?: string }): TableView {
  return {
    tableId: opts.tableId,
    gameType: opts.gameType ?? 'Commander Free For All',
    deckType: opts.deckType ?? 'Variant Magic - Commander',
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

const SAMPLE_HISTORY = 'Matches: 41 (2%), Tourneys: 6 (0%), Constructed Rating: 1540, Limited Rating: 1490'

function sampleMatch(
  roundNum: number,
  matchId: string,
  [first, second]: readonly [string, string],
  finishedGames: readonly (readonly [string, string])[],
  runningDuration?: string,
): TournamentGameView[] {
  const players = `${first} - ${second}`
  const entries: TournamentGameView[] = finishedGames.map(([winner, duration], index) => ({
    roundNum,
    matchId: `match-${matchId}`,
    gameId: `game-${matchId}-${index + 1}`,
    tableId: `table-${matchId}`,
    state: `Finished (${duration})`,
    result: `Player ${winner} is the winner`,
    players,
  }))
  if (runningDuration) {
    entries.push({
      roundNum,
      matchId: `match-${matchId}`,
      gameId: `game-${matchId}-${finishedGames.length + 1}`,
      tableId: `table-${matchId}`,
      state: `Dueling (${runningDuration})`,
      result: '',
      players,
    })
  }
  return entries
}

export function sampleTournamentView(overrides: Partial<TournamentView> = {}): TournamentView {
  const now = Date.now()
  const players: TournamentPlayerView[] = [
    { name: 'alice', flagName: 'es', state: 'Dueling', points: 3, results: 'R1 bob [2-0] ', history: SAMPLE_HISTORY, quit: false },
    { name: 'bob', flagName: 'us', state: 'Waiting for next round', points: 3, results: 'R1 alice [0-2] R2 charlie [2-0Q] ', history: '', quit: false },
    { name: 'charlie', flagName: 'de', state: 'Eliminated', points: 0, results: 'R1 diana [1-2] R2 bob [0Q-2] ', history: '', quit: true },
    { name: 'diana', flagName: 'fr', state: 'Dueling', points: 3, results: 'R1 charlie [2-1] ', history: '', quit: false },
  ]
  const rounds: RoundView[] = [
    {
      games: [
        ...sampleMatch(1, 'r1-a', ['alice', 'bob'], [['alice', '12:30'], ['alice', '10:02']]),
        ...sampleMatch(1, 'r1-b', ['charlie', 'diana'], [['diana', '9:20'], ['charlie', '11:44'], ['diana', '13:05']]),
      ],
    },
    {
      games: [
        ...sampleMatch(2, 'r2-a', ['alice', 'diana'], [['alice', '8:50']], '8:14'),
        ...sampleMatch(2, 'r2-b', ['bob', 'charlie'], [['bob', '7:30'], ['bob', '6:12']]),
      ],
    },
  ]
  return {
    tournamentName: 'Modern Swiss #7',
    tournamentType: 'Constructed Swiss / Constructed - Modern 3 rounds',
    tournamentState: 'Dueling',
    startTime: now - 3600_000,
    endTime: null,
    stepStartTime: now - 120_000,
    serverTime: now,
    constructionTime: 600,
    watchingAllowed: true,
    rounds,
    players,
    runningInfo: '',
    ...overrides,
  }
}

export interface TournamentScenarioOptions {
  view?: TournamentView
  includeStartTournament?: boolean
  includeInit?: boolean
  emitUpdates?: number
  /** On watchTable (Espectar) the server answers SHOW_TOURNAMENT with the real
   *  tournament id, as it does for tournament tables. watchTournamentTable always
   *  does: the bracket resolves a table's tournament id through that callback. */
  emitShowTournamentOnWatch?: boolean
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
    gameType: 'Two Player Duel',
    deckType: 'Constructed - Modern',
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
        case 'watchTable':
        case 'watchTournamentTable':
          conn.ok(requestId, action, { tableId: TABLE_ID })
          if (action === 'watchTournamentTable' || opts.emitShowTournamentOnWatch) {
            setTimeout(() => {
              conn.broadcast('SHOW_TOURNAMENT', { currentTableId: TABLE_ID, parentTableId: null }, TOURNAMENT_ID)
            }, 20)
          }
          return
        case 'getTournamentChatId':
          conn.ok(requestId, action, `tournament-chat-${argStr('tournamentId') || TOURNAMENT_ID}`)
          return
        case 'joinChat':
        case 'leaveChat':
          conn.ok(requestId, action, true)
          return
        case 'sendChatMessage': {
          const text = String((args as Record<string, unknown>).text ?? '')
          const scopeChatId = String((args as Record<string, unknown>).chatId ?? '')
          conn.ok(requestId, action, true)
          if (text && scopeChatId) {
            conn.broadcast('CHATMESSAGE', { chatId: scopeChatId, username: 'mesa-rival', message: text, time: Date.now() }, scopeChatId)
          }
          return
        }
        case 'getGameTypes':
          conn.ok(requestId, action, [
            { name: 'Commander Free For All', minPlayers: 3, maxPlayers: 10 },
            { name: 'Two Player Duel', minPlayers: 2, maxPlayers: 2 },
          ])
          return
        case 'getDeckTypes':
          conn.ok(requestId, action, ['Variant Magic - Commander', 'Limited'])
          return
        case 'getExpansionsWithBoosters':
          conn.ok(requestId, action, [
            { code: 'M21', name: 'Core Set 2021', releaseDate: 1594252800000 },
            { code: 'MH3', name: 'Modern Horizons 3', releaseDate: 1717718400000 },
            { code: 'BLB', name: 'Bloomburrow', releaseDate: 1722556800000 },
            { code: 'DSK', name: 'Duskmourn', releaseDate: 1727395200000 },
            { code: 'OTJ', name: 'Outlaws of Thunder Junction', releaseDate: 1712880000000 },
          ])
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
