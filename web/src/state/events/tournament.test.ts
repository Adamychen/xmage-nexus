import { describe, expect, it, vi, beforeEach } from 'vitest'
import { handleStartTournament } from './tournament'
import { handleStartDraft } from './draft'
import { getState, setState } from '../state'
import * as cmds from '../../net/commands'

vi.mock('../../net/commands', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../net/commands')>()
  return {
    ...actual,
    joinTournament: vi.fn(),
    joinDraft: vi.fn(),
  }
})

const tableSeated = (seats: Array<{ playerName?: string; playerType?: string }>) =>
  ({
    type: 'lobby',
    tables: [
      {
        tableId: 'table-draft-1',
        tableName: 'Draft Night',
        controllerName: 'player1',
        gameType: 'Booster Draft Elimination',
        deckType: 'Limited',
        tableState: 'STARTING',
        isTournament: true,
        seats,
      },
    ],
  }) as never

describe('handleStartTournament — auto panel-join', () => {
  beforeEach(() => {
    vi.mocked(cmds.joinTournament).mockReset().mockResolvedValue({ ok: true } as never)
    setState({ error: null, lobby: null, conn: null } as never)
  })

  it('une al panel si estoy sentado como humano en la mesa arrancada', async () => {
    setState({
      conn: { username: 'player1' },
      lobby: tableSeated([
        { playerName: 'player1', playerType: 'HUMAN' },
        { playerName: 'Computer', playerType: 'COMPUTER_DRAFT_BOT' },
      ]),
    } as never)
    handleStartTournament('tournament-1', { currentTableId: 'table-draft-1' })
    await Promise.resolve()
    expect(cmds.joinTournament).toHaveBeenCalledOnce()
    expect(cmds.joinTournament).toHaveBeenCalledWith('tournament-1')
    expect(getState().error).toBeNull()
  })

  it('no une si no estoy sentado en esa mesa', () => {
    setState({
      conn: { username: 'intruso' },
      lobby: tableSeated([
        { playerName: 'player1', playerType: 'HUMAN' },
        { playerName: 'Computer', playerType: 'COMPUTER_DRAFT_BOT' },
      ]),
    } as never)
    handleStartTournament('tournament-1', { currentTableId: 'table-draft-1' })
    expect(cmds.joinTournament).not.toHaveBeenCalled()
  })

  it('no une sin tournamentId y muestra error si el join falla', async () => {
    setState({
      conn: { username: 'player1' },
      lobby: tableSeated([{ playerName: 'player1', playerType: 'HUMAN' }]),
    } as never)
    handleStartTournament(null, { currentTableId: 'table-draft-1' })
    expect(cmds.joinTournament).not.toHaveBeenCalled()

    vi.mocked(cmds.joinTournament).mockResolvedValueOnce({ ok: false, error: 'Command failed' } as never)
    handleStartTournament('tournament-1', { currentTableId: 'table-draft-1' })
    await new Promise((r) => setTimeout(r, 0))
    expect(getState().error).not.toBeNull()
  })
})

describe('handleStartDraft — auto joinDraft', () => {
  beforeEach(() => {
    vi.mocked(cmds.joinDraft).mockReset().mockResolvedValue({ ok: true } as never)
    setState({ error: null, lobby: null, conn: null } as never)
  })

  it('une al draft si estoy sentado como humano', async () => {
    setState({
      conn: { username: 'player1' },
      lobby: tableSeated([
        { playerName: 'player1', playerType: 'HUMAN' },
        { playerName: 'Computer', playerType: 'COMPUTER_DRAFT_BOT' },
      ]),
    } as never)
    handleStartDraft('draft-1', { currentTableId: 'table-draft-1' })
    await Promise.resolve()
    expect(cmds.joinDraft).toHaveBeenCalledOnce()
    expect(cmds.joinDraft).toHaveBeenCalledWith('draft-1')
    expect(getState().error).toBeNull()
  })

  it('no une sin draftId, ni si no estoy sentado, y avisa si falla', async () => {
    setState({
      conn: { username: 'player1' },
      lobby: tableSeated([{ playerName: 'player1', playerType: 'HUMAN' }]),
    } as never)
    handleStartDraft(null, { currentTableId: 'table-draft-1' })
    expect(cmds.joinDraft).not.toHaveBeenCalled()

    setState({ conn: { username: 'intruso' } } as never)
    handleStartDraft('draft-1', { currentTableId: 'table-draft-1' })
    expect(cmds.joinDraft).not.toHaveBeenCalled()

    setState({
      conn: { username: 'player1' },
      lobby: tableSeated([{ playerName: 'player1', playerType: 'HUMAN' }]),
    } as never)
    vi.mocked(cmds.joinDraft).mockResolvedValueOnce({ ok: false } as never)
    handleStartDraft('draft-1', { currentTableId: 'table-draft-1' })
    await new Promise((r) => setTimeout(r, 0))
    expect(getState().error).not.toBeNull()
  })
})

describe('watchdog post-DRAFT_OVER — limpieza', () => {
  it('handleStartTournament limpia marcas viejas', async () => {
    const { handleStartTournament } = await import('./tournament')
    setState({ draftOverAt: 456, conn: { username: 'player1' }, lobby: null } as never)
    await handleStartTournament('t1', null)
    expect(getState().draftOverAt).toBeNull()
  })

  it('handleTournamentOver limpia marcas viejas', async () => {
    const { handleTournamentOver } = await import('./tournament')
    setState({ draftOverAt: 789 } as never)
    await handleTournamentOver('fin')
    expect(getState().draftOverAt).toBeNull()
  })
})
