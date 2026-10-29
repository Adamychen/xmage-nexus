import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import TourneyFormatStep from './TourneyFormatStep'
import { DEFAULT_TOURNAMENT_TYPES } from './constants'

vi.mock('../../net/commands', () => ({
  getExpansionsWithBoosters: vi.fn().mockResolvedValue([]),
}))

const stubForm = (over: Record<string, unknown> = {}) => ({
  name: 'Torneo',
  setName: vi.fn(),
  applyPreset: vi.fn(),
  tournamentType: 'Booster Draft Swiss',
  tournamentTypes: DEFAULT_TOURNAMENT_TYPES,
  setTournamentChoice: vi.fn(),
  numPlayers: 8,
  setNumPlayers: vi.fn(),
  seatLimits: { minPlayers: 4, maxPlayers: 16 },
  numberRounds: 3,
  setNumberRounds: vi.fn(),
  draftBoosters: 3,
  setDraftBoosters: vi.fn(),
  draftSetsRaw: 'M21, M21, M21',
  setDraftSetsRaw: vi.fn(),
  draftCubes: [],
  draftCubeName: '',
  setDraftCubeName: vi.fn(),
  gameType: 'Two Player Duel',
  setGameType: vi.fn(),
  effectiveGameTypes: [{ name: 'Two Player Duel', minPlayers: 2, maxPlayers: 2 }],
  deckType: 'Limited',
  setDeckType: vi.fn(),
  effectiveDeckTypes: ['Constructed - Modern', 'Limited'],
  compatibilityError: null,
  ...over,
}) as any

function renderStep(over: Record<string, unknown> = {}) {
  const form = stubForm(over)
  render(<TourneyFormatStep form={form} />)
  return form
}

const radio = (name: RegExp) => screen.getByRole('radio', { name })

describe('TourneyFormatStep: modality, pairing and packs', () => {
  afterEach(() => cleanup())

  it('TRN-2: the modality cards are radios and the modality of the form is checked', () => {
    renderStep()
    expect(radio(/Draft de sobres/).getAttribute('aria-checked')).toBe('true')
    expect(radio(/Construido/).getAttribute('aria-checked')).toBe('false')
    expect(radio(/Sellado/)).toBeDefined()
    expect(radio(/Jumpstart/)).toBeDefined()
  })

  it('TRN-2: choosing a modality sends the choice it composes into a server name', () => {
    const form = renderStep()
    fireEvent.click(radio(/Sellado/))
    expect(form.setTournamentChoice).toHaveBeenCalledWith({ modality: 'sealed', pairing: 'swiss', variant: 'standard' })
  })

  it('TRN-2: choosing a pairing keeps the modality and the packs', () => {
    const form = renderStep({ tournamentType: 'Booster Draft Swiss (Cube)' })
    fireEvent.click(radio(/Eliminación/))
    expect(form.setTournamentChoice).toHaveBeenCalledWith({ modality: 'draft', pairing: 'elimination', variant: 'cube' })
  })

  it('TRN-2: a pack chip sends the composed server name', () => {
    const form = renderStep()
    fireEvent.click(radio(/^Cubo$/))
    expect(form.setTournamentChoice).toHaveBeenCalledWith({ modality: 'draft', pairing: 'swiss', variant: 'cube' })
  })

  it('TRN-2: the composed server name is shown under the choices', () => {
    const { container } = render(<TourneyFormatStep form={stubForm({ tournamentType: 'Sealed Swiss (Cube)' })} />)
    expect(container.querySelector('.trn-server-name')?.textContent).toBe('Sealed Swiss (Cube)')
  })

  it('TRN-2: a combination the server does not list is disabled with its reason and never sent', () => {
    const form = renderStep({ tournamentType: 'Jumpstart Elimination (Custom)' })
    const swiss = radio(/Suizo/)
    expect(swiss.getAttribute('aria-disabled')).toBe('true')
    expect(swiss.getAttribute('title')).toMatch(/no ofrece esta combinación/)
    fireEvent.click(swiss)
    expect(form.setTournamentChoice).not.toHaveBeenCalled()
  })

  it('TRN-2: a pack the server does not list stays visible, disabled with its reason', () => {
    renderStep({ tournamentTypes: ['Booster Draft Swiss', 'Booster Draft Elimination'] })
    const random = radio(/^Aleatorio$/)
    expect(random.getAttribute('aria-disabled')).toBe('true')
    expect(random.getAttribute('title')).toMatch(/no ofrece/)
  })

  it('TRN-2: a constructed tournament offers no packs and shows the deck format instead', () => {
    renderStep({ tournamentType: 'Constructed Swiss', deckType: 'Constructed - Modern' })
    expect(screen.queryByRole('radiogroup', { name: /Variante/ })).toBeNull()
    expect(screen.getByTestId('format-deck-type')).toBeDefined()
    expect(radio(/Construido/).getAttribute('aria-checked')).toBe('true')
  })

  it('TRN-2: a limited modality hides the deck format, which is always Limited', () => {
    renderStep()
    expect(screen.queryByTestId('format-deck-type')).toBeNull()
  })
})

describe('TourneyFormatStep: seats', () => {
  afterEach(() => cleanup())

  const quickPicks = () => screen.queryAllByRole('button', { name: /^\d+ plazas$/ })
  const seatInput = () => screen.getByRole('spinbutton', { name: 'Número de plazas' }) as HTMLInputElement

  it.each([
    ['a draft of 4 to 16 offers 4, 8 and 16', { minPlayers: 4, maxPlayers: 16 }, ['4 plazas', '8 plazas', '16 plazas']],
    ['a type of 2 to 6 offers only 4', { minPlayers: 2, maxPlayers: 6 }, ['4 plazas']],
    ['a type of 9 to 12 offers none', { minPlayers: 9, maxPlayers: 12 }, []],
  ])('TRN-4: quick picks, %s', (_label, seatLimits, names) => {
    renderStep({ seatLimits, numPlayers: seatLimits.minPlayers })
    expect(quickPicks().map((b) => b.textContent)).toEqual(names)
  })

  it('TRN-4: the quick pick of the form seat count is pressed and a quick pick sends its count', () => {
    const form = renderStep({ numPlayers: 8 })
    expect(screen.getByRole('button', { name: '8 plazas' }).getAttribute('aria-pressed')).toBe('true')
    fireEvent.click(screen.getByRole('button', { name: '16 plazas' }))
    expect(form.setNumPlayers).toHaveBeenCalledWith(16)
  })

  it('TRN-4: the stepper moves one seat and stops at the limits of the type', () => {
    const form = renderStep({ numPlayers: 4 })
    expect((screen.getByRole('button', { name: 'Menos plazas' }) as HTMLButtonElement).disabled).toBe(true)
    fireEvent.click(screen.getByRole('button', { name: 'Más plazas' }))
    expect(form.setNumPlayers).toHaveBeenLastCalledWith(5)
  })

  it('TRN-4: the stepper cannot go above the maximum of the type', () => {
    renderStep({ numPlayers: 16 })
    expect((screen.getByRole('button', { name: 'Más plazas' }) as HTMLButtonElement).disabled).toBe(true)
    expect((screen.getByRole('button', { name: 'Menos plazas' }) as HTMLButtonElement).disabled).toBe(false)
  })

  it('TRN-4: the seat input sends a count inside the limits and never one outside them', () => {
    const form = renderStep({ numPlayers: 8 })
    const input = seatInput()
    expect(input.min).toBe('4')
    expect(input.max).toBe('16')
    fireEvent.change(input, { target: { value: '11' } })
    expect(form.setNumPlayers).toHaveBeenLastCalledWith(11)
    fireEvent.change(input, { target: { value: '40' } })
    expect(form.setNumPlayers).not.toHaveBeenCalledWith(40)
  })

  it('TRN-4: the hint says which counts the type takes', () => {
    renderStep({ seatLimits: { minPlayers: 2, maxPlayers: 6 } })
    expect(screen.getByText('Entre 2 y 6 plazas para este tipo.')).toBeDefined()
  })

  it('TRN-4: the elimination path and the Swiss recommendation use a count that is not a power of two', () => {
    renderStep({ tournamentType: 'Booster Draft Elimination', numPlayers: 6 })
    expect(screen.getByText('Rondas: 3 · Cuartos de final → Semifinales → Gran final')).toBeDefined()
  })

  it('TRN-4: a Swiss tournament of 6 seats recommends 3 rounds', () => {
    renderStep({ tournamentType: 'Constructed Swiss', deckType: 'Constructed - Modern', numPlayers: 6, numberRounds: 3 })
    expect(screen.getByRole('button', { name: 'Rondas: 3, recomendadas' }).getAttribute('aria-pressed')).toBe('true')
  })
})

describe('TourneyFormatStep: rounds', () => {
  afterEach(() => cleanup())

  it('TRN-3: a Swiss tournament offers 2 to 10 rounds and marks the recommended count', () => {
    render(<TourneyFormatStep form={stubForm({ numPlayers: 8, numberRounds: 3 })} />)
    const recommended = screen.getByRole('button', { name: 'Rondas: 3, recomendadas' })
    expect(recommended.getAttribute('aria-pressed')).toBe('true')
    expect(recommended.querySelector('svg')).not.toBeNull()
    const rounds = screen.getAllByRole('button', { name: /^Rondas: \d+/ })
    expect(rounds).toHaveLength(9)
  })

  it('TRN-3: a round count is picked by hand and sent through the form', () => {
    const form = renderStep({ numberRounds: 3 })
    fireEvent.click(screen.getByRole('button', { name: 'Rondas: 5' }))
    expect(form.setNumberRounds).toHaveBeenCalledWith(5)
  })

  it('TRN-3: a Swiss tournament with 2 seats recommends 2 rounds', () => {
    renderStep({ numPlayers: 2, numberRounds: 2 })
    expect(screen.getByRole('button', { name: 'Rondas: 2, recomendadas' }).getAttribute('aria-pressed')).toBe('true')
  })

  it('TRN-3: an elimination tournament shows its derived rounds as text and offers no count', () => {
    renderStep({ tournamentType: 'Booster Draft Elimination', numPlayers: 8 })
    expect(screen.getByText('Rondas: 3 · Cuartos de final → Semifinales → Gran final')).toBeDefined()
    expect(screen.queryByRole('button', { name: /^Rondas: \d+/ })).toBeNull()
  })
})

describe('TourneyFormatStep: sets', () => {
  afterEach(() => cleanup())

  it('TRN-7: there is one set slot per booster and a popular set fills them all', () => {
    const form = renderStep({ draftSetsRaw: '' })
    expect(screen.getByLabelText(/^Sobre 1/)).toBeDefined()
    expect(screen.getByLabelText(/^Sobre 2/)).toBeDefined()
    expect(screen.getByLabelText(/^Sobre 3/)).toBeDefined()
    expect(screen.queryByLabelText(/^Sobre 4/)).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'MH3' }))
    expect(form.setDraftSetsRaw).toHaveBeenCalledWith('MH3, MH3, MH3')
  })

  it('TRN-7: a slot changes on its own and keeps the others', () => {
    const form = renderStep({ draftSetsRaw: 'M21, M21, M21' })
    fireEvent.change(screen.getByLabelText(/^Sobre 2/), { target: { value: 'BLB' } })
    expect(form.setDraftSetsRaw).toHaveBeenCalledWith('M21, BLB, M21')
  })

  it('TRN-7: repeated sets are summarised as M21 ×3, never listed twice', () => {
    renderStep({ draftSetsRaw: 'M21, M21, M21' })
    expect(screen.getByText('Expansiones: M21 ×3')).toBeDefined()
    expect(screen.queryByText(/M21, M21, M21/)).toBeNull()
  })

  it('TRN-7: the codes are typed behind a toggle that keeps the raw value', () => {
    const form = renderStep({ draftSetsRaw: 'M21, BLB, MH3' })
    expect(screen.queryByPlaceholderText(/Ej\. M21, MH3, BLB/)).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Escribir códigos…' }))
    const input = screen.getByPlaceholderText(/Ej\. M21, MH3, BLB/) as HTMLInputElement
    expect(input.value).toBe('M21, BLB, MH3')
    fireEvent.change(input, { target: { value: 'DSK' } })
    expect(form.setDraftSetsRaw).toHaveBeenCalledWith('DSK')
  })

  it('TRN-7: six boosters give six slots, and the booster control sets the count', () => {
    const form = renderStep({ draftBoosters: 6, draftSetsRaw: 'M21, M21, M21, M21, M21, M21' })
    expect(screen.getByLabelText(/^Sobre 6/)).toBeDefined()
    fireEvent.click(screen.getByRole('tab', { name: '3' }))
    expect(form.setDraftBoosters).toHaveBeenCalledWith(3)
  })

  it('TRN-7: a cube draft shows the cube select instead of the set slots', () => {
    renderStep({ tournamentType: 'Booster Draft Swiss (Cube)' })
    expect(screen.queryByLabelText(/^Sobre 1/)).toBeNull()
    expect(screen.getByRole('combobox').querySelectorAll('option').length).toBeGreaterThan(1)
  })

  it('TRN-7: a random pool shows the button that opens the pool dialog', () => {
    renderStep({ tournamentType: 'Booster Draft Swiss (Random)' })
    expect(screen.getByTestId('random-packs-open')).toBeDefined()
  })

  it('TRN-7: a Jumpstart tournament shows no set slots', () => {
    renderStep({ tournamentType: 'Jumpstart Swiss' })
    expect(screen.queryByLabelText(/^Sobre 1/)).toBeNull()
    expect(screen.queryByRole('button', { name: 'Escribir códigos…' })).toBeNull()
  })
})
