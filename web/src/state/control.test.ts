import { describe, expect, it } from 'vitest'
import { controlInfo, isControllingPriority } from './control'
import { makeGameView, makePlayer } from '../__fixtures__/gameViews'
import type { SimpleCardsView } from '../net/types'

const alice = () => makePlayer({ playerId: 'p1', name: 'Alice', controlled: true })
const bob = (over: Partial<ReturnType<typeof makePlayer>> = {}) =>
  makePlayer({ playerId: 'p2', name: 'Bob', ...over })

const bobsHand: Record<string, SimpleCardsView> = {
  Bob: { 'oh-1': { id: 'oh-1', name: 'Lightning Bolt' } },
}

describe('controlInfo', () => {
  it('sin opponentHands no hay control aunque la prioridad sea del rival', () => {
    const game = makeGameView({
      players: [alice(), bob({ hasPriority: true, isActive: true })],
      priorityPlayerName: 'Bob',
    })
    const info = controlInfo(game)
    expect(info.controlledNames.size).toBe(0)
    expect(info.priorityIsControlled).toBe(false)
    expect(isControllingPriority(game)).toBe(false)
    expect(info.actingName).toBe('Bob')
  })

  it('con mano controlada y prioridad en su nombre: controlamos la prioridad', () => {
    const game = makeGameView({
      players: [alice(), bob({ hasPriority: true, isActive: true })],
      opponentHands: bobsHand,
      priorityPlayerName: 'Bob',
      activePlayerName: 'Bob',
    })
    const info = controlInfo(game)
    expect([...info.controlledNames]).toEqual(['Bob'])
    expect(info.priorityIsControlled).toBe(true)
    expect(isControllingPriority(game)).toBe(true)
    expect(info.actingName).toBe('Bob')
  })

  it('mapea claves de opponentHands por playerId al nombre visible', () => {
    const game = makeGameView({
      players: [alice(), bob({ hasPriority: true, isActive: true })],
      opponentHands: { 'p2': bobsHand.Bob! },
      priorityPlayerName: 'Bob',
    })
    const info = controlInfo(game)
    expect([...info.controlledNames]).toEqual(['Bob'])
    expect(info.priorityIsControlled).toBe(true)
  })

  it('sigue detectando el control con la mano controlada vacía (clave presente)', () => {
    const game = makeGameView({
      players: [alice(), bob({ hasPriority: true, isActive: true })],
      opponentHands: { Bob: {} },
      priorityPlayerName: 'Bob',
    })
    const info = controlInfo(game)
    expect([...info.controlledNames]).toEqual(['Bob'])
    expect(info.priorityIsControlled).toBe(true)
  })

  it('cae a hasPriority del jugador controlado si priorityPlayerName viene vacío', () => {
    const game = makeGameView({
      players: [alice(), bob({ hasPriority: true, isActive: true })],
      opponentHands: bobsHand,
      priorityPlayerName: '',
    })
    expect(isControllingPriority(game)).toBe(true)
  })

  it('actingName cae al jugador activo cuando nadie tiene la prioridad', () => {
    const game = makeGameView({
      players: [alice(), bob({ isActive: true })],
      opponentHands: bobsHand,
      priorityPlayerName: '',
      activePlayerName: 'Bob',
    })
    const info = controlInfo(game)
    expect(info.priorityIsControlled).toBe(false)
    expect(info.actingName).toBe('Bob')
  })

  it('tolera game null', () => {
    expect(controlInfo(null)).toEqual({
      controlledNames: new Set(),
      priorityIsControlled: false,
      actingName: null,
    })
  })
})
