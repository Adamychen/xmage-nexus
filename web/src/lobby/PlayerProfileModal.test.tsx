import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import PlayerProfileModal from './PlayerProfileModal'
import { addIgnoredUser, resetIgnoredUsersForTest } from './ignoreList'
import type { UsersView } from '../net/types'

const mockUsers: UsersView[] = [
  {
    userName: 'player1',
    flagName: 'es',
    constructedRating: 1650,
    matchHistory: '10-2',
    infoGames: '',
    matchQuitRatio: 0,
    tourneyHistory: '',
    tourneyQuitRatio: 0,
    infoPing: '',
    generalRating: 1650,
    limitedRating: 1500,
  },
  {
    userName: 'mythic_player',
    flagName: 'us',
    constructedRating: 2050,
    matchHistory: '25-1',
    infoGames: 'Game #1',
    matchQuitRatio: 0,
    tourneyHistory: '',
    tourneyQuitRatio: 0,
    infoPing: '',
    generalRating: 2050,
    limitedRating: 1500,
  },
]

describe('PlayerProfileModal Component', () => {
  beforeEach(() => {
    resetIgnoredUsersForTest()
  })

  afterEach(() => {
    cleanup()
  })

  it('shows the target player info with their rating and no rank guide', () => {
    const onClose = vi.fn()
    render(
      <PlayerProfileModal
        users={mockUsers}
        currentUsername="player1"
        targetUsername="mythic_player"
        onClose={onClose}
      />,
    )

    expect(screen.getByText(/Estás inspeccionando el perfil de/i)).toBeDefined()
    expect(screen.getAllByText('mythic_player').length).toBeGreaterThan(0)
    expect(screen.getAllByText(/2050/).length).toBeGreaterThan(0)
    expect(screen.getAllByText('Mítico').length).toBeGreaterThan(0)
    expect(screen.queryByText(/Guía de Rangos/i)).toBeNull()
  })

  it('shows the rank of each format with its icon badge', () => {
    const onClose = vi.fn()
    render(<PlayerProfileModal users={mockUsers} currentUsername="player1" onClose={onClose} />)

    const badges = Array.from(document.querySelectorAll('.format-card .rank-badge-name')).map((el) => el.textContent)
    // constructed 1650 = Diamante II, limited 1500 = Oro I
    expect(badges).toEqual(['Diamante II', 'Oro I'])
    expect(document.querySelectorAll('.format-card .rank-badge svg').length).toBe(2)
  })

  it('shows a dash and no rank for a format without a rating', () => {
    const onClose = vi.fn()
    const users: UsersView[] = [{ ...mockUsers[0], userName: 'fresh', constructedRating: 0, limitedRating: 0, generalRating: 0 }]
    render(<PlayerProfileModal users={users} currentUsername="fresh" onClose={onClose} />)

    expect(document.querySelectorAll('.format-card .rank-badge').length).toBe(0)
    expect(document.querySelectorAll('.format-card .format-elo')[0].textContent).toBe('—')
  })

  it('falls back to the current user when no target is given', () => {
    const onClose = vi.fn()
    render(<PlayerProfileModal users={mockUsers} currentUsername="player1" onClose={onClose} />)

    expect(screen.queryByText(/Estás inspeccionando/i)).toBeNull()
    expect(screen.getAllByText('player1').length).toBeGreaterThan(0)
    expect(screen.getAllByText(/1650/).length).toBeGreaterThan(0)
  })

  it('returns to the own profile from the inspect banner', () => {
    const onClose = vi.fn()
    render(
      <PlayerProfileModal
        users={mockUsers}
        currentUsername="player1"
        targetUsername="mythic_player"
        onClose={onClose}
      />,
    )

    fireEvent.click(screen.getByText(/Ver mi propio perfil/i))
    expect(screen.queryByText(/Estás inspeccionando/i)).toBeNull()
    expect(screen.getAllByText(/1650/).length).toBeGreaterThan(0)
  })

  it('con historial de solo-conteo muestra Juego Limpio real (nunca W-L/winrate fabricados)', () => {
    const onClose = vi.fn()
    const users: UsersView[] = [
      { ...mockUsers[0], userName: 'counter', matchHistory: '6 (Q:1)', matchQuitRatio: 17, infoGames: '' },
    ]
    render(<PlayerProfileModal users={users} currentUsername="counter" onClose={onClose} />)
    // Juego limpio = 100 - ratio de abandonos (17) = 83%
    expect(screen.getByText('83%')).toBeDefined()
    expect(screen.queryByText(/0-6/)).toBeNull()
    expect(screen.getByText('6')).toBeDefined()
  })

  it('renders ignored users in my profile and allows unignoring', () => {
    addIgnoredUser('annoying_guy')
    const onClose = vi.fn()
    render(<PlayerProfileModal users={mockUsers} currentUsername="player1" onClose={onClose} />)

    expect(screen.getByText(/Jugadores Ignorados & Silenciados \(1\)/i)).toBeDefined()
    expect(screen.getByText(/annoying_guy/i)).toBeDefined()

    fireEvent.click(screen.getByText('Desbloquear'))
    expect(screen.getByText(/No tienes a ningún jugador en tu lista/i)).toBeDefined()
  })

  it('does not show the ignore list on someone else profile', () => {
    addIgnoredUser('annoying_guy')
    const onClose = vi.fn()
    render(
      <PlayerProfileModal
        users={mockUsers}
        currentUsername="player1"
        targetUsername="mythic_player"
        onClose={onClose}
      />,
    )

    expect(screen.queryByText(/Jugadores Ignorados/i)).toBeNull()
  })
})
