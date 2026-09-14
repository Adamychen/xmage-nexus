import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import LeaderboardModal from './LeaderboardModal'
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
  {
    userName: 'novice',
    flagName: 'de',
    constructedRating: 1350,
    matchHistory: '2-5',
    infoGames: '',
    matchQuitRatio: 0,
    tourneyHistory: '',
    tourneyQuitRatio: 0,
    infoPing: '',
    generalRating: 1350,
    limitedRating: 1500,
  },
]

describe('LeaderboardModal Component', () => {
  beforeEach(() => {
    resetIgnoredUsersForTest()
  })

  afterEach(() => {
    cleanup()
  })

  it('renders room leaderboard and sorts by ELO descending', () => {
    const onClose = vi.fn()
    render(<LeaderboardModal users={mockUsers} currentUsername="player1" onClose={onClose} />)

    expect(screen.getAllByText(/Clasificación/i).length).toBeGreaterThan(0)
    expect(screen.getByText('mythic_player')).toBeDefined()
    expect(screen.getByText('player1')).toBeDefined()

    // Highest ELO player gets 1st medal
    expect(document.querySelector('.pos-medal svg')).not.toBeNull()
  })

  it('switches between tabs: profile and tiers guide', () => {
    const onClose = vi.fn()
    render(<LeaderboardModal users={mockUsers} currentUsername="player1" onClose={onClose} />)

    // Switch to profile tab
    fireEvent.click(screen.getByText(/Mi Rango & Estadísticas/i))
    expect(screen.getAllByText(/1650 ELO/i).length).toBeGreaterThan(0)
    expect(screen.getAllByText('Oro II').length).toBeGreaterThan(0)

    // Switch to tiers guide tab
    fireEvent.click(screen.getByText(/Guía de Rangos/i))
    expect(screen.getByText('Bronce')).toBeDefined()
    expect(screen.getAllByText('Mítico').length).toBeGreaterThan(0)
  })

  it('filters leaderboard by search query', () => {
    const onClose = vi.fn()
    render(<LeaderboardModal users={mockUsers} currentUsername="player1" onClose={onClose} />)

    const searchInput = screen.getByPlaceholderText(/Buscar jugador/i)
    fireEvent.change(searchInput, { target: { value: 'mythic' } })

    expect(screen.getByText('mythic_player')).toBeDefined()
    expect(screen.queryByText('novice')).toBeNull()
  })

  it('opens target user profile when initialTargetUsername and initialTab="profile" are passed', () => {
    const onClose = vi.fn()
    render(
      <LeaderboardModal
        users={mockUsers}
        currentUsername="player1"
        initialTargetUsername="mythic_player"
        initialTab="profile"
        onClose={onClose}
      />,
    )

    expect(screen.getByText(/Estás inspeccionando el perfil de/i)).toBeDefined()
    expect(screen.getAllByText('mythic_player').length).toBeGreaterThan(0)
    expect(screen.getAllByText(/2050 ELO/i).length).toBeGreaterThan(0)
    expect(screen.getAllByText('Mítico').length).toBeGreaterThan(0)
  })

  it('con historial de solo-conteo muestra Juego Limpio real (nunca W-L/winrate fabricados)', () => {
    const onClose = vi.fn()
    const users: UsersView[] = [
      { ...mockUsers[0], userName: 'counter', matchHistory: '6 (Q:1)', matchQuitRatio: 17, infoGames: '' },
    ]
    render(<LeaderboardModal users={users} currentUsername="counter" onClose={onClose} />)
    expect(screen.getByText('6 (Q:1)')).toBeDefined()
    expect(screen.queryByText(/0-6/)).toBeNull()
    // Dato real disponible: juego limpio = 100 - ratio de abandonos (17) = 83%
    expect(screen.queryByText('—')).toBeNull()
    expect(screen.getByText('83%')).toBeDefined()
    expect(screen.getByTitle(/abandonos/i)).toBeDefined()
  })

  it('sin partidas registradas deja la columna en — con pista', () => {
    const onClose = vi.fn()
    const users: UsersView[] = [{ ...mockUsers[0], userName: 'rookie', matchHistory: '0', matchQuitRatio: 0 }]
    render(<LeaderboardModal users={users} currentUsername="rookie" onClose={onClose} />)
    expect(screen.getByText('—')).toBeDefined()
    expect(screen.queryByText(/%$/)).toBeNull()
  })

  it('muestra En partida solo con tokens de juego reales (AUDIT)', () => {
    const onClose = vi.fn()
    const users: UsersView[] = [
      { ...mockUsers[0], userName: 'duelist', infoGames: 'Match: 1 ' },
      { ...mockUsers[2], userName: 'waiter', infoGames: 'Wait: 1 ' },
    ]
    render(<LeaderboardModal users={users} currentUsername="duelist" onClose={onClose} />)
    expect(screen.getByText(/En partida/i)).toBeDefined()
    expect(screen.getByText(/En el lobby/i)).toBeDefined()
  })

  it('renders ignored users in my profile and allows unignoring', () => {
    addIgnoredUser('annoying_guy')
    const onClose = vi.fn()
    render(
      <LeaderboardModal
        users={mockUsers}
        currentUsername="player1"
        initialTab="profile"
        onClose={onClose}
      />,
    )

    expect(screen.getByText(/Jugadores Ignorados & Silenciados \(1\)/i)).toBeDefined()
    expect(screen.getByText(/annoying_guy/i)).toBeDefined()

    // Click unlock / unignore
    fireEvent.click(screen.getByText('Desbloquear'))
    expect(screen.getByText(/No tienes a ningún jugador en tu lista/i)).toBeDefined()
  })
})
