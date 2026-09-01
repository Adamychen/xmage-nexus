import { describe, expect, it, beforeEach } from 'vitest'
import { handleMessage } from './eventHandler'
import { getState, setState } from './state'

beforeEach(() => {
  setState({ userRequest: null, viewer: null, error: null, game: null, gameId: null })
})

describe('eventHandler — callbacks críticos', () => {
  it('parsea USER_REQUEST_DIALOG en userRequest con sus botones', () => {
    handleMessage({
      type: 'event',
      method: 'USER_REQUEST_DIALOG',
      objectId: 'g1',
      data: {
        title: 'Confirmar acción',
        message: '¿Qué quieres hacer?',
        button1Text: 'Rebobinar turno',
        button1Action: 'ROLLBACK_TURN',
        button2Text: 'Detener al final del turno',
        button2Action: 'STOP_UNTIL_END_OF_TURN',
        gameId: 'g1',
      },
    } as never)
    const req = getState().userRequest
    expect(req).not.toBeNull()
    expect(req?.gameId).toBe('g1')
    expect(req?.buttons).toHaveLength(2)
    expect(req?.buttons[0]).toEqual({ text: 'Rebobinar turno', action: 'ROLLBACK_TURN' })
  })

  it('registra GAME_ERROR en el estado de error', () => {
    handleMessage({ type: 'event', method: 'GAME_ERROR', objectId: 'g1', data: { message: 'Mana pool vacío' } } as never)
    expect(getState().error).toBe('Mana pool vacío')
  })

  it('abre el visor con el sideboard del jugador desde el GameView', () => {
    setState({
      game: {
        players: [{ playerId: 'p1', sideboard: { 'c1': { id: 'c1', name: 'Forest' } } }],
      } as never,
    })
    handleMessage({ type: 'event', method: 'VIEW_SIDEBOARD', objectId: 'g1', data: { gameId: 'g1', playerId: 'p1' } } as never)
    expect(getState().viewer?.title).toBe('Sideboard')
    expect(getState().viewer?.cards).toHaveLength(1)
  })

  it('abre el visor de mazo limitado con las cartas del deck', () => {
    handleMessage({
      type: 'event',
      method: 'VIEW_LIMITED_DECK',
      objectId: 'g1',
      data: { deck: { cards: { 'c1': { id: 'c1', name: 'Island' } } } },
    } as never)
    expect(getState().viewer?.title).toBe('Mis Mazos')
    expect(getState().viewer?.cards).toHaveLength(1)
  })
})
