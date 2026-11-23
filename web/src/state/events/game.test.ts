import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { handleMessage } from '../eventHandler'
import * as cmds from '../../net/commands'
import { getState, setState } from '../state'
import { clearActiveGame, loadActiveGame } from '../persistence'
import { emptyCombat } from '../gameUtils'
import { makeGameView, makePlayer } from '../../__fixtures__/gameViews'
import { startCardFlight, getActiveFlights, clearFlights } from '../../board/flightManager'
import type { CardView, TableView } from '../../net/types'

vi.mock('../../net/commands', () => ({
  joinGame: vi.fn().mockResolvedValue(null),
  getGameChatId: vi.fn().mockResolvedValue(null),
  joinChat: vi.fn().mockResolvedValue(null),
  leaveChat: vi.fn().mockResolvedValue(null),
  stopWatching: vi.fn().mockResolvedValue(null),
  quitMatch: vi.fn().mockResolvedValue(null),
  leaveTable: vi.fn().mockResolvedValue(null),
  removeTable: vi.fn().mockResolvedValue(null),
  startMatch: vi.fn().mockResolvedValue(null),
  sendPlayerAction: vi.fn().mockResolvedValue(null),
  sendPlayerBoolean: vi.fn().mockResolvedValue(null),
  sendPlayerUUID: vi.fn().mockResolvedValue(null),
  sendManaPaymentMode: vi.fn().mockResolvedValue(null),
  updatePreferences: vi.fn().mockResolvedValue(null),
  watchGame: vi.fn().mockResolvedValue(null),
  getRoomChatId: vi.fn().mockResolvedValue(null),
}))

const CARD: CardView = {
  id: 'bolt-1',
  name: 'Lightning Bolt',
  manaValue: 1,
  expansionSetCode: 'LEA',
  cardNumber: '161',
}

const fromRect = {
  left: 100,
  top: 500,
  right: 200,
  bottom: 640,
  width: 100,
  height: 140,
  x: 100,
  y: 500,
  toJSON: () => {},
} as DOMRect

const toRect = {
  left: 400,
  top: 200,
  right: 500,
  bottom: 340,
  width: 100,
  height: 140,
  x: 400,
  y: 200,
  toJSON: () => {},
} as DOMRect

function readableGameView() {
  return makeGameView({
    players: [
      makePlayer({ playerId: 'me', name: 'Me', controlled: true, isHuman: true, isActive: true, hasPriority: true }),
      makePlayer({ playerId: 'opp', name: 'Opp' }),
    ],
    myPlayerId: 'me',
    activePlayerId: 'me',
    activePlayerName: 'Me',
    priorityPlayerName: 'Me',
  })
}

describe('handleGameUpdate — GAME_INIT', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    clearFlights()
    setState({ phase: 'game', gameId: 'g-init', game: null })
  })

  afterEach(() => {
    clearFlights()
    vi.useRealTimers()
  })

  it('limpia los vuelos activos al recibir GAME_INIT (resume tras recarga o reconexión)', () => {
    const flightId = startCardFlight(CARD, fromRect, toRect, 10_000)
    expect(flightId).not.toBeNull()
    expect(getActiveFlights()).toHaveLength(1)

    handleMessage({
      type: 'event',
      method: 'GAME_INIT',
      messageId: 1,
      objectId: 'g-init',
      data: { gameView: readableGameView() },
    } as never)

    expect(getActiveFlights()).toHaveLength(0)
    expect(getState().game).not.toBeNull()
  })

  it('no toca los vuelos en un GAME_UPDATE normal', () => {
    const flightId = startCardFlight(CARD, fromRect, toRect, 10_000)
    expect(flightId).not.toBeNull()

    handleMessage({
      type: 'event',
      method: 'GAME_UPDATE',
      messageId: 2,
      objectId: 'g-init',
      data: { gameView: readableGameView() },
    } as never)

    expect(getActiveFlights()).toHaveLength(1)
  })
})

describe('handleGameUpdate — persisted role', () => {
  beforeEach(() => {
    clearActiveGame()
    clearFlights()
    setState({ phase: 'lobby', gameId: null, game: null })
  })

  it('keeps the watcher role saved by WATCHGAME when GAME_UPDATE arrives', () => {
    handleMessage({ type: 'event', method: 'WATCHGAME', messageId: 1, objectId: 'g-watch', data: {} } as never)
    handleMessage({
      type: 'event',
      method: 'GAME_UPDATE',
      messageId: 2,
      objectId: 'g-watch',
      data: { gameView: readableGameView() },
    } as never)
    expect(loadActiveGame()).toMatchObject({ gameId: 'g-watch', role: 'watcher' })
  })

  it('saves the player role for a game the player is in', () => {
    setState({ phase: 'game', gameId: 'g-play' })
    handleMessage({
      type: 'event',
      method: 'GAME_UPDATE',
      messageId: 3,
      objectId: 'g-play',
      data: { gameView: readableGameView() },
    } as never)
    expect(loadActiveGame()).toMatchObject({ gameId: 'g-play', role: 'player' })
  })
})

describe('game end and new game clear the pending prompt', () => {
  const TARGET_PROMPT = {
    message: 'Choose a target',
    targets: ['card-1'],
    cardsView1: { 'card-1': { id: 'card-1', name: 'Forest' } },
  }

  function leavePendingPrompt(gameId: string) {
    setState({ phase: 'game', gameId, game: readableGameView(), playableIds: ['card-1'], playableWindow: null, combat: emptyCombat() })
    handleMessage({ type: 'event', method: 'GAME_TARGET', messageId: 1, objectId: gameId, data: TARGET_PROMPT } as never)
    expect(getState().feedback?.method).toBe('GAME_TARGET')
  }

  beforeEach(() => {
    clearActiveGame()
    setState({ gameEnd: null, rollbackVote: null, feedback: null, playableIds: [], playableWindow: null, combat: null })
  })

  it('GAME_OVER clears a pending target prompt, playables and combat', () => {
    leavePendingPrompt('g-end')
    handleMessage({ type: 'event', method: 'GAME_OVER', messageId: 2, objectId: 'g-end', data: { message: 'Game over', winnerName: 'Opp' } } as never)
    expect(getState().feedback).toBeNull()
    expect(getState().playableIds).toEqual([])
    expect(getState().playableWindow).toBeNull()
    expect(getState().combat).toBeNull()
  })

  it('END_GAME_INFO of a game that does not end the match clears the pending prompt', () => {
    leavePendingPrompt('g-end')
    handleMessage({
      type: 'event',
      method: 'END_GAME_INFO',
      messageId: 2,
      objectId: 'g-end',
      data: { gameInfo: 'Opp won game 1', matchInfo: 'Game 1 of 3 finished' },
    } as never)
    expect(getState().gameEnd).not.toBeNull()
    expect(getState().feedback).toBeNull()
    expect(getState().playableIds).toEqual([])
    expect(getState().playableWindow).toBeNull()
    expect(getState().combat).toBeNull()
  })

  it('GME-1: END_GAME_INFO ends the match when every other player has already left', () => {
    const me = makePlayer({ playerId: 'p-me', name: 'Me', controlled: true })
    const rival = makePlayer({ playerId: 'p-rival', name: 'Rival', hasLeft: true })
    setState({
      phase: 'game',
      gameId: 'g-alone',
      game: makeGameView({ players: [me, rival], myPlayerId: 'p-me' }),
    })

    handleMessage({
      type: 'event',
      method: 'END_GAME_INFO',
      messageId: 2,
      objectId: 'g-alone',
      data: {
        won: true,
        gameInfo: 'You won the game on turn 5.',
        matchInfo: 'You need one more win to win the match.',
        players: [me, rival],
      },
    } as never)

    expect(getState().phase).toBe('lobby')
    expect(getState().gameId).toBeNull()
    expect(getState().game).toBeNull()
    expect(getState().gameEnd).not.toBeNull()
  })

  it('START_GAME for another game clears the previous game prompt', () => {
    leavePendingPrompt('g-old')
    handleMessage({ type: 'event', method: 'START_GAME', messageId: 2, data: { gameId: 'g-new', tableName: 'T' } } as never)
    expect(getState().gameId).toBe('g-new')
    expect(getState().feedback).toBeNull()
    expect(getState().playableIds).toEqual([])
    expect(getState().combat).toBeNull()
  })
})

describe('WATCHGAME keeps the watched table (LBY-33)', () => {
  const COMMANDER_TABLE: TableView = {
    tableId: 'table-commander',
    tableName: 'Epic Commander Pod',
    controllerName: 'Bob',
    gameType: 'Commander Free For All',
    deckType: 'Constructed - Commander',
    additionalInfoShort: '',
    additionalInfoFull: '',
    createTime: 0,
    tableState: 'DUELING',
    skillLevel: 'CASUAL',
    tableStateText: 'Dueling',
    seatsInfo: '4/4',
    isTournament: false,
    seats: [0, 1, 2, 3].map((i) => ({ playerName: `P${i}`, seatIndex: i, playerType: 'HUMAN' as const })),
    games: ['g-watch'],
    quitRatio: '0%',
    minimumRating: '0',
    limited: false,
    rated: false,
    passworded: false,
    spectatorsAllowed: true,
  }

  beforeEach(() => {
    clearActiveGame()
    vi.mocked(cmds.watchGame).mockClear()
    setState({
      phase: 'lobby',
      gameId: null,
      game: null,
      watchingTable: null,
      lobby: { type: 'lobby', tables: [COMMANDER_TABLE] } as never,
    })
  })

  afterEach(() => {
    setState({ phase: 'lobby', gameId: null, watchingTable: null, lobby: null })
  })

  const watchGameEvent = (data: unknown) => ({
    type: 'event', method: 'WATCHGAME', messageId: 1, objectId: 'g-watch', data,
  })

  it('LBY-33: resolves the table from the callback payload', () => {
    handleMessage(watchGameEvent({ currentTableId: 'table-commander', parentTableId: null }) as never)

    expect(getState().phase).toBe('spectating_pending')
    expect(getState().watchingTable?.tableId).toBe('table-commander')
    expect(getState().watchingTable?.seats).toHaveLength(4)
  })

  it('LBY-33: falls back to the parent table of a tournament sub-table', () => {
    handleMessage(watchGameEvent({ currentTableId: 'sub-table-unknown', parentTableId: 'table-commander' }) as never)

    expect(getState().watchingTable?.tableId).toBe('table-commander')
  })

  it('LBY-33: keeps the table the lobby already set when the payload names none', () => {
    setState({ phase: 'spectating_pending', watchingTable: COMMANDER_TABLE })

    handleMessage(watchGameEvent({}) as never)

    expect(getState().watchingTable?.tableId).toBe('table-commander')
  })

  it('LBY-33: does not watch again the game it already watches', () => {
    handleMessage(watchGameEvent({ currentTableId: 'table-commander' }) as never)
    expect(cmds.watchGame).toHaveBeenCalledTimes(1)

    handleMessage(watchGameEvent({ currentTableId: 'table-commander' }) as never)
    expect(cmds.watchGame).toHaveBeenCalledTimes(1)
  })
})
