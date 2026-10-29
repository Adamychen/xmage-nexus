import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, renderHook, waitFor } from '@testing-library/react'
import * as cmds from '../../net/commands'
import { requestDeckValidation } from '../DeckIssuesDialog'
import { useCreateTableForm } from './useCreateTableForm'
import { STORAGE_KEY } from './constants'

vi.mock('../../net/commands', () => ({
  getGameTypes: vi.fn(),
  getDeckTypes: vi.fn(),
  getPlayerTypes: vi.fn(),
  getTournamentCatalogue: vi.fn(),
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
  vi.mocked(cmds.getTournamentCatalogue).mockReset().mockResolvedValue(catalogueWith({}))
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
  await waitFor(() => expect(cmds.getTournamentCatalogue).toHaveBeenCalled())
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

describe('defaults match the official client', () => {
  it('opens as a limited duel of "Game" with 2 wins, multiple-player attack and EDH power level 0', async () => {
    const m = await mount()
    expect(m.form().name).toBe('Game')
    expect(m.form().deckType).toBe('Limited')
    expect(m.form().wins).toBe(2)
    expect(m.form().attackOption).toBe('MULTIPLE')
    expect(m.form().edhPowerLevel).toBe(0)
  })

  it('an explicit attack choice wins over the default', async () => {
    const m = await mount()
    act(() => m.form().setAttackOption('LEFT'))
    expect(m.form().attackOption).toBe('LEFT')
  })
})

describe('table category', () => {
  it('multiplayer picks a game type for more than 2 and keeps a compatible format', async () => {
    const m = await mount()
    act(() => m.form().setTableCategory('multi'))
    expect(m.form().gameType).toBe('Free For All')
    expect(m.form().deckType).toBe('Limited')
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

  it('LBY-6: if a bot cannot join, the just-created table is removed', async () => {
    const m = await constructedTourneyWithBots(2)
    vi.mocked(cmds.joinTournamentTable).mockResolvedValueOnce({ ok: false, error: 'boom' } as any)
    await act(() => m.form().submit())

    expect(cmds.removeTable).toHaveBeenCalledWith('tour')
    expect(cmds.joinTournamentTable).toHaveBeenCalledOnce()
    expect(m.form().error).toBeTruthy()
    expect(m.onClose).not.toHaveBeenCalled()
  })

  it('LBY-6: cancelling the deck check of a bot removes the table', async () => {
    const m = await constructedTourneyWithBots(1)
    vi.mocked(requestDeckValidation)
      .mockImplementationOnce(async (deck) => deck) // human
      .mockResolvedValueOnce(null) // bot
    await act(() => m.form().submit())

    expect(cmds.removeTable).toHaveBeenCalledWith('tour')
    expect(cmds.joinTournamentTable).not.toHaveBeenCalled()
    expect(m.onClose).not.toHaveBeenCalled()
  })

  it('LBY-6: if the human cannot join, the table is removed', async () => {
    const m = await constructedTourneyWithBots(1)
    vi.mocked(cmds.joinTournamentTable)
      .mockResolvedValueOnce({ ok: true } as any)
      .mockResolvedValueOnce({ ok: false, error: 'boom' } as any)
    await act(() => m.form().submit())

    expect(cmds.removeTable).toHaveBeenCalledWith('tour')
    expect(m.onClose).not.toHaveBeenCalled()
  })

  it('LBY-6: cancelling the human deck check creates nothing', async () => {
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
    act(() => m.form().setDeckType('Constructed - Modern'))
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

  it('LBY-6: cancelling the bot deck check does not create the table', async () => {
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

async function mountTourney() {
  const onClose = vi.fn()
  const hook = renderHook(() => useCreateTableForm(onClose, 'tourney'))
  await waitFor(() => expect(cmds.getTournamentCatalogue).toHaveBeenCalled())
  await act(async () => {})
  return { ...hook, onClose, form: () => hook.result.current }
}

const CONSTRUCTED_SWISS = { modality: 'constructed', pairing: 'swiss', variant: 'standard' } as const

const ENGINE_LIMITS = {
  'Booster Draft Elimination': { minPlayers: 4, maxPlayers: 16 },
  'Constructed Swiss': { minPlayers: 4, maxPlayers: 16 },
  'Sealed Swiss': { minPlayers: 2, maxPlayers: 16 },
}

/** The server's catalogue: the same four type names every case starts from, with the given seat limits. */
function catalogueWith(limits: Record<string, { minPlayers: number; maxPlayers: number }>) {
  return { names: ['Constructed Swiss', 'Constructed Elimination', 'Booster Draft Elimination', 'Sealed Swiss'], limits }
}

describe('TRN-4: a tournament starts with 8 seats and restores its own seat count', () => {
  it('TRN-4: a new tournament starts with 8 seats', async () => {
    const m = await mountTourney()
    expect(m.form().numPlayers).toBe(8)
  })

  it('TRN-4: a saved constructed tournament restores 16 seats', async () => {
    ls.set(STORAGE_KEY, JSON.stringify({ tableCategory: 'tourney', tournamentCategory: 'constructed', numPlayers: 16 }))
    const m = await mountTourney()
    expect(m.form().numPlayers).toBe(16)
    expect(m.form().tournamentType).toBe('Constructed Swiss')
  })

  it('TRN-4: a saved seat count above the maximum of the type is clamped to it', async () => {
    vi.mocked(cmds.getTournamentCatalogue).mockResolvedValueOnce(catalogueWith(ENGINE_LIMITS))
    ls.set(STORAGE_KEY, JSON.stringify({ tableCategory: 'tourney', tournamentCategory: 'constructed', numPlayers: 32 }))
    const m = await mountTourney()
    await waitFor(() => expect(m.form().numPlayers).toBe(16))
  })

  it('TRN-4: a saved seat count below the minimum of the type is raised to it', async () => {
    vi.mocked(cmds.getTournamentCatalogue).mockResolvedValueOnce(catalogueWith(ENGINE_LIMITS))
    ls.set(STORAGE_KEY, JSON.stringify({ tableCategory: 'tourney', tournamentCategory: 'constructed', numPlayers: 2 }))
    const m = await mountTourney()
    await waitFor(() => expect(m.form().numPlayers).toBe(4))
  })

  it('TRN-4: a tournament does not inherit the seat count of a saved match', async () => {
    ls.set(STORAGE_KEY, JSON.stringify({ tableCategory: 'multi', numPlayers: 4 }))
    const m = await mountTourney()
    expect(m.form().numPlayers).toBe(8)
  })
})

describe('TRN-4: the seat limits are the ones the server gives the selected type', () => {
  it('TRN-4: the form takes the limits of the selected type from the catalogue', async () => {
    vi.mocked(cmds.getTournamentCatalogue).mockResolvedValueOnce(catalogueWith(ENGINE_LIMITS))
    const m = await mountTourney()
    await waitFor(() => expect(m.form().seatLimits).toEqual({ minPlayers: 4, maxPlayers: 16 }))
    expect(m.form().tournamentTypeLimits).toEqual(ENGINE_LIMITS)
  })

  it('TRN-4: a new tournament starts at 8 and is clamped to a type that allows at most 6', async () => {
    vi.mocked(cmds.getTournamentCatalogue).mockResolvedValueOnce(catalogueWith({ 'Booster Draft Elimination': { minPlayers: 2, maxPlayers: 6 } }))
    const m = await mountTourney()
    await waitFor(() => expect(m.form().numPlayers).toBe(6))
  })

  it('TRN-4: changing the type clamps the seats into the limits of the new type', async () => {
    vi.mocked(cmds.getTournamentCatalogue).mockResolvedValueOnce(catalogueWith({
      'Booster Draft Elimination': { minPlayers: 4, maxPlayers: 16 },
      'Constructed Swiss': { minPlayers: 2, maxPlayers: 6 },
    }))
    const m = await mountTourney()
    await waitFor(() => expect(m.form().numPlayers).toBe(8))
    act(() => m.form().setTournamentChoice(CONSTRUCTED_SWISS))
    expect(m.form().numPlayers).toBe(6)
  })

  it('TRN-4: a type the server gave no limits for takes 2 to 16 seats', async () => {
    const m = await mountTourney()
    expect(m.form().seatLimits).toEqual({ minPlayers: 2, maxPlayers: 16 })
    act(() => m.form().setNumPlayers(40))
    expect(m.form().numPlayers).toBe(16)
    act(() => m.form().setNumPlayers(1))
    expect(m.form().numPlayers).toBe(2)
  })
})

describe('TRN-3: a Swiss tournament has a round count derived from its seats', () => {
  it('TRN-3: a Swiss tournament defaults to the recommended rounds, never 0', async () => {
    const m = await mountTourney()
    act(() => m.form().setTournamentChoice(CONSTRUCTED_SWISS))
    expect(m.form().numberRounds).toBe(3)
  })

  it('TRN-3: changing the seats moves the rounds to the new recommendation', async () => {
    const m = await mountTourney()
    act(() => m.form().setTournamentChoice(CONSTRUCTED_SWISS))
    act(() => m.form().setNumPlayers(16))
    expect(m.form().numberRounds).toBe(4)
    act(() => m.form().setNumPlayers(6))
    expect(m.form().numberRounds).toBe(3)
    act(() => m.form().setNumPlayers(2))
    expect(m.form().numberRounds).toBe(2)
  })

  it('TRN-3: a round count picked by hand survives a change of seats', async () => {
    const m = await mountTourney()
    act(() => m.form().setTournamentChoice(CONSTRUCTED_SWISS))
    act(() => m.form().setNumberRounds(6))
    act(() => m.form().setNumPlayers(16))
    expect(m.form().numberRounds).toBe(6)
  })

  it('TRN-3: a preset sets the recommended rounds again, so the count is automatic once more', async () => {
    const m = await mountTourney()
    act(() => m.form().setTournamentChoice(CONSTRUCTED_SWISS))
    act(() => m.form().setNumberRounds(6))
    act(() => m.form().applyPreset('modern_swiss_8p'))
    expect(m.form().numberRounds).toBe(3)
    act(() => m.form().setNumPlayers(16))
    expect(m.form().numberRounds).toBe(4)
  })

  it('TRN-3: a Swiss tournament submits the round count it shows', async () => {
    const m = await mountTourney()
    act(() => m.form().setTournamentChoice(CONSTRUCTED_SWISS))
    act(() => m.form().setNumberRounds(5))
    await act(() => m.form().submit())
    expect(cmds.createTournamentTable).toHaveBeenCalledWith(expect.objectContaining({ tournamentType: 'Constructed Swiss', numberRounds: 5 }))
  })

  it('TRN-3: an elimination tournament submits no round count', async () => {
    const m = await mountTourney()
    act(() => m.form().setTournamentChoice({ modality: 'draft', pairing: 'elimination', variant: 'standard' }))
    await act(() => m.form().submit())
    const args = vi.mocked(cmds.createTournamentTable).mock.calls[0][0]
    expect(args).toMatchObject({ tournamentType: 'Booster Draft Elimination', limited: true })
    expect(args).not.toHaveProperty('numberRounds')
  })
})

describe('reset and submit guard', () => {
  it('resetToDefaults clears the saved form and asks the host to remount', async () => {
    const onReset = vi.fn()
    const hook = renderHook(() => useCreateTableForm(vi.fn(), 'match', onReset))
    await waitFor(() => expect(cmds.getTournamentCatalogue).toHaveBeenCalled())
    await act(async () => {})
    act(() => hook.result.current.setName('Mesa'))
    expect(ls.has(STORAGE_KEY)).toBe(true)

    act(() => hook.result.current.resetToDefaults())

    expect(ls.has(STORAGE_KEY)).toBe(false)
    expect(onReset).toHaveBeenCalledTimes(1)
  })

  it('submit with an empty name moves to General with the error and creates nothing', async () => {
    const m = await mount()
    act(() => m.form().setName('  '))
    act(() => m.form().setActiveTab('review'))
    await act(() => m.form().submit())

    expect(cmds.createTable).not.toHaveBeenCalled()
    expect(cmds.createTournamentTable).not.toHaveBeenCalled()
    expect(m.form().activeTab).toBe('general')
    expect(m.form().error).toBeTruthy()
  })
})

describe('TRN-6: a limited tournament has no bot seats', () => {
  it('TRN-6: switching a constructed tournament with bots to limited turns its bots into open human seats', async () => {
    const m = await constructedTourneyWithBots(3)
    act(() => m.form().setTournamentChoice({ modality: 'draft', pairing: 'elimination', variant: 'standard' }))
    expect(m.form().isDraftLimited).toBe(true)
    expect(m.form().seatConfigs.map((s) => s.type)).toEqual(['HUMAN', 'HUMAN', 'HUMAN'])
  })

  it('TRN-6: a limited tournament submits no bot, so the form never reaches the draft-bot refusal', async () => {
    const m = await constructedTourneyWithBots(2)
    act(() => m.form().setTournamentChoice({ modality: 'draft', pairing: 'elimination', variant: 'standard' }))
    act(() => m.form().setTournamentCategory('limited'))
    await act(() => m.form().submit())
    expect(cmds.createTournamentTable).toHaveBeenCalledOnce()
    expect(vi.mocked(cmds.createTournamentTable).mock.calls[0][0]).toMatchObject({ playerTypes: ['HUMAN', 'HUMAN', 'HUMAN'] })
  })
})
