import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import CreateTableDialog from '../CreateTableDialog'
import { STORAGE_KEY } from './constants'
import { setState } from '../../state/state'
import type { DeckV2 } from '../../decks/types'

const stored = vi.hoisted(() => ({ decks: [] as DeckV2[] }))

vi.mock('../../decks/storage', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../decks/storage')>()
  return {
    ...actual,
    getDeckStorage: () => ({
      list: async () => [...stored.decks],
      put: async (d: DeckV2) => { stored.decks.push(d) },
    }),
  }
})

vi.mock('../../net/commands', () => ({
  getGameTypes: vi.fn().mockResolvedValue([
    { name: 'Two Player Duel', minPlayers: 2, maxPlayers: 2 },
    { name: 'Commander Two Player Duel', minPlayers: 2, maxPlayers: 2 },
  ]),
  getDeckTypes: vi.fn().mockResolvedValue(['Constructed - Modern', 'Variant Magic - Commander']),
  getPlayerTypes: vi.fn().mockResolvedValue(['COMPUTER_MAD']),
  getTournamentTypes: vi.fn().mockResolvedValue([]),
  getDraftCubes: vi.fn().mockResolvedValue([]),
  getExpansionsWithBoosters: vi.fn().mockResolvedValue([]),
}))

describe('Create Table for a player with no decks', () => {
  beforeEach(() => {
    stored.decks = []
    vi.stubEnv('DEV', false)
  })

  afterEach(() => {
    cleanup()
    vi.unstubAllEnvs()
    localStorage?.removeItem(STORAGE_KEY)
    setState({ conn: null, myDeck: null } as never)
  })

  it('offers the starter decks on the seats step and seats me with the first one', async () => {
    render(<CreateTableDialog onClose={() => {}} />)
    fireEvent.click(
      screen.getAllByRole('button', { name: /Multijugador|Multiplayer/ })
        .find((b) => (b as HTMLElement).classList.contains('wizard-step'))!,
    )
    const add = await screen.findByTestId('starter-decks-add')
    fireEvent.click(add)

    await waitFor(() => expect(screen.queryByTestId('starter-decks-offer')).toBeNull())
    expect(stored.decks.map((d) => d.name)).toEqual(['Mono Red Burn', 'Mono White Humans', 'Krenko: Goblin Mob Army'])
    const deckSelect = screen.getByLabelText(/Mazo activo|Active deck/i) as HTMLSelectElement
    expect(deckSelect.selectedOptions[0].textContent).toMatch(/^Mono Red Burn/)
    const botDeck = screen.getByLabelText(/Mazo plaza 2|Seat 2 deck/i) as HTMLSelectElement
    expect(botDeck.selectedOptions[0].textContent).toMatch(/^Mono White Humans/)
    expect(screen.queryByText(/Necesitas un mazo|You need a deck/i)).toBeNull()
  })

  it('seats me with the Commander starter at a Commander table', async () => {
    render(<CreateTableDialog onClose={() => {}} />)
    await waitFor(() => expect((screen.getAllByRole('combobox')[0] as HTMLSelectElement).options.length).toBe(2))
    fireEvent.change(screen.getAllByRole('combobox')[0], { target: { value: 'Commander Two Player Duel' } })
    fireEvent.change(screen.getAllByRole('combobox')[1], { target: { value: 'Variant Magic - Commander' } })
    expect((screen.getAllByRole('combobox')[1] as HTMLSelectElement).value).toBe('Variant Magic - Commander')
    fireEvent.click(
      screen.getAllByRole('button', { name: /Multijugador|Multiplayer/ })
        .find((b) => (b as HTMLElement).classList.contains('wizard-step'))!,
    )
    fireEvent.click(await screen.findByTestId('starter-decks-add'))
    await waitFor(() => expect(screen.queryByTestId('starter-decks-offer')).toBeNull())
    const deckSelect = screen.getByLabelText(/Mazo activo|Active deck/i) as HTMLSelectElement
    expect(deckSelect.selectedOptions[0].textContent).toMatch(/^Krenko/)
  })

  it('stays out of the way once the player has decks', async () => {
    stored.decks = [{ id: 'd1', name: 'Mine', cards: [{ cardName: 'Island', setCode: 'LEA', cardNumber: '288', amount: 60 }], sideboard: [], format: 'Modern', colors: ['U'], createdAt: 1, updatedAt: 1, source: 'custom' } as DeckV2]
    render(<CreateTableDialog onClose={() => {}} />)
    fireEvent.click(
      screen.getAllByRole('button', { name: /Multijugador|Multiplayer/ })
        .find((b) => (b as HTMLElement).classList.contains('wizard-step'))!,
    )
    await waitFor(() => expect((screen.getByLabelText(/Mazo activo|Active deck/i) as HTMLSelectElement).value).not.toBe(''))
    expect(screen.queryByTestId('starter-decks-offer')).toBeNull()
  })
})
