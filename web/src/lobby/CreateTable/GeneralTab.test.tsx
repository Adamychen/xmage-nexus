import { render, screen, cleanup } from '@testing-library/react'
import { describe, expect, it, vi, afterEach } from 'vitest'
import GeneralTab from './GeneralTab'

vi.mock('../../net/commands', () => ({
  getExpansionsWithBoosters: vi.fn().mockResolvedValue([]),
}))

const stubForm = (over: Record<string, unknown> = {}) => ({
  tableCategory: 'tourney',
  applyMode: vi.fn(),
  applyPreset: vi.fn(),
  name: 't',
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
  tournamentTypes: [
    'Constructed Elimination',
    'Constructed Swiss',
    'Booster Draft Elimination',
    'Booster Draft Swiss',
    'Sealed Elimination',
  ],
  numberRounds: 0,
  setNumberRounds: vi.fn(),
  numPlayers: 8,
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

describe('GeneralTab player-count chips', () => {
  afterEach(() => cleanup())

  it('muestra "N plazas" una sola vez (sin número duplicado)', () => {
    render(<GeneralTab form={stubForm()} />)
    for (const n of [2, 4, 8, 16, 32]) {
      expect(screen.getByRole('button', { name: new RegExp(`^${n} plazas$`) })).toBeDefined()
      expect(screen.queryByText(new RegExp(`^${n} ${n} plazas$`))).toBeNull()
    }
  })

  it('en rama limited el desplegable de tipo excluye construidos', () => {
    render(<GeneralTab form={stubForm({
      tournamentCategory: 'limited',
      useDraftTournament: true,
      deckType: 'Limited',
      tournamentType: 'Booster Draft Elimination',
    })} />)
    const selects = screen.getAllByRole('combobox') as HTMLSelectElement[]
    const typeSelect = selects.find((s) =>
      Array.from(s.options).some((o) => o.value === 'Booster Draft Elimination'),
    )
    expect(typeSelect).toBeDefined()
    const values = Array.from(typeSelect!.options).map((o) => o.value)
    expect(values).toContain('Booster Draft Elimination')
    expect(values).toContain('Booster Draft Swiss')
    expect(values).toContain('Sealed Elimination')
    expect(values).not.toContain('Constructed Elimination')
    expect(values).not.toContain('Constructed Swiss')
  })

  it('en rama constructed el desplegable solo ofrece construidos', () => {
    render(<GeneralTab form={stubForm()} />)
    const selects = screen.getAllByRole('combobox') as HTMLSelectElement[]
    const typeSelect = selects.find((s) =>
      Array.from(s.options).some((o) => o.value === 'Constructed Swiss'),
    )
    expect(typeSelect).toBeDefined()
    const values = Array.from(typeSelect!.options).map((o) => o.value)
    expect(values).toEqual(['Constructed Swiss', 'Constructed Elimination'])
  })

  it('match Limited sin draft: oculta sobres y guía al draft', () => {
    render(<GeneralTab form={stubForm({
      tableCategory: 'duel',
      deckType: 'Limited',
      tournamentCategory: 'limited',
      useDraftTournament: false,
      isLimited: true,
      isDraftLimited: false,
    })} />)
    expect(screen.queryByPlaceholderText(/Ej\. M21, MH3, BLB/)).toBeNull()
    expect(screen.getByText(/no genera sobres/)).toBeDefined()
  })

  it('duelo Limited con draft: muestra sobres y no avisa', () => {
    render(<GeneralTab form={stubForm({
      tableCategory: 'duel',
      deckType: 'Limited',
      tournamentCategory: 'limited',
      useDraftTournament: true,
      isLimited: true,
      isDraftLimited: true,
    })} />)
    expect(screen.getByPlaceholderText(/Ej\. M21, MH3, BLB/)).toBeDefined()
    expect(screen.queryByText(/no genera sobres/)).toBeNull()
  })
})
