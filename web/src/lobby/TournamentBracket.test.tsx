import { describe, it, expect, afterEach, vi } from 'vitest'
import { render, screen, cleanup, fireEvent } from '@testing-library/react'
import TournamentBracket from './TournamentBracket'
import type { TournamentView, TournamentPlayerView, RoundView, TournamentGameView } from '../net/types'

function sampleTournamentView(overrides: Partial<TournamentView> = {}): TournamentView {
  const now = Date.now()
  const players: TournamentPlayerView[] = [
    { name: 'alice', state: 'Dueling', points: 6, results: '2-0', history: 'W-W', flagName: 'es', quit: false },
    { name: 'bob', state: 'Dueling', points: 3, results: '1-1', history: 'W-L', flagName: 'us', quit: false },
    { name: 'charlie', state: 'Eliminated', points: 0, results: '0-2', history: 'L-L', flagName: 'de', quit: true },
    { name: 'diana', state: 'Dueling', points: 3, results: '1-1', history: 'L-W', flagName: 'fr', quit: false },
  ]
  const rounds: RoundView[] = [
    {
      games: [
        { roundNum: 1, state: 'Finished', players: 'alice vs bob', result: '2-0', tableId: 'table-g1', matchId: 'match-1', gameId: 'game-1' },
        { roundNum: 1, state: 'Finished', players: 'charlie vs diana', result: '0-2', tableId: 'table-g2', matchId: 'match-2', gameId: 'game-2' },
      ] as TournamentGameView[],
    },
    {
      games: [
        { roundNum: 2, state: 'Dueling', players: 'alice vs diana', result: '', tableId: 'table-g3', matchId: 'match-3', gameId: 'game-3' },
        { roundNum: 2, state: 'Ready', players: 'bob vs charlie', result: '', tableId: 'table-g4', matchId: 'match-4', gameId: 'game-4' },
      ] as TournamentGameView[],
    },
  ]
  return {
    tournamentName: 'Commander Clash',
    tournamentType: 'Swiss',
    tournamentState: 'Dueling',
    startTime: now - 3600_000,
    endTime: null,
    stepStartTime: now - 120_000,
    serverTime: now,
    constructionTime: 600,
    watchingAllowed: true,
    rounds,
    players,
    runningInfo: 'Ronda 2 en curso — 2 mesas activas',
    ...overrides,
  }
}

describe('TournamentBracket', () => {
  afterEach(() => cleanup())

  it('renders name/type/state', () => {
    const view = sampleTournamentView()
    render(<TournamentBracket view={view} tournamentId="t-1" />)
    expect(screen.getByTestId('tournament-name').textContent).toBe('Commander Clash')
    expect(screen.getByTestId('tournament-type').textContent).toBe('Swiss')
    expect(screen.getByTestId('tournament-state').textContent).toBe('Dueling')
  })

  it('renders rounds as bracket columns with games', () => {
    const view = sampleTournamentView()
    render(<TournamentBracket view={view} />)
    const rounds = screen.getAllByTestId('bracket-round')
    expect(rounds.length).toBe(2)
    const games = screen.getAllByTestId('bracket-game')
    expect(games.length).toBe(4)
    expect(screen.getByText('alice vs bob')).toBeDefined()
    expect(screen.getByText('Ronda 1')).toBeDefined()
    expect(screen.getByText('Ronda 2')).toBeDefined()
  })

  it('renders players sorted by points and shows standings', () => {
    const view = sampleTournamentView()
    render(<TournamentBracket view={view} />)
    const rows = screen.getAllByTestId('standings-row')
    expect(rows.length).toBe(4)
    const names = screen.getAllByTestId('standings-name').map((el) => el.textContent)
    expect(names[0]).toContain('alice')
    const points = screen.getAllByTestId('standings-points').map((el) => Number(el.textContent))
    expect(points[0]).toBe(6)
    for (let i = 1; i < points.length; i++) {
      expect(points[i - 1] >= points[i]).toBe(true)
    }
  })

  it('shows quit state for players who quit', () => {
    const view = sampleTournamentView()
    render(<TournamentBracket view={view} />)
    const quitBadges = screen.getAllByTestId('standings-quit')
    expect(quitBadges.length).toBe(1)
    expect(quitBadges[0].textContent).toBe('Abandonó')
    const rows = screen.getAllByTestId('standings-row')
    const quitRow = rows.find((r) => r.getAttribute('data-quit') === 'true')
    expect(quitRow).toBeDefined()
    expect(quitRow?.textContent).toContain('charlie')
  })

  it('shows timer when serverTime and stepStartTime present', () => {
    const view = sampleTournamentView({ serverTime: Date.now(), stepStartTime: Date.now() - 65000 })
    render(<TournamentBracket view={view} />)
    const timer = screen.getByTestId('tournament-timer')
    expect(timer.textContent).toMatch(/1:/)
  })

  it('shows runningInfo and watchingAllowed', () => {
    const view = sampleTournamentView()
    render(<TournamentBracket view={view} />)
    expect(screen.getByTestId('tournament-running-info').textContent).toContain('Ronda 2')
    expect(screen.getByTestId('tournament-watching').textContent).toContain('Espectadores')
  })

  it('handles generic tournament up to 8 players', () => {
    const manyPlayers = Array.from({ length: 8 }, (_, i) => ({
      name: `player${i + 1}`,
      state: 'Dueling',
      points: 8 - i,
      results: `${8 - i} pts`,
      history: 'W',
      quit: false,
    }))
    const view = sampleTournamentView({ players: manyPlayers, rounds: [] })
    render(<TournamentBracket view={view} />)
    expect(screen.getAllByTestId('standings-row').length).toBe(8)
    expect(screen.getByTestId('tournament-no-rounds')).toBeDefined()
  })

  it('respects commander max 4 players context', () => {
    const view = sampleTournamentView()
    expect(view.players.length).toBe(4)
    render(<TournamentBracket view={view} />)
    expect(screen.getAllByTestId('standings-row').length).toBe(4)
  })

  it('calls onWatchMatch with the match tableId when clicking the eye (T1)', () => {
    const view = sampleTournamentView()
    const onWatchMatch = vi.fn()
    render(<TournamentBracket view={view} onWatchMatch={onWatchMatch} />)
    const btns = screen.getAllByTestId('bracket-watch')
    expect(btns.length).toBe(4)
    fireEvent.click(btns[2])
    expect(onWatchMatch).toHaveBeenCalledWith('table-g3')
  })

  it('disables the eye of the match being watched (T1)', () => {
    const view = sampleTournamentView()
    render(<TournamentBracket view={view} onWatchMatch={() => {}} watchingMatchId="table-g3" />)
    const btns = screen.getAllByTestId('bracket-watch')
    const watching = btns.find((b) => b.getAttribute('data-table') === 'table-g3')
    expect(watching).toBeDefined()
    expect((watching as HTMLElement).hasAttribute('disabled')).toBe(true)
    expect(btns.filter((b) => !(b as HTMLElement).hasAttribute('disabled')).length).toBe(3)
  })

  it('renders a plain eye without handler as fallback (T1)', () => {
    const view = sampleTournamentView()
    render(<TournamentBracket view={view} />)
    expect(screen.queryByTestId('bracket-watch')).toBeNull()
  })

  it('hides the eye when watching is not allowed (T1)', () => {
    const view = sampleTournamentView({ watchingAllowed: false })
    const onWatchMatch = vi.fn()
    render(<TournamentBracket view={view} onWatchMatch={onWatchMatch} />)
    expect(screen.queryByTestId('bracket-watch')).toBeNull()
  })

  it('asks for confirmation before quitting (T3)', () => {
    const view = sampleTournamentView()
    const onQuit = vi.fn()
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false)
    try {
      render(<TournamentBracket view={view} tournamentId="t-1" onQuit={onQuit} />)
      fireEvent.click(screen.getByTestId('tournament-quit'))
      expect(confirmSpy).toHaveBeenCalled()
      expect(onQuit).not.toHaveBeenCalled()
      confirmSpy.mockReturnValue(true)
      fireEvent.click(screen.getByTestId('tournament-quit'))
      expect(onQuit).toHaveBeenCalledWith('t-1')
    } finally {
      confirmSpy.mockRestore()
    }
  })

  it('shows start date when present (T3)', () => {
    const view = sampleTournamentView()
    render(<TournamentBracket view={view} />)
    const dates = screen.getByTestId('tournament-dates')
    expect(dates.textContent!.length).toBeGreaterThan(0)
  })

  it('counts down construction time while constructing, static otherwise (T3)', () => {
    const now = Date.now()
    const constructing = sampleTournamentView({
      tournamentState: 'Constructing',
      constructionTime: 600,
      stepStartTime: now - 120_000,
      serverTime: now,
    })
    const { unmount } = render(<TournamentBracket view={constructing} />)
    expect(screen.getByTestId('tournament-construction').textContent).toContain('8:00')
    unmount()
    cleanup()
    const dueling = sampleTournamentView({ tournamentState: 'Dueling' })
    render(<TournamentBracket view={dueling} />)
    expect(screen.getByTestId('tournament-construction').textContent).toContain('10m')
  })
})
