import { cleanup, fireEvent, render } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import MechanicsTray from './MechanicsTray'
import { setState, sniffDungeonEntry } from '../state/store'
import { getState } from '../state/state'
import type { GameView, PlayerView } from '../net/types'

vi.mock('../cards/cardImages', () => ({
  awaitImageUrl: vi.fn().mockResolvedValue('https://cards.scryfall.io/test-token.jpg'),
  cardKey: vi.fn().mockReturnValue('named:Test'),
}))

describe('MechanicsTray', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    setState({ game: null })
  })

  afterEach(() => {
    cleanup()
  })

  it('renders empty glossary state when no global mechanics are active', () => {
    setState({
      game: {
        players: [
          { playerId: 'p1', name: 'Alice', controlled: true, life: 20 } as unknown as PlayerView,
        ],
      } as unknown as GameView,
    })

    const { getByText } = render(<MechanicsTray />)
    expect(getByText('No hay mecánicas globales activas en esta partida.')).toBeDefined()
    expect(getByText(/El Anillo te tienta/)).toBeDefined()
  })

  it('renders The Ring tab with level breakdown and Ring-bearer', () => {
    setState({
      game: {
        players: [
          {
            playerId: 'p1',
            name: 'Frodo',
            controlled: true,
            life: 20,
            commandList: [
              {
                id: 'ring-1',
                name: 'The Ring',
                rules: ['Rule 1 (Legendary)', 'Rule 2 (Loot)'],
              },
            ],
            battlefield: {
              perm1: {
                id: 'perm1',
                name: 'Samwise Gamgee',
                isRingBearer: true,
              },
            },
          } as unknown as PlayerView,
        ],
      } as unknown as GameView,
    })

    const { getByText, container } = render(<MechanicsTray />)
    expect(getByText('💍 El Anillo te tienta')).toBeDefined()
    expect(getByText('Nivel 2 / 4')).toBeDefined()
    expect(getByText(/Samwise Gamgee/)).toBeDefined()

    const unlockedCards = container.querySelectorAll('.ring-level-card.unlocked')
    const lockedCards = container.querySelectorAll('.ring-level-card.locked')
    expect(unlockedCards.length).toBe(2)
    expect(lockedCards.length).toBe(2)
  })

  it('renders Active Dungeon tab with room progression', () => {
    setState({
      game: {
        players: [
          {
            playerId: 'p1',
            name: 'Dungeon Master',
            controlled: true,
            commandList: [
              {
                id: 'dung-1',
                name: 'Undercity',
                cardTypes: ['Dungeon'],
                currentRoom: 'Secret Entrance',
              },
            ],
          } as unknown as PlayerView,
        ],
      } as unknown as GameView,
    })

    const { getByText, container } = render(<MechanicsTray />)
    expect(getByText('🗺️ Undercity')).toBeDefined()
    expect(container.querySelector('.dungeon-room-node.active-room')).toBeDefined()
  })

  it('renders the Tomb diamond with both branches (no collapsed single path)', () => {
    setState({
      gameId: 'g-tomb',
      dungeonProgress: {},
      game: {
        players: [
          {
            playerId: 'p1',
            name: 'Dungeon Master',
            controlled: true,
            commandList: [{ id: 'dung-1', name: 'Tomb of Annihilation', cardTypes: ['Dungeon'] }],
          } as unknown as PlayerView,
        ],
      } as unknown as GameView,
    })

    const { container } = render(<MechanicsTray />)
    const nodes = [...container.querySelectorAll('.dungeon-room-node')]
    expect(nodes).toHaveLength(5)
    const labels = nodes.map((n) => n.querySelector('.room-name')?.textContent ?? '')
    expect(labels.some((t) => t.includes('Oubliette'))).toBe(true)
    expect(labels.filter((t) => t.length > 0).length).toBe(5)
    const forkRows = container.querySelectorAll('.dungeon-depth-row.is-fork')
    expect(forkRows.length).toBeGreaterThan(0)
    expect(container.querySelector('.dungeon-room-node.active-room')).toBeDefined()
  })

  it('tracks opponent rooms from server "has entered" broadcasts', () => {
    setState({ gameId: 'g-opp', dungeonProgress: {} })
    sniffDungeonEntry('Rival has entered Sandfall Cell (dungeon: Tomb of Annihilation)', 'g-opp')
    expect(getState().dungeonProgress['g-opp‖rival‖tomb']).toEqual(['Sandfall Cell'])
    sniffDungeonEntry('Rival draws a card.', 'g-opp')
    expect(getState().dungeonProgress['g-opp‖rival‖tomb']).toEqual(['Sandfall Cell'])
  })

  it('moves the marker along the tracked venture path', () => {
    setState({
      gameId: 'g-tomb',
      dungeonProgress: { 'g-tomb‖dungeon master‖tomb': ['Trapped Entry', 'Oubliette'] },
      game: {
        players: [
          {
            playerId: 'p1',
            name: 'Dungeon Master',
            controlled: true,
            commandList: [{ id: 'dung-1', name: 'Tomb of Annihilation', cardTypes: ['Dungeon'] }],
          } as unknown as PlayerView,
        ],
      } as unknown as GameView,
    })

    const { container } = render(<MechanicsTray />)
    const active = container.querySelector('.dungeon-room-node.active-room .room-name')
    expect(active?.textContent).toContain('Oubliette')
    expect(container.querySelectorAll('.dungeon-room-node.visited-room').length).toBeGreaterThan(0)
  })

  it('renders Day and Night banner with transition rules', () => {
    setState({
      game: {
        players: [
          {
            playerId: 'p1',
            name: 'Werewolf Player',
            controlled: true,
            designationNames: ['Night'],
          } as unknown as PlayerView,
        ],
      } as unknown as GameView,
    })

    const { getAllByText } = render(<MechanicsTray />)
    expect(getAllByText('Es de NOCHE').length).toBeGreaterThan(0)
    expect(getAllByText(/Prioridad — Responde|Pila — Último/i).length).toBeGreaterThan(0)
  })

  it('renders Monarch tab with rules explanation and current holder', () => {
    setState({
      game: {
        players: [
          {
            playerId: 'p1',
            name: 'Queen Marchesa',
            controlled: true,
            monarch: true,
          } as unknown as PlayerView,
        ],
      } as unknown as GameView,
    })

    const { getAllByText, getByText, container } = render(<MechanicsTray />)
    expect(container.querySelector('.panel-monarch h3')?.textContent).toBe('El Monarca')
    expect(getByText(/Queen Marchesa/)).toBeDefined()
    expect(getAllByText(/Al comienzo de tu paso final, roba una carta/).length).toBeGreaterThan(0)
  })

  it('allows switching tabs when multiple mechanics are active', () => {
    setState({
      game: {
        players: [
          {
            playerId: 'p1',
            name: 'Aragorn',
            controlled: true,
            monarch: true,
            commandList: [{ id: 'ring-1', name: 'The Ring', rules: ['R1'] }],
          } as unknown as PlayerView,
        ],
      } as unknown as GameView,
    })

    const { getByText, container } = render(<MechanicsTray />)
    const monarchTabBtn = container.querySelector('.mechanic-tab-btn:nth-child(2)')
    expect(monarchTabBtn).toBeDefined()

    if (monarchTabBtn) {
      fireEvent.click(monarchTabBtn)
      expect(container.querySelector('.panel-monarch h3')?.textContent).toBe('El Monarca')
      expect(getByText(/Aragorn/)).toBeDefined()
    }
  })
})
