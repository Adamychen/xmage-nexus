import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import RankingView from './RankingView'
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

describe('RankingView Component', () => {
  afterEach(() => {
    cleanup()
  })

  it('renders the rank guide with every tier and sorts the room by rating descending', () => {
    render(<RankingView users={mockUsers} currentUsername="player1" onInspectUser={vi.fn()} />)

    expect(screen.getByText('Bronce')).toBeDefined()
    expect(screen.getAllByText('Mítico').length).toBeGreaterThan(0)
    expect(screen.getByText(/Top Sala \(3\)/)).toBeDefined()

    const names = Array.from(document.querySelectorAll('.leaderboard-user-name')).map((el) => el.textContent?.replace('Tú', '').replace('You', '').trim())
    expect(names).toEqual(['mythic_player', 'player1', 'novice'])
    expect(document.querySelector('.pos-medal svg')).not.toBeNull()
  })

  it('highlights the tier of the current user in the guide', () => {
    render(<RankingView users={mockUsers} currentUsername="player1" onInspectUser={vi.fn()} />)

    const mine = document.querySelector('.rank-guide-tier.is-mine .rank-guide-name')
    expect(mine?.textContent).toBe('Diamante')
  })

  it('filters the room by search query', () => {
    render(<RankingView users={mockUsers} currentUsername="player1" onInspectUser={vi.fn()} />)

    fireEvent.change(screen.getByPlaceholderText(/Buscar jugador/i), { target: { value: 'mythic' } })

    expect(screen.getByText('mythic_player')).toBeDefined()
    expect(screen.queryByText('novice')).toBeNull()
  })

  it('opens the profile of the clicked player', () => {
    const onInspectUser = vi.fn()
    render(<RankingView users={mockUsers} currentUsername="player1" onInspectUser={onInspectUser} />)

    fireEvent.click(screen.getByText('novice'))
    expect(onInspectUser).toHaveBeenCalledWith('novice')
  })

  it('shows the no-results state when the search matches nobody', () => {
    render(<RankingView users={mockUsers} currentUsername="player1" onInspectUser={vi.fn()} />)

    fireEvent.change(screen.getByPlaceholderText(/Buscar jugador/i), { target: { value: 'zzz' } })
    expect(screen.getByText(/No se encontraron jugadores/i)).toBeDefined()
  })

  it('con historial de solo-conteo muestra Juego Limpio real (nunca W-L/winrate fabricados)', () => {
    const users: UsersView[] = [
      { ...mockUsers[0], userName: 'counter', matchHistory: '6 (Q:1)', matchQuitRatio: 17, infoGames: '' },
    ]
    render(<RankingView users={users} currentUsername="counter" onInspectUser={vi.fn()} />)

    expect(screen.getByText('6 (Q:1)')).toBeDefined()
    expect(screen.queryByText(/0-6/)).toBeNull()
    expect(screen.getByText('83%')).toBeDefined()
    expect(screen.getByTitle(/abandonos/i)).toBeDefined()
  })

  it('sin partidas registradas deja la columna en — con pista', () => {
    const users: UsersView[] = [{ ...mockUsers[0], userName: 'rookie', matchHistory: '0', matchQuitRatio: 0 }]
    render(<RankingView users={users} currentUsername="rookie" onInspectUser={vi.fn()} />)

    expect(screen.getByText('—')).toBeDefined()
    expect(screen.queryByText(/%$/)).toBeNull()
  })

  it('muestra En partida solo con tokens de juego reales', () => {
    const users: UsersView[] = [
      { ...mockUsers[0], userName: 'duelist', infoGames: 'Match: 1 ' },
      { ...mockUsers[2], userName: 'waiter', infoGames: 'Wait: 1 ' },
    ]
    render(<RankingView users={users} currentUsername="duelist" onInspectUser={vi.fn()} />)

    expect(screen.getAllByText(/En partida/i).length).toBeGreaterThan(0)
    expect(screen.getByText(/En el lobby/i)).toBeDefined()
  })

  it('ranks by the selected format: limited uses limitedRating, not constructed', () => {
    const users: UsersView[] = [
      { ...mockUsers[0], userName: 'alpha', constructedRating: 1900, limitedRating: 1500 },
      { ...mockUsers[0], userName: 'bravo', constructedRating: 1500, limitedRating: 1800 },
    ]
    render(<RankingView users={users} currentUsername="alpha" onInspectUser={vi.fn()} />)

    const order = () => Array.from(document.querySelectorAll('.leaderboard-user-name')).map((el) => el.textContent?.replace(/Tú|You/, '').trim())
    expect(order()).toEqual(['alpha', 'bravo'])

    fireEvent.click(screen.getByRole('tab', { name: /Limit/i }))
    expect(order()).toEqual(['bravo', 'alpha'])
    expect(document.querySelector('.rank-guide-tier.is-mine .rank-guide-name')?.textContent).toBe('Oro')
  })

  it('treats a missing rating as unrated, never as a fake 1500', () => {
    const users: UsersView[] = [
      { ...mockUsers[0], userName: 'rated', constructedRating: 1600, limitedRating: 0, generalRating: 0 },
      { ...mockUsers[0], userName: 'unrated', constructedRating: 0, limitedRating: 0, generalRating: 0 },
    ]
    render(<RankingView users={users} currentUsername="unrated" onInspectUser={vi.fn()} />)

    expect(document.querySelector('.rank-guide-tier.is-mine')).toBeNull()
    expect(screen.queryByText('1500')).toBeNull()

    fireEvent.click(screen.getByRole('tab', { name: /Limit/i }))
    expect(screen.queryByText('1500')).toBeNull()
    expect(document.querySelector('.rank-guide-tier.is-mine')).toBeNull()
    expect(document.querySelector('.pos-cell')?.textContent).toBe('—')
  })

  it('shows tourney history and tourney quit ratio when limited format is selected', () => {
    const users: UsersView[] = [
      {
        ...mockUsers[0],
        userName: 'drafter',
        matchHistory: '0',
        tourneyHistory: '157 (D:11)',
        matchQuitRatio: 0,
        tourneyQuitRatio: 7,
        constructedRating: 800,
        limitedRating: 1773,
      },
    ]
    render(<RankingView users={users} currentUsername="drafter" onInspectUser={vi.fn()} />)

    fireEvent.click(screen.getByRole('tab', { name: /Limit/i }))

    expect(screen.getByText('157 (D:11)')).toBeDefined()
    expect(screen.getByText('93%')).toBeDefined()
  })
})
