import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, renderHook, waitFor } from '@testing-library/react'
import * as cmds from '../../net/commands'
import { requestDeckValidation } from '../DeckIssuesDialog'
import { useCreateTableForm } from './useCreateTableForm'

vi.mock('../../net/commands', () => ({
  getGameTypes: vi.fn(),
  getDeckTypes: vi.fn(),
  getPlayerTypes: vi.fn(),
  getTournamentTypes: vi.fn(),
  getDraftCubes: vi.fn(),
  getExpansionsWithBoosters: vi.fn(),
  createTable: vi.fn(),
  createTournamentTable: vi.fn(),
  joinTable: vi.fn(),
  joinTournamentTable: vi.fn(),
  startMatch: vi.fn(),
  watchTable: vi.fn(),
  removeTable: vi.fn(),
}))

// The real issues dialog waits for the user; here it resolves at once.
vi.mock('../DeckIssuesDialog', () => ({ requestDeckValidation: vi.fn() }))

const ls = new Map<string, string>()

beforeEach(() => {
  ls.clear()
  vi.stubGlobal('localStorage', {
    getItem: (k: string) => ls.get(k) ?? null,
    setItem: (k: string, v: string) => { ls.set(k, v) },
    removeItem: (k: string) => { ls.delete(k) },
  })
  vi.mocked(cmds.getGameTypes).mockReset().mockResolvedValue([
    { name: 'Two Player Duel', minPlayers: 2, maxPlayers: 2 },
    { name: 'Free For All', minPlayers: 3, maxPlayers: 10 },
    { name: 'Commander Free For All', minPlayers: 3, maxPlayers: 10 },
  ])
  vi.mocked(cmds.getDeckTypes).mockReset().mockResolvedValue(['Constructed - Modern', 'Variant Magic - Commander', 'Limited'])
  vi.mocked(cmds.getPlayerTypes).mockReset().mockResolvedValue(['COMPUTER_MAD', 'COMPUTER_DRAFT_BOT'])
  vi.mocked(cmds.getTournamentTypes).mockReset().mockResolvedValue(['Constructed Swiss', 'Constructed Elimination', 'Booster Draft Elimination'])
  vi.mocked(cmds.getDraftCubes).mockReset().mockResolvedValue([])
  vi.mocked(cmds.getExpansionsWithBoosters).mockReset().mockResolvedValue([])
  vi.mocked(cmds.createTable).mockReset().mockResolvedValue({ ok: true, data: { tableId: 'tbl' } } as any)
  vi.mocked(cmds.createTournamentTable).mockReset().mockResolvedValue({ ok: true, data: { tableId: 'tour' } } as any)
  vi.mocked(cmds.joinTable).mockReset().mockResolvedValue({ ok: true } as any)
  vi.mocked(cmds.joinTournamentTable).mockReset().mockResolvedValue({ ok: true } as any)
  vi.mocked(cmds.startMatch).mockReset().mockResolvedValue({ ok: true } as any)
  vi.mocked(cmds.watchTable).mockReset().mockResolvedValue({ ok: true } as any)
  vi.mocked(cmds.removeTable).mockReset().mockResolvedValue({ ok: true } as any)
  vi.mocked(requestDeckValidation).mockReset().mockImplementation(async (deck) => deck)
})

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

async function mount() {
  const onClose = vi.fn()
  const hook = renderHook(() => useCreateTableForm(onClose))
  await waitFor(() => expect(cmds.getTournamentTypes).toHaveBeenCalled())
  await act(async () => {})
  return { ...hook, onClose, form: () => hook.result.current }
}

/** Constructed tournament with N native AI seats (COMPUTER_MAD) besides the human. */
async function constructedTourneyWithBots(bots: number) {
  const m = await mount()
  act(() => m.form().setTableCategory('tourney'))
  act(() => m.form().setTournamentCategory('constructed'))
  act(() => m.form().setNumPlayers(bots + 1))
  act(() => m.form().applySeatTypeToAll('COMPUTER_MAD'))
  expect(m.form().isConstructedTournament).toBe(true)
  expect(m.form().seatConfigs.map((s) => s.type)).toEqual(Array(bots).fill('COMPUTER_MAD'))
  return m
}

describe('table category', () => {
  it('multiplayer picks a game type for more than 2 and keeps a compatible format', async () => {
    const m = await mount()
    act(() => m.form().setTableCategory('multi'))
    expect(m.form().gameType).toBe('Free For All')
    expect(m.form().deckType).toBe('Constructed - Modern')
    expect(m.form().numPlayers).toBe(4)

    act(() => m.form().setTableCategory('duel'))
    expect(m.form().gameType).toBe('Two Player Duel')
    expect(m.form().numPlayers).toBe(2)
  })

  it('a constructed tournament leaves Limited and uses a constructed tournament type', async () => {
    const m = await mount()
    act(() => m.form().setTableCategory('tourney'))
    act(() => m.form().setTournamentCategory('limited'))
    expect(m.form().deckType).toBe('Limited')
    expect(m.form().useDraftTournament).toBe(true)

    act(() => m.form().setTournamentCategory('constructed'))
    expect(m.form().deckType).toBe('Constructed - Modern')
    expect(m.form().useDraftTournament).toBe(false)
    expect(m.form().tournamentType).toBe('Constructed Swiss')
  })

  it('the draft checkbox inside a tournament switches the subcategory', async () => {
    const m = await mount()
    act(() => m.form().setTableCategory('tourney'))
    act(() => m.form().setUseDraftTournament(false))
    expect(m.form().tournamentCategory).toBe('constructed')
    act(() => m.form().setUseDraftTournament(true))
    expect(m.form().tournamentCategory).toBe('limited')
  })

  it('setSeatSkill clamps the skill to 1-10', async () => {
    const m = await mount()
    act(() => m.form().setNumPlayers(2))
    act(() => m.form().setSeatSkill(0, 42))
    expect(m.form().seatConfigs[0].skill).toBe(10)
    act(() => m.form().setSeatSkill(0, -3))
    expect(m.form().seatConfigs[0].skill).toBe(1)
  })
})

describe('submit: constructed tournament with native AI', () => {
  it('joins every bot with a checked deck and then the human', async () => {
    const m = await constructedTourneyWithBots(2)
    await act(() => m.form().submit())

    expect(cmds.createTournamentTable).toHaveBeenCalledOnce()
    const joins = vi.mocked(cmds.joinTournamentTable).mock.calls.map(([a]) => a)
    expect(joins.map((a) => [a.playerName, a.playerType])).toEqual([
      ['Computer 1', 'COMPUTER_MAD'],
      ['Computer 2', 'COMPUTER_MAD'],
      ['player', 'HUMAN'],
    ])
    for (const a of joins) {
      expect(a).toMatchObject({ tableId: 'tour', deckType: 'Constructed - Modern' })
      expect(a.deck).toBeDefined()
    }
    // human + one deck per bot
    expect(requestDeckValidation).toHaveBeenCalledTimes(3)
    expect(m.onClose).toHaveBeenCalled()
    expect(cmds.removeTable).not.toHaveBeenCalled()
  })

  it('a single bot is called "Computer"', async () => {
    const m = await constructedTourneyWithBots(1)
    await act(() => m.form().submit())
    expect(vi.mocked(cmds.joinTournamentTable).mock.calls[0][0].playerName).toBe('Computer')
  })

  it('if a bot cannot join, the just-created table is removed', async () => {
    const m = await constructedTourneyWithBots(2)
    vi.mocked(cmds.joinTournamentTable).mockResolvedValueOnce({ ok: false, error: 'boom' } as any)
    await act(() => m.form().submit())

    expect(cmds.removeTable).toHaveBeenCalledWith('tour')
    expect(cmds.joinTournamentTable).toHaveBeenCalledOnce()
    expect(m.form().error).toBeTruthy()
    expect(m.onClose).not.toHaveBeenCalled()
  })

  it('cancelling the deck check of a bot removes the table', async () => {
    const m = await constructedTourneyWithBots(1)
    vi.mocked(requestDeckValidation)
      .mockImplementationOnce(async (deck) => deck) // human
      .mockResolvedValueOnce(null) // bot
    await act(() => m.form().submit())

    expect(cmds.removeTable).toHaveBeenCalledWith('tour')
    expect(cmds.joinTournamentTable).not.toHaveBeenCalled()
    expect(m.onClose).not.toHaveBeenCalled()
  })

  it('if the human cannot join, the table is removed', async () => {
    const m = await constructedTourneyWithBots(1)
    vi.mocked(cmds.joinTournamentTable)
      .mockResolvedValueOnce({ ok: true } as any)
      .mockResolvedValueOnce({ ok: false, error: 'boom' } as any)
    await act(() => m.form().submit())

    expect(cmds.removeTable).toHaveBeenCalledWith('tour')
    expect(m.onClose).not.toHaveBeenCalled()
  })

  it('cancelling the human deck check creates nothing', async () => {
    const m = await constructedTourneyWithBots(1)
    vi.mocked(requestDeckValidation).mockResolvedValueOnce(null)
    await act(() => m.form().submit())

    expect(cmds.createTournamentTable).not.toHaveBeenCalled()
    expect(m.form().busy).toBe(false)
  })

  it('shows the error when the server rejects the tournament', async () => {
    const m = await constructedTourneyWithBots(1)
    vi.mocked(cmds.createTournamentTable).mockResolvedValueOnce({ ok: false, error: 'nope' } as any)
    await act(() => m.form().submit())

    expect(m.form().error).toBe('nope')
    expect(cmds.joinTournamentTable).not.toHaveBeenCalled()
    expect(m.onClose).not.toHaveBeenCalled()
  })
})

describe('submit: match with native AI', () => {
  async function duelVsBot() {
    const m = await mount()
    act(() => m.form().setNumPlayers(2))
    act(() => m.form().applySeatTypeToAll('COMPUTER_MAD'))
    return m
  }

  it('creates the table and joins the bot with its checked deck', async () => {
    const m = await duelVsBot()
    await act(() => m.form().submit())

    expect(cmds.createTable).toHaveBeenCalledOnce()
    expect(cmds.joinTable).toHaveBeenCalledWith(expect.objectContaining({ tableId: 'tbl', playerName: 'Computer', playerType: 'COMPUTER_MAD' }))
    expect(m.onClose).toHaveBeenCalled()
  })

  it('cancelling the bot deck check does not create the table', async () => {
    const m = await duelVsBot()
    vi.mocked(requestDeckValidation)
      .mockImplementationOnce(async (deck) => deck)
      .mockResolvedValueOnce(null)
    await act(() => m.form().submit())

    expect(cmds.createTable).not.toHaveBeenCalled()
    expect(m.form().busy).toBe(false)
  })

  it('shows the error when the server rejects the table', async () => {
    const m = await duelVsBot()
    vi.mocked(cmds.createTable).mockResolvedValueOnce({ ok: false, error: 'nope' } as any)
    await act(() => m.form().submit())
    expect(m.form().error).toBe('nope')
    expect(cmds.joinTable).not.toHaveBeenCalled()
  })
})

describe('runDemoTable', () => {
  it('creates a SIM vs SIM table, starts it and watches it', async () => {
    const m = await mount()
    await act(() => m.form().runDemoTable())

    expect(cmds.createTable).toHaveBeenCalledWith(expect.objectContaining({ playerTypes: ['SIM', 'SIM'], winsNeeded: 1 }))
    expect(cmds.startMatch).toHaveBeenCalledWith('tbl')
    expect(cmds.watchTable).toHaveBeenCalledWith('tbl')
    expect(m.onClose).toHaveBeenCalled()
    expect(m.form().busy).toBe(false)
  })

  it('accepts a capitalized TableId and does not watch if it fails to start', async () => {
    vi.mocked(cmds.createTable).mockResolvedValueOnce({ ok: true, data: { TableId: 'T2' } } as any)
    vi.mocked(cmds.startMatch).mockResolvedValueOnce({ ok: false } as any)
    const m = await mount()
    await act(() => m.form().runDemoTable())

    expect(cmds.startMatch).toHaveBeenCalledWith('T2')
    expect(cmds.watchTable).not.toHaveBeenCalled()
    expect(m.onClose).toHaveBeenCalled()
  })

  it('keeps the dialog open if the table cannot be created', async () => {
    vi.mocked(cmds.createTable).mockResolvedValueOnce({ ok: false } as any)
    const m = await mount()
    await act(() => m.form().runDemoTable())

    expect(cmds.startMatch).not.toHaveBeenCalled()
    expect(m.onClose).not.toHaveBeenCalled()
    expect(m.form().busy).toBe(false)
  })
})
