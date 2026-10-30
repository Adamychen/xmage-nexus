import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import TourneySeatsStep from './TourneySeatsStep'
import type { Deck } from '../decks'
import { setState } from '../../state/state'

const DECK = { id: 'deck-red', name: 'Mono Red', cards: [{ amount: 60 }], sideboard: [] } as unknown as Deck
const BOT_TYPES = ['COMPUTER_MAD', 'COMPUTER_MONTE_CARLO', 'COMPUTER_DRAFT_BOT']
const HUMAN = { type: 'HUMAN', deckName: '', skill: 2 }
const BOT = { type: 'COMPUTER_MAD', deckName: 'deck-red', skill: 4 }

const stubForm = (over: Record<string, unknown> = {}) => ({
  isDraftLimited: false,
  humanSeat: true,
  setHumanSeat: vi.fn(),
  numPlayers: 8,
  seatConfigs: Array.from({ length: 7 }, () => ({ ...HUMAN })),
  playerTypes: BOT_TYPES,
  availableDecks: [DECK],
  decksLoaded: true,
  myDeck: DECK,
  selectMyDeck: vi.fn(),
  simDeck: DECK,
  selectGlobalSimDeck: vi.fn(),
  adoptStarterDecks: vi.fn(),
  applySeatTypeToAll: vi.fn(),
  setSeatType: vi.fn(),
  setSeatSkill: vi.fn(),
  setSeatDeck: vi.fn(),
  skipInitShuffling: false,
  setSkipInitShuffling: vi.fn(),
  skipStartingPlayerChoice: false,
  setSkipStartingPlayerChoice: vi.fn(),
  busy: false,
  runDemoTable: vi.fn(),
  ...over,
}) as any

function renderSeats(over: Record<string, unknown> = {}) {
  const form = stubForm(over)
  const onEditDeck = vi.fn()
  const { container } = render(<TourneySeatsStep form={form} onEditDeck={onEditDeck} />)
  return { form, onEditDeck, container }
}

const rows = () => screen.getAllByRole('listitem')
const kindRadio = (row: number, name: RegExp) => within(rows()[row]).getByRole('radio', { name }) as HTMLButtonElement

/** Two bots among seven: the host plus five open seats and two bots. */
const TWO_BOTS = [BOT, { ...BOT }, ...Array.from({ length: 5 }, () => ({ ...HUMAN }))]

describe('TourneySeatsStep: the seats as a list (TRN-6)', () => {
  beforeEach(() => {
    setState({ conn: { username: 'alice' } } as never)
  })
  afterEach(() => {
    cleanup()
    setState({ conn: null } as never)
  })

  it('TRN-6: the list has one row per seat, the host first', () => {
    renderSeats()
    expect(rows()).toHaveLength(8)
    expect(rows()[0].textContent).toContain('Tú · alice')
    expect(rows()[0].textContent).toContain('Anfitrión')
  })

  it('TRN-6: the counter says who plays, how many seats are open and how many are bots', () => {
    renderSeats({ seatConfigs: TWO_BOTS })
    expect(screen.getByTestId('trn-seats-counter').textContent).toBe('Tú · 5 libres · 2 IA')
    expect(screen.getByText('8 plazas')).toBeDefined()
  })

  it('TRN-6: without the host the counter names no host and the total is the seats', () => {
    renderSeats({ humanSeat: false, seatConfigs: TWO_BOTS.slice(0, 7) })
    expect(screen.getByTestId('trn-seats-counter').textContent).toBe('5 libres · 2 IA')
    expect(rows()).toHaveLength(7)
  })

  it('TRN-6: All open and Fill with bots set every seat at once', () => {
    const { form } = renderSeats()
    fireEvent.click(screen.getByRole('button', { name: 'Todas libres' }))
    expect(form.applySeatTypeToAll).toHaveBeenLastCalledWith('HUMAN')
    fireEvent.click(screen.getByRole('button', { name: 'Llenar con bots' }))
    expect(form.applySeatTypeToAll).toHaveBeenLastCalledWith('COMPUTER_MAD')
  })

  it('TRN-6: a seat becomes a bot from its row', () => {
    const { form } = renderSeats()
    fireEvent.click(kindRadio(2, /^IA$/))
    expect(form.setSeatType).toHaveBeenCalledWith(1, 'COMPUTER_MAD')
  })

  it('TRN-6: a bot row shows its type, its skill and, in a constructed tournament, its deck', () => {
    const { form } = renderSeats({ seatConfigs: [BOT, ...Array.from({ length: 6 }, () => ({ ...HUMAN }))] })
    expect(screen.getByTestId('seat-type-0')).toBeDefined()
    fireEvent.change(screen.getByTestId('seat-skill-0'), { target: { value: '7' } })
    expect(form.setSeatSkill).toHaveBeenCalledWith(0, 7)
    fireEvent.change(screen.getByTestId('seat-deck-0'), { target: { value: 'deck-red' } })
    expect(form.setSeatDeck).toHaveBeenCalledWith(0, 'deck-red')
  })

  it('TRN-9: the bot and Fill with bots are disabled in a limited tournament, with the reason next to them', () => {
    renderSeats({ isDraftLimited: true })
    expect((screen.getByRole('button', { name: 'Llenar con bots' }) as HTMLButtonElement).disabled).toBe(true)
    for (let i = 0; i < 7; i++) expect(kindRadio(i + 1, /^IA$/).disabled).toBe(true)
    expect(screen.getByText(/nunca llegaría a sus rondas/)).toBeDefined()
    expect(kindRadio(1, /^Humano$/).getAttribute('aria-checked')).toBe('true')
  })

  it('TRN-6: switching the host seat off is a switch that sets the form flag', () => {
    const { form } = renderSeats()
    fireEvent.click(screen.getByRole('switch', { name: 'Yo juego en este torneo' }))
    expect(form.setHumanSeat).toHaveBeenCalledWith(false)
  })

  it('TRN-6: the seat panel shows no per-match maximum and no help text of another field', () => {
    const { container } = renderSeats({ seatConfigs: TWO_BOTS })
    expect(container.textContent).not.toMatch(/Config:/)
    expect(container.textContent).not.toMatch(/\bmax\b/i)
    expect(container.querySelector('.seat-table')).toBeNull()
  })

  it('TRN-6: the developer options are a collapsed section at the bottom of the step', () => {
    const { container } = renderSeats()
    const dev = container.querySelector('details.trn-seats-dev') as HTMLDetailsElement | null
    expect(dev).not.toBeNull()
    expect(dev?.open).toBe(false)
    expect(dev?.querySelector('summary')?.textContent).toBe('Opciones de desarrollador')
  })
})

describe('TourneySeatsStep: the decks (TRN-5)', () => {
  beforeEach(() => {
    setState({ conn: { username: 'alice' } } as never)
  })
  afterEach(() => {
    cleanup()
    setState({ conn: null } as never)
  })

  it('TRN-5: a limited tournament shows no deck picker for the host or the bots', () => {
    const { container } = renderSeats({ isDraftLimited: true })
    expect(screen.queryByTestId('create-edit-deck')).toBeNull()
    expect(screen.queryByTestId('trn-bots-deck')).toBeNull()
    expect(container.querySelector('[data-testid^="seat-deck-"]')).toBeNull()
    expect(screen.queryByRole('radiogroup', { name: 'Mazo activo:' })).toBeNull()
  })

  it('TRN-5: a limited tournament says that nobody brings a deck', () => {
    renderSeats({ isDraftLimited: true })
    expect(screen.getByText(/En limitado nadie trae mazo: cada cual arma el suyo con lo que abre o draftea\./)).toBeDefined()
  })

  it('TRN-5: a constructed tournament shows the host deck picker, the bots deck and each bot deck', () => {
    const { onEditDeck } = renderSeats({ seatConfigs: [BOT, ...Array.from({ length: 6 }, () => ({ ...HUMAN }))] })
    expect(screen.getByRole('radiogroup', { name: 'Mazo activo:' })).toBeDefined()
    expect(screen.getByTestId('trn-bots-deck')).toBeDefined()
    expect(screen.getByTestId('seat-deck-0')).toBeDefined()
    fireEvent.click(screen.getByTestId('create-edit-deck'))
    expect(onEditDeck).toHaveBeenCalledWith('deck-red')
  })

  it('TRN-5: a constructed tournament without a deck for the host says so', () => {
    renderSeats({ myDeck: null })
    expect(screen.getByText('Necesitas un mazo: importa o crea uno en Mis Mazos')).toBeDefined()
  })
})
