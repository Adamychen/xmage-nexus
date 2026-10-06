import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import JoinTableDialog from './JoinTableDialog'
import { setState } from '../state/state'
import type { TableView } from '../net/types'
import type { DeckV2 } from '../decks/types'

const stored = vi.hoisted(() => ({ decks: [] as DeckV2[] }))

vi.mock('../decks/storage', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../decks/storage')>()
  return {
    ...actual,
    getDeckStorage: () => ({
      list: async () => [...stored.decks],
      put: async (d: DeckV2) => { stored.decks.push(d) },
    }),
  }
})

const TABLE: TableView = {
  tableId: 'tab-1', tableName: 'Modern night', controllerName: 'Diana', gameType: 'Two Player Duel',
  deckType: 'Constructed - Modern', additionalInfoShort: '', additionalInfoFull: '', createTime: Date.now(),
  tableState: 'WAITING', skillLevel: 'CASUAL', tableStateText: 'Waiting for players', seatsInfo: '1/2',
  isTournament: false,
  seats: [{ playerName: 'Diana', seatIndex: 0, playerType: 'HUMAN' }, { playerName: '', seatIndex: 1, playerType: 'HUMAN' }],
  games: [], quitRatio: '0%', minimumRating: '0', limited: false, rated: false, passworded: false, spectatorsAllowed: true,
}

describe('JoinTableDialog for a player with no decks', () => {
  beforeEach(() => {
    stored.decks = []
    vi.stubEnv('DEV', false)
  })

  afterEach(() => {
    cleanup()
    vi.unstubAllEnvs()
    setState({ conn: null, myDeck: null } as never)
  })

  it('adds the starter decks and selects one that fits the table', async () => {
    render(<JoinTableDialog table={TABLE} onClose={() => {}} onJoin={vi.fn()} />)
    fireEvent.click(await screen.findByTestId('starter-decks-add'))
    await waitFor(() => expect(screen.queryByTestId('starter-decks-offer')).toBeNull())
    expect(stored.decks).toHaveLength(2)
    const checked = screen.getAllByRole('radio').filter((r) => r.getAttribute('aria-checked') === 'true')
    expect(checked).toHaveLength(1)
    expect(checked[0].textContent).toMatch(/Mono Red Burn|Mono White Humans/)
  })

  it('does not offer them for a table they cannot join', async () => {
    render(<JoinTableDialog table={{ ...TABLE, deckType: 'Variant Magic - Commander', gameType: 'Commander Two Player Duel' }} onClose={() => {}} onJoin={vi.fn()} />)
    await new Promise((r) => setTimeout(r, 50))
    expect(screen.queryByTestId('starter-decks-offer')).toBeNull()
  })
})
