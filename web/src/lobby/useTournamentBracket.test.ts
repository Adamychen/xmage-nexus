// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useTournamentBracket } from './useTournamentBracket'
import { reset } from '../state/store'
import { setState } from '../state/state'
import { getTournament, watchTournamentTable } from '../net/commands'

vi.mock('../net/commands', () => ({
  getTournament: vi.fn(),
  watchTournamentTable: vi.fn(),
}))

const table = { tableId: 'table-1', tableName: 'My Tourney' } as never

beforeEach(() => {
  reset()
  vi.clearAllMocks()
  vi.mocked(watchTournamentTable).mockResolvedValue({ ok: true } as never)
})

describe('useTournamentBracket — resolución del id de torneo', () => {
  it('openBracket consulta por tournamentId cuando el torneo unido coincide', async () => {
    vi.mocked(getTournament).mockResolvedValue({ tournamentName: 'My Tourney', rounds: [] } as never)
    setState({ tournament: { tournamentId: 't-9', view: { tournamentName: 'My Tourney', rounds: [] } } } as never)
    const { result } = renderHook(() => useTournamentBracket())
    await act(async () => {
      await result.current.openBracket(table)
    })
    expect(getTournament).toHaveBeenCalledWith('t-9')
    expect(result.current.canQuit).toBe(true)
  })

  it('openBracket sin id resuelto (torneo ajeno) no consulta con el tableId: pide el watch y espera la resolución', async () => {
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

  it('openBracket con tournamentId explícito (SHOW_TOURNAMENT) consulta el torneo ajeno con ese id', async () => {
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

  it('refreshBracket reutiliza el tournamentId resuelto al abrir', async () => {
    vi.mocked(getTournament).mockResolvedValue({ tournamentName: 'My Tourney' } as never)
    setState({ tournament: { tournamentId: 't-9', view: { tournamentName: 'My Tourney' } } } as never)
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

  it('openBracket de una mesa ajena no pinta el torneo propio cacheado', async () => {
    vi.mocked(getTournament).mockResolvedValue(null as never)
    setState({ tournament: { tournamentId: 't-9', view: { tournamentName: 'My Tourney', rounds: [] } } } as never)
    const foreign = { tableId: 'table-2', tableName: 'Otra Copa' } as never
    const { result } = renderHook(() => useTournamentBracket())
    await act(async () => {
      await result.current.openBracket(foreign, 't-real')
    })
    expect(getTournament).toHaveBeenCalledWith('t-real')
    expect(result.current.bracketView).toBeNull()
    expect(result.current.bracketError).toContain('t-real')
  })

  it('refreshBracket de una mesa ajena usa el id resuelto (no el tableId)', async () => {
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
})
