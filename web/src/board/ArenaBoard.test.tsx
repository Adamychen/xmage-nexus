import { cleanup, render } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import ArenaBoard from './ArenaBoard'
import { makeCard, makeGameView, makePlayer } from '../__fixtures__/gameViews'
import type { CardView, GameView } from '../net/types'

describe('ArenaBoard', () => {
  afterEach(() => cleanup())

  function makeCommander(id: string, name: string): CardView {
    return {
      id,
      name,
      manaValue: 3,
      expansionSetCode: 'TEST',
      cardNumber: '1',
      mageObjectType: 'COMMANDER',
    } as unknown as CardView
  }

  function multiplayerGame(overrides?: Partial<GameView>): GameView {
    return makeGameView({
      players: [
        makePlayer({
          playerId: 'p1',
          name: 'Alice',
          controlled: true,
          isActive: true,
          hasPriority: true,
          life: 40,
          commandList: [makeCommander('cmd-alice', 'Atraxa, Praetors Voice')],
        }),
        makePlayer({ playerId: 'p2', name: 'Bob', life: 40, commandList: [makeCommander('cmd-bob', 'Urza')] }),
        makePlayer({ playerId: 'p3', name: 'Carol', life: 40, commandList: [makeCommander('cmd-carol', 'Edgar Markov')] }),
      ],
      activePlayerId: 'p1',
      activePlayerName: 'Alice',
      turn: 3,
      ...overrides,
    })
  }

  it('renders one compact opponent column per rival and my full-width zone below', () => {
    const game = multiplayerGame()
    const { container, getByTestId } = render(<ArenaBoard game={game} />)
    expect(getByTestId('arena-board')).not.toBeNull()
    const cells = container.querySelectorAll('.arena-opp-cell')
    expect(cells.length).toBe(2)
    // rivales compactos, orientados como zona superior (estado arriba,
    // criaturas pegadas al divisor — formato espejo correcto)
    const oppZones = container.querySelectorAll('.arena-opp-cell .board-zone')
    expect(oppZones.length).toBe(2)
    oppZones.forEach((z) => {
      expect(z.classList.contains('compact-pod')).toBe(true)
      expect(z.classList.contains('zone-top')).toBe(true)
      expect(z.classList.contains('opponent-zone')).toBe(true)
    })
    // mi zona: player-zone a ancho completo, sin compactar, fuera de celdas
    const myZone = container.querySelector('.arena-board > .player-zone')
    expect(myZone).not.toBeNull()
    expect(myZone!.classList.contains('compact-pod')).toBe(false)
    expect(myZone!.classList.contains('mirrored')).toBe(false)
  })

  it('caps the opponent row at 3 rivals (Commander de 4 jugadores)', () => {
    const game = multiplayerGame({
      players: [
        makePlayer({ playerId: 'p1', name: 'Alice', controlled: true, commandList: [] }),
        makePlayer({ playerId: 'p2', name: 'Bob', commandList: [] }),
        makePlayer({ playerId: 'p3', name: 'Carol', commandList: [] }),
        makePlayer({ playerId: 'p4', name: 'Dave', commandList: [] }),
        makePlayer({ playerId: 'p5', name: 'Eve', commandList: [] }),
      ],
    })
    const { container } = render(<ArenaBoard game={game} />)
    expect(container.querySelectorAll('.arena-opp-cell').length).toBe(3)
  })

  it('renders my hand in the overlay hand-bar (not in my zone)', () => {
    const game = multiplayerGame({
      myPlayerId: 'p1',
      myHand: {
        'h-1': makeCard({ id: 'h-1', name: 'Lightning Bolt', parentId: 'h-1' }),
        'h-2': makeCard({ id: 'h-2', name: 'Counterspell', parentId: 'h-2' }),
      },
    })
    const { container, getByTestId } = render(<ArenaBoard game={game} />)
    const bar = getByTestId('hand-bar')
    expect(bar.querySelectorAll('.hand-card-slot').length).toBe(2)
    expect(bar.parentElement?.classList.contains('arena-board')).toBe(true)
    expect(container.querySelector('.player-zone .hand-card-slot')).toBeNull()
  })

  it('keeps opponent mini-hands inside their columns', () => {
    const game = multiplayerGame({
      myPlayerId: 'p1',
      opponentHands: {
        Bob: { 'oh-1': { id: 'oh-1' } },
        Carol: { 'oh-2': { id: 'oh-2' } },
      },
    })
    const bob = game.players![1] as unknown as Record<string, unknown>
    bob['handCount'] = 1
    const carol = game.players![2] as unknown as Record<string, unknown>
    carol['handCount'] = 1
    const { container } = render(<ArenaBoard game={game} />)
    expect(container.querySelectorAll('.arena-opp-cell .hand-card-slot').length).toBe(2)
    expect(container.querySelectorAll('.board-zone .hand-zone.compact').length).toBe(2)
  })

  it('spectator: rivales arriba (hasta 3) y un jugador abajo, como los otros modos', () => {
    const game = makeGameView({
      activePlayerId: 'p2',
      players: [
        makePlayer({ playerId: 'p1', name: 'Alice', controlled: false, commandList: [] }),
        makePlayer({ playerId: 'p2', name: 'Bob', controlled: false, commandList: [] }),
        makePlayer({ playerId: 'p3', name: 'Carol', controlled: false, commandList: [] }),
        makePlayer({ playerId: 'p4', name: 'Dave', controlled: false, commandList: [] }),
      ],
    })
    const { container } = render(<ArenaBoard game={game} />)
    expect(container.querySelectorAll('.arena-opp-cell').length).toBe(3)
    const bottom = container.querySelector('.arena-board > .player-zone')
    expect(bottom).not.toBeNull()
    expect(container.querySelector('[data-testid="hand-bar"]')).toBeNull()
  })
})
