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
  })

  it('openBracket usa el tableId si no hay torneo unido coincidente', async () => {
    vi.mocked(getTournament).mockResolvedValue(null as never)
    const { result } = renderHook(() => useTournamentBracket())
    await act(async () => {
      await result.current.openBracket(table)
    })
    expect(getTournament).toHaveBeenCalledWith('table-1')
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
})
