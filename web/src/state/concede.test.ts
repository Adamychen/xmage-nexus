import { beforeEach, describe, expect, it, vi } from 'vitest'
import { makeGameView, makePlayer } from '../__fixtures__/gameViews'
import { getState, setState } from './state'
import { concedeGame, concedeMatch, returnToLobby, reset, clearGameEnd } from './store'
import { handleEndGameInfo } from './events/game'
import { handleSideboard } from './events/sideboard'
import * as cmds from '../net/commands'

vi.mock('../net/commands', () => ({
  setGateway: vi.fn(),
  getGateway: vi.fn(),
  quitMatch: vi.fn(),
  stopWatching: vi.fn(),
  leaveChat: vi.fn(),
  sendPlayerAction: vi.fn().mockResolvedValue({ ok: true }),
  submitDeck: vi.fn().mockResolvedValue({ ok: true }),
  getGameChatId: vi.fn().mockResolvedValue(null),
}))

vi.mock('../cards/cardImages', () => ({
  awaitCardMeta: vi.fn().mockResolvedValue({ name: 'Test Card' }),
}))

describe('concedeGame', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    reset()
    setState({
      phase: 'game',
      gameId: 'game-1',
      game: makeGameView({
        players: [makePlayer({ playerId: 'p1', name: 'Me', controlled: true, isHuman: true })],
      }),
    })
  })

  it('envía PlayerAction.CONCEDE manteniendo la fase de juego para SIDEBOARD / siguiente partida', async () => {
    await concedeGame('game-1')

    expect(cmds.sendPlayerAction).toHaveBeenCalledWith('CONCEDE', 'game-1')
    // No aborta el match: espera a que el servidor envíe END_GAME_INFO
    expect(getState().phase).toBe('game')
    expect(getState().gameId).toBe('game-1')
  })

  it('concedeMatch envía CONCEDE, quitMatch y vuelve al lobby', async () => {
    await concedeMatch('game-1')

    expect(cmds.sendPlayerAction).toHaveBeenCalledWith('CONCEDE', 'game-1')
    expect(cmds.quitMatch).toHaveBeenCalledWith('game-1')
    expect(getState().phase).toBe('lobby')
    expect(getState().gameId).toBeNull()
  })

  it('returnToLobby sin jugador (espectador) no envía CONCEDE', () => {
    setState({
      phase: 'game',
      gameId: 'game-1',
      game: makeGameView({
        players: [makePlayer({ playerId: 'p1', name: 'Opp', controlled: false, isHuman: false })],
      }),
    })
    returnToLobby()
    expect(cmds.sendPlayerAction).not.toHaveBeenCalled()
  })

  it('no tapa el diálogo de fin de partida (match continúa) si el SIDEBOARD de la siguiente partida llega antes de que el jugador lo cierre', async () => {
    // Bo3: al conceder la partida 1, el servidor manda END_GAME_INFO (match no
    // terminado) y, casi acto seguido, SIDEBOARD para la partida 2 — sin esperar
    // a que el jugador reconozca el resultado.
    handleEndGameInfo({ matchInfo: 'You have lost the game', gameInfo: 'You have lost the game', won: false })
    expect(getState().gameEnd).not.toBeNull()
    expect(getState().phase).toBe('game')

    handleSideboard({ deck: { name: 'Mi mazo', cards: {}, sideboard: {} }, currentTableId: 'table-1' }, getState())
    await vi.waitFor(() => expect(getState().pendingSideboardScreen).not.toBeNull())

    // El diálogo de fin de partida sigue visible; el sideboard queda retenido.
    expect(getState().gameEnd).not.toBeNull()
    expect(getState().sideboardScreen).toBeNull()

    // Al cerrar el diálogo, se promueve el sideboard retenido.
    clearGameEnd()
    expect(getState().gameEnd).toBeNull()
    expect(getState().sideboardScreen).not.toBeNull()
    expect(getState().pendingSideboardScreen).toBeNull()
  })

  it('muestra el SIDEBOARD directamente si no hay un fin de partida sin cerrar', async () => {
    handleSideboard({ deck: { name: 'Mi mazo', cards: {}, sideboard: {} }, currentTableId: 'table-1' }, getState())
    await vi.waitFor(() => expect(getState().sideboardScreen).not.toBeNull())
    expect(getState().pendingSideboardScreen).toBeNull()
  })
})
