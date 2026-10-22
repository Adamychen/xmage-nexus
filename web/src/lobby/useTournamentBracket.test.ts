// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useTournamentBracket } from './useTournamentBracket'
import { reset } from '../state/store'
import { setState } from '../state/state'
import { getTournament, watchTournamentTable } from '../net/commands'

vi.mock('../net/commands', () => ({
  getTournament: vi.fn(),
  watchTournamentTable: vi.fn(),
}))

const table = { tableId: 'table-1', tableName: 'My Tourney', isTournament: true, seats: [] } as never
const ownGames = [{ roundNum: 1, state: 'Dueling', players: 'me', tableId: 'table-1' }]

function ownTournament(extra: Record<string, unknown> = {}) {
  return {
    tournamentId: 't-9',
    view: { tournamentName: 'My Tourney', rounds: [{ games: ownGames }], ...extra },
  }
}

beforeEach(() => {
  reset()
  vi.clearAllMocks()
  vi.mocked(watchTournamentTable).mockResolvedValue({ ok: true } as never)
})

afterEach(() => {
  vi.useRealTimers()
})

describe('useTournamentBracket — tournament id resolution', () => {
  it('openBracket queries by tournamentId when the table is a match of our tournament', async () => {
    vi.mocked(getTournament).mockResolvedValue({ tournamentName: 'My Tourney', rounds: [] } as never)
    setState({ tournament: ownTournament() } as never)
    const { result } = renderHook(() => useTournamentBracket())
    await act(async () => {
      await result.current.openBracket(table)
    })
    expect(getTournament).toHaveBeenCalledWith('t-9')
    expect(result.current.canQuit).toBe(true)
  })

  it('openBracket without a resolved id (foreign tournament) does not query with the tableId: it asks for the watch and waits for the resolution', async () => {
    const foreign = { tableId: 'table-2', tableName: 'Otra Copa' } as never
    const { result } = renderHook(() => useTournamentBracket())
    await act(async () => {
      await result.current.openBracket(foreign)
    })
    expect(watchTournamentTable).toHaveBeenCalledWith('table-2')
    expect(getTournament).not.toHaveBeenCalled()
    expect(result.current.bracketLoading).toBe(false)
    expect(result.current.bracketError).toBeNull()
    expect(result.current.bracketTournamentId).toBeNull()
    expect(result.current.canQuit).toBe(false)
  })

  it('openBracket with an explicit tournamentId (SHOW_TOURNAMENT) queries the foreign tournament with that id', async () => {
    vi.mocked(getTournament).mockResolvedValue({ tournamentName: 'Otra Copa', rounds: [] } as never)
    const foreign = { tableId: 'table-2', tableName: 'Otra Copa' } as never
    const { result } = renderHook(() => useTournamentBracket())
    await act(async () => {
      await result.current.openBracket(foreign, 't-real')
    })
    expect(getTournament).toHaveBeenCalledWith('t-real')
    expect(result.current.bracketTournamentId).toBe('t-real')
    expect(result.current.bracketView).toEqual({ tournamentName: 'Otra Copa', rounds: [] })
  })

  it('refreshBracket reuses the tournamentId resolved on open', async () => {
    vi.mocked(getTournament).mockResolvedValue({ tournamentName: 'My Tourney' } as never)
    setState({ tournament: ownTournament() } as never)
    const { result } = renderHook(() => useTournamentBracket())
    await act(async () => {
      await result.current.openBracket(table)
    })
    vi.mocked(getTournament).mockClear()
    vi.mocked(getTournament).mockResolvedValue({ tournamentName: 'My Tourney', rounds: [1] } as never)
    await act(async () => {
      await result.current.refreshBracket()
    })
    expect(getTournament).toHaveBeenCalledWith('t-9')
  })

  it('openBracket of a foreign table does not paint our cached tournament', async () => {
    vi.mocked(getTournament).mockResolvedValue(null as never)
    setState({ tournament: ownTournament() } as never)
    const foreign = { tableId: 'table-2', tableName: 'Otra Copa' } as never
    const { result } = renderHook(() => useTournamentBracket())
    await act(async () => {
      await result.current.openBracket(foreign, 't-real')
    })
    expect(getTournament).toHaveBeenCalledWith('t-real')
    expect(result.current.bracketView).toBeNull()
    expect(result.current.bracketError).toContain('t-real')
  })

  it('refreshBracket of a foreign table uses the resolved id (not the tableId)', async () => {
    vi.mocked(getTournament).mockResolvedValue({ tournamentName: 'Otra Copa' } as never)
    const foreign = { tableId: 'table-2', tableName: 'Otra Copa' } as never
    const { result } = renderHook(() => useTournamentBracket())
    await act(async () => {
      await result.current.openBracket(foreign, 't-real')
    })
    vi.mocked(getTournament).mockClear()
    await act(async () => {
      await result.current.refreshBracket()
    })
    expect(getTournament).toHaveBeenCalledWith('t-real')
  })

  it('a foreign tournament with the same name is not ours: no Quit, queried with its own id', async () => {
    vi.mocked(getTournament).mockResolvedValue({ tournamentName: 'My Tourney', rounds: [] } as never)
    setState({ tournament: ownTournament() } as never)
    const sameName = { tableId: 'table-7', tableName: 'My Tourney', isTournament: true, seats: [] } as never
    const { result } = renderHook(() => useTournamentBracket())
    await act(async () => {
      await result.current.openBracket(sameName, 't-foreign')
    })
    expect(getTournament).toHaveBeenCalledWith('t-foreign')
    expect(getTournament).not.toHaveBeenCalledWith('t-9')
    expect(result.current.canQuit).toBe(false)
  })

  it('a foreign same-name tournament without a resolved id is not taken for ours', async () => {
    setState({ tournament: ownTournament() } as never)
    const sameName = { tableId: 'table-7', tableName: 'My Tourney', isTournament: true, seats: [] } as never
    const { result } = renderHook(() => useTournamentBracket())
    await act(async () => {
      await result.current.openBracket(sameName)
    })
    expect(getTournament).not.toHaveBeenCalled()
    expect(result.current.bracketView).toBeNull()
    expect(result.current.canQuit).toBe(false)
  })

  it('an unresolved table of our tournament is watched once, then opened and quittable with the SHOW_TOURNAMENT id', async () => {
    vi.mocked(getTournament).mockResolvedValue(ownTournament().view as never)
    setState({ tournament: ownTournament() } as never)
    const notSeated = { tableId: 'table-tournament-1', tableName: 'My Tourney', isTournament: true, seats: [] } as never
    const { result, rerender } = renderHook(() => useTournamentBracket())
    await act(async () => {
      await result.current.openBracket(notSeated)
    })
    expect(watchTournamentTable).toHaveBeenCalledTimes(1)
    expect(getTournament).not.toHaveBeenCalled()
    await act(async () => {
      await result.current.openBracket(notSeated, 't-9')
    })
    rerender()
    expect(getTournament).toHaveBeenCalledWith('t-9')
    expect(result.current.canQuit).toBe(true)
  })

  it('the periodic refresh only calls getTournament and does not re-watch the table', async () => {
    vi.useFakeTimers()
    vi.mocked(getTournament).mockResolvedValue({ tournamentName: 'My Tourney', rounds: [] } as never)
    setState({ tournament: ownTournament() } as never)
    const { result } = renderHook(() => useTournamentBracket())
    await act(async () => {
      await result.current.openBracket(table)
    })
    expect(watchTournamentTable).toHaveBeenCalledTimes(1)
    for (let i = 0; i < 3; i++) {
      await act(async () => {
        await vi.advanceTimersByTimeAsync(8000)
      })
    }
    expect(watchTournamentTable).toHaveBeenCalledTimes(1)
    expect(getTournament).toHaveBeenCalledTimes(4)
  })

  it('the periodic refresh uses the current tournament state, not the one captured on open', async () => {
    vi.useFakeTimers()
    vi.mocked(getTournament).mockResolvedValueOnce({ tournamentName: 'My Tourney', rounds: [] } as never)
    setState({ tournament: ownTournament() } as never)
    const { result } = renderHook(() => useTournamentBracket())
    await act(async () => {
      await result.current.openBracket(table)
    })
    const fresh = { tournamentName: 'My Tourney', tournamentState: 'Running', rounds: [{ games: ownGames }] }
    act(() => {
      setState({ tournament: { tournamentId: 't-9', view: fresh } } as never)
    })
    vi.mocked(getTournament).mockRejectedValue(new Error('offline'))
    await act(async () => {
      await vi.advanceTimersByTimeAsync(8000)
    })
    expect(result.current.bracketView).toEqual(fresh)
  })
})
