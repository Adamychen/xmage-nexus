import { describe, expect, it, vi, beforeEach } from 'vitest'
import { act, renderHook } from '@testing-library/react'
import { useTableActions } from './useTableActions'
import * as cmds from '../net/commands'

vi.mock('../net/commands', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../net/commands')>()
  return {
    ...actual,
    joinTable: vi.fn(),
    joinTournamentTable: vi.fn(),
    startMatch: vi.fn(),
    startTournament: vi.fn(),
  }
})

const tourTable = (over: Record<string, unknown> = {}) => ({
  tableId: 't-tourney',
  tableName: 't',
  controllerName: 'player1',
  gameType: 'Constructed Elimination',
  deckType: 'Constructed - Modern',
  tableState: 'WAITING',
  isTournament: true,
  seats: [
    { playerName: 'player1', playerType: 'HUMAN' },
    { playerName: '', playerType: 'COMPUTER_MAD' },
  ],
  ...over,
}) as any

const draftTourTable = (over: Record<string, unknown> = {}) => ({
  tableId: 't-draft',
  tableName: 'd',
  controllerName: 'player1',
  gameType: 'Booster Draft Elimination',
  deckType: 'Limited',
  tableState: 'WAITING',
  isTournament: true,
  seats: [
    { playerName: 'player1', playerType: 'HUMAN' },
    { playerName: '', playerType: 'COMPUTER_DRAFT_BOT' },
  ],
  ...over,
}) as any

const matchTable = (over: Record<string, unknown> = {}) => ({
  tableId: 't-match',
  tableName: 'm',
  controllerName: 'player1',
  gameType: 'Two Player Duel',
  deckType: 'Constructed - Modern',
  tableState: 'WAITING',
  isTournament: false,
  seats: [
    { playerName: 'player1', playerType: 'HUMAN' },
    { playerName: '', playerType: 'COMPUTER_MAD' },
  ],
  ...over,
}) as any

describe('useTableActions.joinAi', () => {
  beforeEach(() => {
    vi.mocked(cmds.joinTable).mockReset().mockResolvedValue({ ok: true } as any)
    vi.mocked(cmds.joinTournamentTable).mockReset().mockResolvedValue({ ok: true } as any)
    vi.mocked(cmds.startMatch).mockReset().mockResolvedValue({ ok: true } as any)
    vi.mocked(cmds.startTournament).mockReset().mockResolvedValue({ ok: true } as any)
  })

  it('usa joinTournamentTable en mesas de torneo (evita el NPE Table.getMatch)', async () => {
    const { result } = renderHook(() => useTableActions({ username: 'player1' } as any))
    await act(async () => {
      await result.current.joinAi(tourTable())
    })
    expect(cmds.joinTournamentTable).toHaveBeenCalledOnce()
    expect(cmds.joinTournamentTable).toHaveBeenCalledWith(
      expect.objectContaining({ tableId: 't-tourney', playerType: 'COMPUTER_MAD' }),
    )
    expect(cmds.joinTable).not.toHaveBeenCalled()
  })

  it('adjunta mazo en torneos construidos', async () => {
    const { result } = renderHook(() => useTableActions({ username: 'player1' } as any))
    await act(async () => {
      await result.current.joinAi(tourTable())
    })
    const sent = vi.mocked(cmds.joinTournamentTable).mock.calls[0][0] as Record<string, unknown>
    expect(sent.deck).toBeDefined()
    expect(sent.deckType).toBe('Constructed - Modern')
  })

  it('une deckless en torneos draft (el servidor ignora/rechaza mazos construidos)', async () => {
    const { result } = renderHook(() => useTableActions({ username: 'player1' } as any))
    await act(async () => {
      await result.current.joinAi(draftTourTable())
    })
    expect(cmds.joinTournamentTable).toHaveBeenCalledOnce()
    const sent = vi.mocked(cmds.joinTournamentTable).mock.calls[0][0] as Record<string, unknown>
    expect(sent.tableId).toBe('t-draft')
    expect(sent.playerType).toBe('COMPUTER_DRAFT_BOT')
    expect(sent.deck).toBeUndefined()
    expect(sent.deckType).toBeUndefined()
    expect(sent.gameType).toBeUndefined()
  })

  it('sigue usando joinTable en partidas normales', async () => {
    const { result } = renderHook(() => useTableActions({ username: 'player1' } as any))
    await act(async () => {
      await result.current.joinAi(matchTable())
    })
    expect(cmds.joinTable).toHaveBeenCalledOnce()
    expect(cmds.joinTable).toHaveBeenCalledWith(
      expect.objectContaining({ tableId: 't-match', playerType: 'COMPUTER_MAD' }),
    )
    expect(cmds.joinTournamentTable).not.toHaveBeenCalled()
  })
})

describe('useTableActions.startTable', () => {
  beforeEach(() => {
    vi.mocked(cmds.startMatch).mockReset().mockResolvedValue({ ok: true } as any)
    vi.mocked(cmds.startTournament).mockReset().mockResolvedValue({ ok: true } as any)
  })

  it('usa startTournament en mesas de torneo (startMatch las calza en STARTING)', async () => {
    const { result } = renderHook(() => useTableActions({ username: 'player1' } as any))
    await act(async () => {
      await result.current.startTable(tourTable())
    })
    expect(cmds.startTournament).toHaveBeenCalledOnce()
    expect(cmds.startTournament).toHaveBeenCalledWith('t-tourney')
    expect(cmds.startMatch).not.toHaveBeenCalled()
  })

  it('sigue usando startMatch en partidas normales', async () => {
    const { result } = renderHook(() => useTableActions({ username: 'player1' } as any))
    await act(async () => {
      await result.current.startTable(matchTable())
    })
    expect(cmds.startMatch).toHaveBeenCalledOnce()
    expect(cmds.startMatch).toHaveBeenCalledWith('t-match')
    expect(cmds.startTournament).not.toHaveBeenCalled()
  })
})
