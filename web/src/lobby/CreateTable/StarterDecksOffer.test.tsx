import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import CreateTableDialog from '../CreateTableDialog'
import { STORAGE_KEY } from './constants'
import { setState } from '../../state/state'
import { formatValue, pickFormat } from './formatGalleryTestUtils'
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

/** The deck the carousel marks as chosen: the card with `aria-checked="true"` in the named radiogroup. */
function selectedCard(name: RegExp, group?: HTMLElement): HTMLElement | null {
  const radiogroup = group ?? screen.getByRole('radiogroup', { name })
  return radiogroup.querySelector<HTMLElement>('[aria-checked="true"]')
}

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
    expect(selectedCard(/Mazo activo|Active deck/i)?.textContent).toContain('Mono Red Burn')
    // the default extra seat waits for a human rival: no bot, no bot-deck picker
    fireEvent.click(screen.getByTestId('seat-node-1'))
    expect(screen.queryByRole('radiogroup', { name: /Mazo plaza 2|Seat 2 deck/i })).toBeNull()
    // opting into the Mad AI gives the seat a valid (non-empty) deck without a "need a deck" warning
    fireEvent.click(screen.getByRole('radio', { name: /Mad/ }))
    const botDeck = await screen.findByRole('radiogroup', { name: /Mazo plaza 2|Seat 2 deck/i })
    expect(selectedCard(/Mazo plaza 2|Seat 2 deck/i, botDeck)).not.toBeNull()
    expect(screen.queryByText(/Necesitas un mazo|You need a deck/i)).toBeNull()
  })

  it('seats me with the Commander starter at a Commander table', async () => {
    render(<CreateTableDialog onClose={() => {}} />)
    await pickFormat('format-game-type', 'Commander Two Player Duel')
    await pickFormat('format-deck-type', 'Variant Magic - Commander')
    expect(formatValue('format-deck-type')).toBe('Variant Magic - Commander')
    fireEvent.click(
      screen.getAllByRole('button', { name: /Multijugador|Multiplayer/ })
        .find((b) => (b as HTMLElement).classList.contains('wizard-step'))!,
    )
    fireEvent.click(await screen.findByTestId('starter-decks-add'))
    await waitFor(() => expect(screen.queryByTestId('starter-decks-offer')).toBeNull())
    expect(selectedCard(/Mazo activo|Active deck/i)?.textContent).toContain('Krenko')
  })

  it('stays out of the way once the player has decks', async () => {
    stored.decks = [{ id: 'd1', name: 'Mine', cards: [{ cardName: 'Island', setCode: 'LEA', cardNumber: '288', amount: 60 }], sideboard: [], format: 'Modern', colors: ['U'], createdAt: 1, updatedAt: 1, source: 'custom' } as DeckV2]
    render(<CreateTableDialog onClose={() => {}} />)
    fireEvent.click(
      screen.getAllByRole('button', { name: /Multijugador|Multiplayer/ })
        .find((b) => (b as HTMLElement).classList.contains('wizard-step'))!,
    )
    await waitFor(() => expect(selectedCard(/Mazo activo|Active deck/i)).not.toBeNull())
    expect(screen.queryByTestId('starter-decks-offer')).toBeNull()
  })
})
