import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { handleStartTournament, handleTournamentOver, TOURNAMENT_JOIN_RETRY_DELAYS_MS } from './tournament'
import { getState, setState } from '../state'
import { reset } from '../gateway'
import { loadActiveDraft, saveActiveDraft } from '../persistence'
import * as cmds from '../../net/commands'

vi.mock('../../net/commands', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../net/commands')>()
  return {
    ...actual,
    joinTournament: vi.fn(),
    joinDraft: vi.fn(),
  }
})

const seated = (name: string) =>
  ({
    type: 'lobby',
    tables: [
      {
        tableId: 'table-1',
        tableName: 'Tournament',
        controllerName: 'player1',
        gameType: 'Booster Draft Elimination',
        deckType: 'Limited',
        tableState: 'STARTING',
        isTournament: true,
        seats: [{ playerName: name, playerType: 'HUMAN' }],
      },
    ],
  }) as never

describe('tournament session cleanup', () => {
  beforeEach(() => {
    vi.mocked(cmds.joinTournament).mockReset().mockResolvedValue({ ok: true } as never)
    setState({ error: null, lobby: null, conn: null, tournament: null } as never)
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('reset() cancels a pending panel-join retry so the next login never joins the old tournament', async () => {
    setState({ conn: { username: 'player1' }, lobby: null } as never)
    handleStartTournament('tournament-old', { currentTableId: 'table-1' })
    reset()
    setState({ conn: { username: 'player1' }, lobby: seated('player1') } as never)
    await vi.advanceTimersByTimeAsync(TOURNAMENT_JOIN_RETRY_DELAYS_MS[0] + 1000)
    expect(cmds.joinTournament).not.toHaveBeenCalled()
  })

  it('TOURNAMENT_OVER clears the tournament and the persisted tournament id', () => {
    setState({ tournament: { tournamentId: 'tournament-1', view: {} } } as never)
    saveActiveDraft({ draftId: 'draft-1', message: {} } as never, 'tournament-1')
    handleTournamentOver('fin')
    expect(getState().tournament).toBeNull()
    expect(loadActiveDraft()?.tournamentId ?? null).toBeNull()
  })
})
