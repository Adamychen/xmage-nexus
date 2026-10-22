import { cleanup, render } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import GeneralTab from './GeneralTab'

vi.mock('../../net/commands', () => ({
  getExpansionsWithBoosters: vi.fn().mockResolvedValue([]),
}))

const stubForm = (over: Record<string, unknown> = {}) => ({
  kind: 'casual',
  tableCategory: 'match',
  name: '',
  setName: vi.fn(),
  gameType: 'Two Player Duel',
  setGameType: vi.fn(),
  effectiveGameTypes: [{ name: 'Two Player Duel', minPlayers: 2, maxPlayers: 2 }],
  deckType: 'Constructed - Modern',
  setDeckType: vi.fn(),
  effectiveDeckTypes: ['Constructed - Modern'],
  tournamentCategory: 'constructed',
  setTournamentCategory: vi.fn(),
  useDraftTournament: false,
  setUseDraftTournament: vi.fn(),
  tournamentType: 'Constructed Elimination',
  setTournamentType: vi.fn(),
  tournamentTypes: ['Constructed Elimination'],
  numberRounds: 0,
  setNumberRounds: vi.fn(),
  numPlayers: 2,
  setNumPlayers: vi.fn(),
  draftBoosters: 3,
  setDraftBoosters: vi.fn(),
  draftConstructionTime: 600,
  setDraftConstructionTime: vi.fn(),
  draftCubes: [],
  draftCubeName: '',
  setDraftCubeName: vi.fn(),
  draftSetsRaw: 'MH3',
  setDraftSetsRaw: vi.fn(),
  draftTiming: 'REGULAR',
  setDraftTiming: vi.fn(),
  singleGame: false,
  setSingleGame: vi.fn(),
  wins: 1,
  setWins: vi.fn(),
  selectedGameTypeInfo: null,
  compatibilityError: null,
  ...over,
}) as any

describe('GeneralTab table name field', () => {
  afterEach(() => cleanup())

  it('caps the table name at 64 characters', () => {
    const { container } = render(<GeneralTab form={stubForm()} />)
    const input = container.querySelector('input[placeholder]') as HTMLInputElement
    expect(input).not.toBeNull()
    expect(input.maxLength).toBe(64)
  })
})
