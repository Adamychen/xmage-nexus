import { describe, it, expect, afterEach, vi } from 'vitest'
import { render, screen, cleanup, fireEvent, waitFor } from '@testing-library/react'
import TournamentBracket from './TournamentBracket'
import ConfirmHost from '../ui/ConfirmHost'
import { setLanguage } from '../i18n'
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
    expect(screen.getByTestId('tournament-state').textContent).toBe('En partida')
  })

  it('traduce los estados del torneo y de cada partida', () => {
    render(<TournamentBracket view={sampleTournamentView()} />)
    expect(screen.getByTestId('tournament-state').textContent).toBe('En partida')
    const gameStates = screen.getAllByTestId('bracket-game-state').map((el) => el.textContent)
    expect(gameStates).toContain('Finalizada')
    expect(gameStates).toContain('En partida')
    expect(gameStates).toContain('Lista para empezar')
  })

  it('traduce el estado de cada jugador en la clasificación', () => {
    render(<TournamentBracket view={sampleTournamentView()} />)
    const states = screen.getAllByTestId('standings-state').map((el) => el.textContent)
    expect(states).toContain('En partida')
    expect(states).toContain('Eliminado')
  })

  it('conserva el sufijo del servidor (duración / Winner) al traducir el estado', () => {
    const view = sampleTournamentView({
      tournamentState: 'Finished',
      rounds: [{
        games: [{ roundNum: 1, state: 'Finished (0:00:01)', players: 'a vs b', result: '2-0' }] as TournamentGameView[],
      }],
      players: [{ name: 'alice', state: 'Finished (Winner)', points: 3, results: '2-0', history: 'W', quit: false }],
    })
    render(<TournamentBracket view={view} />)
    expect(screen.getByTestId('tournament-state').textContent).toBe('Finalizada')
    expect(screen.getByTestId('bracket-game-state').textContent).toBe('Finalizada (0:00:01)')
    expect(screen.getByTestId('standings-state').textContent).toBe('Finalizada (Winner)')
  })

  it('no duplica los encabezados de la clasificación en en y ru (sin .replace)', () => {
    const headersFor = (lang: 'en' | 'ru') => {
      setLanguage(lang)
      const { container, unmount } = render(<TournamentBracket view={sampleTournamentView()} />)
      const texts = Array.from(container.querySelectorAll('thead th')).map((el) => el.textContent ?? '')
      unmount()
      return texts
    }
    const en = headersFor('en')
    expect(new Set(en).size).toBe(en.length)
    expect(en).toContain('Results')
    expect(en).toContain('History')
    expect(en).toContain('Pts')
    const ru = headersFor('ru')
    expect(new Set(ru).size).toBe(ru.length)
    expect(ru).toContain('Результаты')
    expect(ru).toContain('История')
    setLanguage('es')
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

  it('asks for confirmation before quitting (T3)', async () => {
    const view = sampleTournamentView()
    const onQuit = vi.fn()
    render(<><TournamentBracket view={view} tournamentId="t-1" onQuit={onQuit} /><ConfirmHost /></>)
    fireEvent.click(screen.getByTestId('tournament-quit'))
    expect(await screen.findByTestId('confirm-modal')).not.toBeNull()
    expect(onQuit).not.toHaveBeenCalled()
    fireEvent.click(screen.getByTestId('confirm-modal-cancel'))
    await waitFor(() => expect(screen.queryByTestId('confirm-modal')).toBeNull())
    expect(onQuit).not.toHaveBeenCalled()
    fireEvent.click(screen.getByTestId('tournament-quit'))
    expect(await screen.findByTestId('confirm-modal')).not.toBeNull()
    fireEvent.click(screen.getByTestId('confirm-modal-ok'))
    await waitFor(() => expect(onQuit).toHaveBeenCalledWith('t-1'))
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

  it('muestra y oculta el chevron de scroll segun el desbordamiento a la derecha', async () => {
    const view = sampleTournamentView()
    render(<TournamentBracket view={view} />)
    const columns = screen.getByTestId('bracket-columns') as HTMLElement
    Object.defineProperty(columns, 'scrollWidth', { configurable: true, value: 1000 })
    Object.defineProperty(columns, 'clientWidth', { configurable: true, value: 300 })
    Object.defineProperty(columns, 'scrollLeft', { configurable: true, writable: true, value: 0 })
    const scrollBy = vi.fn()
    ;(columns as HTMLElement & { scrollBy: typeof scrollBy }).scrollBy = scrollBy

    fireEvent.scroll(columns)
    const chevron = screen.getByTestId('bracket-scroll-right')
    expect(chevron.getAttribute('aria-label')).toBe('Desplazar rondas')
    fireEvent.click(chevron)
    expect(scrollBy).toHaveBeenCalledWith({ left: 240, behavior: 'smooth' })

    ;(columns as HTMLElement & { scrollLeft: number }).scrollLeft = 700
    fireEvent.scroll(columns)
    await waitFor(() => expect(screen.queryByTestId('bracket-scroll-right')).toBeNull())

    ;(columns as HTMLElement & { scrollLeft: number }).scrollLeft = 0
    fireEvent.scroll(columns)
    await waitFor(() => expect(screen.queryByTestId('bracket-scroll-right')).not.toBeNull())
  })
})

describe('TournamentBracket — Abandonar torneo (id real vs mesa ajena)', () => {
  afterEach(() => cleanup())

  it('muestra Abandonar torneo cuando hay id real (participante)', () => {
    render(<TournamentBracket view={sampleTournamentView()} tournamentId="t-real" />)
    expect(screen.getByTestId('tournament-quit')).toBeDefined()
  })

  it('oculta Abandonar torneo en el torneo de otro (canQuit=false)', () => {
    render(<TournamentBracket view={sampleTournamentView()} tournamentId="t-real" canQuit={false} />)
    expect(screen.queryByTestId('tournament-quit')).toBeNull()
  })
})
