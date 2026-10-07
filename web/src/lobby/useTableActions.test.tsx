import { describe, expect, it, vi, beforeEach } from 'vitest'
import { act, renderHook } from '@testing-library/react'
import { useTableActions } from './useTableActions'
import * as cmds from '../net/commands'
import { getState } from '../state/state'
import { reset } from '../state/store'
import { setState } from '../state/state'
import { confirmDialog } from '../ui/confirmDialog'
import { t } from '../i18n'

vi.mock('../net/commands', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../net/commands')>()
  return {
    ...actual,
    joinTable: vi.fn(),
    joinTournamentTable: vi.fn(),
    startMatch: vi.fn(),
    startTournament: vi.fn(),
    watchTable: vi.fn(),
    removeTable: vi.fn(),
    joinGame: vi.fn(),
  }
})

vi.mock('../ui/confirmDialog', () => ({ confirmDialog: vi.fn() }))

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

describe('useTableActions.handleJoinWithDeck', () => {
  beforeEach(() => {
    reset()
  })

  it('rechaza con el error traducido (lo enseña el diálogo, no el lobby)', async () => {
    vi.mocked(cmds.joinTable).mockReset().mockResolvedValue({ ok: false, error: 'table full' } as any)
    const { result } = renderHook(() => useTableActions({ username: 'player1' } as any))
    const deck = { name: 'd', cards: [], sideboard: [] } as any
    await act(async () => {
      await expect(result.current.handleJoinWithDeck(matchTable(), deck)).rejects.toThrow(
        'La mesa ya está completa',
      )
    })
    expect(getState().error).toBeNull()
  })

  it('no rechaza cuando la unión va bien', async () => {
    vi.mocked(cmds.joinTable).mockReset().mockResolvedValue({ ok: true } as any)
    const { result } = renderHook(() => useTableActions({ username: 'player1' } as any))
    const deck = { name: 'd', cards: [], sideboard: [] } as any
    await act(async () => {
      await expect(result.current.handleJoinWithDeck(matchTable(), deck)).resolves.toBeUndefined()
    })
  })
})

describe('useTableActions.watchTable', () => {
  beforeEach(() => {
    reset()
    vi.mocked(cmds.watchTable).mockReset().mockResolvedValue({ ok: true } as any)
  })

  it('mesa de torneo: no entra al staging (el cuadro lo abre SHOW_TOURNAMENT)', async () => {
    const { result } = renderHook(() => useTableActions({ username: 'player1' } as any))
    await act(async () => {
      await result.current.watchTable(tourTable())
    })
    expect(cmds.watchTable).toHaveBeenCalledWith('t-tourney')
    expect(getState().watchingTable).toBeNull()
    expect(getState().phase).not.toBe('spectating_pending')
  })

  it('partida normal: sigue entrando al staging de espectador', async () => {
    const { result } = renderHook(() => useTableActions({ username: 'player1' } as any))
    await act(async () => {
      await result.current.watchTable(matchTable())
    })
    expect(getState().watchingTable?.tableId).toBe('t-match')
    expect(getState().phase).toBe('spectating_pending')
  })
})

describe('useTableActions.removeTable', () => {
  beforeEach(() => {
    reset()
    vi.mocked(cmds.removeTable).mockReset().mockResolvedValue({ ok: true } as any)
    vi.mocked(confirmDialog).mockReset().mockResolvedValue(true)
  })

  it('removes the table after confirmation and clears a matching staging seat', async () => {
    setState({ stagingTableId: 't-match' })
    const { result } = renderHook(() => useTableActions({ username: 'player1' } as any))
    await act(async () => {
      await result.current.removeTable(matchTable())
    })
    expect(confirmDialog).toHaveBeenCalledOnce()
    expect(cmds.removeTable).toHaveBeenCalledWith('t-match')
    expect(getState().stagingTableId).toBeNull()
    expect(getState().error).toBeFalsy()
  })

  it('does nothing when the confirmation is cancelled', async () => {
    vi.mocked(confirmDialog).mockResolvedValue(false)
    const { result } = renderHook(() => useTableActions({ username: 'player1' } as any))
    await act(async () => {
      await result.current.removeTable(matchTable())
    })
    expect(cmds.removeTable).not.toHaveBeenCalled()
  })

  it('surfaces a non-owner rejection instead of failing silently', async () => {
    vi.mocked(cmds.removeTable).mockResolvedValue({
      ok: false, errorCode: 'NOT_AUTHORIZED', error: 'Only the table owner can delete this table',
    } as any)
    const { result } = renderHook(() => useTableActions({ username: 'player1' } as any))
    await act(async () => {
      await result.current.removeTable(matchTable())
    })
    expect(getState().error).toBe(t('errors.remove_table_not_owner'))
  })
})

describe('useTableActions.joinHuman', () => {
  beforeEach(() => {
    reset()
    vi.mocked(cmds.joinTournamentTable).mockReset().mockResolvedValue({ ok: true } as any)
  })

  it('full table: error and no dialog', () => {
    const { result } = renderHook(() => useTableActions({ username: 'me' } as any))
    act(() => result.current.joinHuman(matchTable({ seats: [{ playerName: 'a', playerType: 'HUMAN' }] })))
    expect(getState().error).toBeTruthy()
    expect(result.current.joiningTable).toBeNull()
  })

  it('regular match: opens the deck dialog with the remembered password', () => {
    const { result } = renderHook(() => useTableActions({ username: 'me' } as any))
    act(() => result.current.joinHuman(matchTable(), 'secret'))
    expect(result.current.joiningTable?.tableId).toBe('t-match')
    expect(result.current.joinPassword).toBe('secret')
    expect(cmds.joinTournamentTable).not.toHaveBeenCalled()
  })

  it('limited tournament without password: joins directly, without a deck', async () => {
    const { result } = renderHook(() => useTableActions({ username: 'me' } as any))
    await act(async () => { result.current.joinHuman(draftTourTable()) })
    expect(cmds.joinTournamentTable).toHaveBeenCalledWith({ tableId: 't-draft', playerName: 'me', playerType: 'HUMAN', skill: 1 })
    expect(result.current.joiningTable).toBeNull()
    expect(result.current.notice).toBe(t('lobby.waiting_players'))
    expect(result.current.busyTable).toBeNull()
  })

  it('limited tournament with password: goes through the dialog', () => {
    const { result } = renderHook(() => useTableActions({ username: 'me' } as any))
    act(() => result.current.joinHuman(draftTourTable({ passworded: true })))
    expect(result.current.joiningTable?.tableId).toBe('t-draft')
    expect(cmds.joinTournamentTable).not.toHaveBeenCalled()
  })

  it('direct tournament join rejected or failed: shows the error and frees the table', async () => {
    vi.mocked(cmds.joinTournamentTable).mockResolvedValueOnce({ ok: false, error: 'table full' } as any)
    const { result } = renderHook(() => useTableActions({ username: 'me' } as any))
    await act(async () => { result.current.joinHuman(draftTourTable()) })
    expect(getState().error).toBe('La mesa ya está completa')
    expect(result.current.busyTable).toBeNull()

    vi.mocked(cmds.joinTournamentTable).mockRejectedValueOnce(new Error('ws closed'))
    await act(async () => { result.current.joinHuman(draftTourTable()) })
    expect(getState().error).toBeTruthy()
    expect(result.current.busyTable).toBeNull()
  })
})

describe('useTableActions.handleJoinWithDeck (sending)', () => {
  beforeEach(() => {
    reset()
    vi.mocked(cmds.joinTable).mockReset().mockResolvedValue({ ok: true } as any)
  })

  it('sends the XMage-prepared deck and closes the dialog', async () => {
    const { result } = renderHook(() => useTableActions({ username: 'me' } as any))
    act(() => result.current.joinHuman(matchTable(), 'pw'))
    const deck = { name: 'd', cards: [{ cardName: 'Forest', setCode: '', cardNumber: '', amount: 60 }], sideboard: [] } as any
    await act(async () => { await result.current.handleJoinWithDeck(matchTable(), deck, 'pw') })

    const sent = vi.mocked(cmds.joinTable).mock.calls[0][0]
    expect(sent).toMatchObject({ tableId: 't-match', playerName: 'me', playerType: 'HUMAN', password: 'pw', deckType: 'Constructed - Modern' })
    // Basic land without a printing: prepareDeckForXMage assigns a real one.
    expect(sent.deck!.cards[0].setCode).not.toBe('')
    expect(result.current.joiningTable).toBeNull()
    expect(result.current.joinPassword).toBeUndefined()
    expect(result.current.notice).toBe(t('lobby.waiting_players'))
  })

  it('a proxy exception also rejects with the translated message', async () => {
    vi.mocked(cmds.joinTable).mockRejectedValueOnce(new Error('ws closed'))
    const { result } = renderHook(() => useTableActions({ username: 'me' } as any))
    await act(async () => {
      await expect(result.current.handleJoinWithDeck(matchTable(), { name: 'd', cards: [], sideboard: [] } as any)).rejects.toThrow()
    })
    expect(result.current.busyTable).toBeNull()
  })
})

describe('useTableActions.joinAi (seats)', () => {
  beforeEach(() => {
    reset()
    vi.mocked(cmds.joinTable).mockReset().mockResolvedValue({ ok: true } as any)
  })

  it('names the second AI "Computer 2"', async () => {
    const table = matchTable({
      seats: [
        { playerName: 'me', playerType: 'HUMAN' },
        { playerName: 'Computer', playerType: 'COMPUTER_MAD' },
        { playerName: '', playerType: 'COMPUTER_MAD' },
      ],
    })
    const { result } = renderHook(() => useTableActions({ username: 'me' } as any))
    await act(async () => { await result.current.joinAi(table) })
    expect(cmds.joinTable).toHaveBeenCalledWith(expect.objectContaining({ playerName: 'Computer 2' }))
  })

  it('no free AI seat: error and nothing sent', async () => {
    const { result } = renderHook(() => useTableActions({ username: 'me' } as any))
    await act(async () => { await result.current.joinAi(matchTable({ seats: [{ playerName: '', playerType: 'HUMAN' }] })) })
    expect(cmds.joinTable).not.toHaveBeenCalled()
    expect(getState().error).toBeTruthy()
    expect(result.current.busyTable).toBeNull()
  })

  it('server rejection: shows the error', async () => {
    vi.mocked(cmds.joinTable).mockResolvedValueOnce({ ok: false, error: 'table full' } as any)
    const { result } = renderHook(() => useTableActions({ username: 'me' } as any))
    await act(async () => { await result.current.joinAi(matchTable()) })
    expect(getState().error).toBe('La mesa ya está completa')
    expect(result.current.busyTable).toBeNull()
  })
})

describe('useTableActions: start/watch/remove errors', () => {
  beforeEach(() => reset())

  it('startTable rejected or failed shows the error', async () => {
    vi.mocked(cmds.startMatch).mockReset().mockResolvedValueOnce({ ok: false } as any).mockRejectedValueOnce(new Error('ws closed'))
    const { result } = renderHook(() => useTableActions({ username: 'me' } as any))
    await act(async () => { await result.current.startTable(matchTable()) })
    expect(getState().error).toBeTruthy()
    setState({ error: null })
    await act(async () => { await result.current.startTable(matchTable()) })
    expect(getState().error).toBeTruthy()
    expect(result.current.busyTable).toBeNull()
  })

  it('watchTable rejected or failed does not enter staging', async () => {
    vi.mocked(cmds.watchTable).mockReset().mockResolvedValueOnce({ ok: false } as any).mockRejectedValueOnce(new Error('ws closed'))
    const { result } = renderHook(() => useTableActions({ username: 'me' } as any))
    await act(async () => { await result.current.watchTable(matchTable()) })
    expect(getState().error).toBeTruthy()
    expect(getState().watchingTable).toBeNull()
    setState({ error: null })
    await act(async () => { await result.current.watchTable(matchTable()) })
    expect(getState().error).toBeTruthy()
  })

  it('removeTable failure shows the error and leaves another table staging alone', async () => {
    vi.mocked(confirmDialog).mockReset().mockResolvedValue(true)
    vi.mocked(cmds.removeTable).mockReset().mockRejectedValueOnce(new Error('ws closed')).mockResolvedValueOnce({ ok: true } as any)
    setState({ stagingTableId: 'other' })
    const { result } = renderHook(() => useTableActions({ username: 'me' } as any))
    await act(async () => { await result.current.removeTable(matchTable()) })
    expect(getState().error).toBeTruthy()

    await act(async () => { await result.current.removeTable(matchTable()) })
    expect(getState().stagingTableId).toBe('other')
  })
})

describe('useTableActions.resumeGame', () => {
  beforeEach(() => {
    reset()
    vi.mocked(cmds.joinGame).mockReset().mockResolvedValue({ ok: true } as any)
  })

  it('rejoins the first game of the table', async () => {
    const { result } = renderHook(() => useTableActions({ username: 'me' } as any))
    await act(async () => { await result.current.resumeGame(matchTable({ games: ['g-1', 'g-2'] })) })
    expect(cmds.joinGame).toHaveBeenCalledWith('g-1')
    expect(getState().resumingGameId).toBe('g-1')
    expect(result.current.notice).toBe(t('lobby.active_table_resume'))
  })

  it('no game in progress: error without calling the server', async () => {
    const { result } = renderHook(() => useTableActions({ username: 'me' } as any))
    await act(async () => { await result.current.resumeGame(matchTable({ games: [] })) })
    expect(cmds.joinGame).not.toHaveBeenCalled()
    expect(getState().error).toBeTruthy()
  })

  it('on failure it stops marking the game as resuming', async () => {
    vi.mocked(cmds.joinGame).mockResolvedValueOnce({ ok: false, error: 'game not found' } as any).mockRejectedValueOnce(new Error('ws closed'))
    const { result } = renderHook(() => useTableActions({ username: 'me' } as any))
    await act(async () => { await result.current.resumeGame(matchTable({ games: ['g-1'] })) })
    expect(getState().resumingGameId).toBeNull()
    expect(getState().error).toBeTruthy()

    await act(async () => { await result.current.resumeGame(matchTable({ games: ['g-1'] })) })
    expect(getState().resumingGameId).toBeNull()
    expect(result.current.busyTable).toBeNull()
  })
})
