import { beforeEach, describe, expect, it, vi } from 'vitest'
import { makeGameView, makePlayer } from '../__fixtures__/gameViews'
import { getState, setState } from './state'
import { concedeGame, returnToLobby, reset } from './store'
import * as cmds from '../net/commands'

vi.mock('../net/commands', () => ({
  setGateway: vi.fn(),
  getGateway: vi.fn(),
  quitMatch: vi.fn(),
  stopWatching: vi.fn(),
  leaveChat: vi.fn(),
  sendPlayerAction: vi.fn().mockResolvedValue({ ok: true }),
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

  it('envía PlayerAction.CONCEDE y vuelve al lobby', async () => {
    await concedeGame('game-1')

    expect(cmds.sendPlayerAction).toHaveBeenCalledWith('CONCEDE', 'game-1')
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
})
