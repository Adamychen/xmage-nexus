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

const BURN: DeckV2 = {
  id: 'deck-1',
  name: 'Mono Red Burn',
  format: 'Modern',
  colors: ['R'],
  cards: [{ cardName: 'Lightning Bolt', setCode: 'M10', cardNumber: '146', amount: 4 }],
  sideboard: [],
  createdAt: 0,
  updatedAt: 0,
  source: 'custom',
}

const importer = () => document.querySelector('.join-inline-importer')

describe('DCK-34: when the join dialog opens its importer', () => {
  beforeEach(() => {
    stored.decks = []
    // A production build: no bundled precons, so the synchronous list is empty.
    vi.stubEnv('DEV', false)
  })

  afterEach(() => {
    cleanup()
    vi.unstubAllEnvs()
    setState({ conn: null, myDeck: null } as never)
  })

  it('DCK-34: a player whose decks live in storage gets the deck list, not the import form', async () => {
    stored.decks = [BURN]
    render(<JoinTableDialog table={TABLE} onClose={() => {}} onJoin={vi.fn()} />)
    await waitFor(() => expect(screen.getAllByText('Mono Red Burn')[0]).toBeTruthy())
    expect(importer()).toBeNull()
  })

  it('DCK-34: it never opens over the decks, not even for a frame', async () => {
    stored.decks = [BURN]
    render(<JoinTableDialog table={TABLE} onClose={() => {}} onJoin={vi.fn()} />)
    expect(importer()).toBeNull()
    await waitFor(() => expect(screen.getAllByText('Mono Red Burn')[0]).toBeTruthy())
    expect(importer()).toBeNull()
  })

  it('DCK-34: a player with no decks anywhere gets it open', async () => {
    render(<JoinTableDialog table={TABLE} onClose={() => {}} onJoin={vi.fn()} />)
    await waitFor(() => expect(importer()).not.toBeNull())
  })

  it('DCK-34: the toggle still opens it with decks on the shelf, and the list stays underneath', async () => {
    stored.decks = [BURN]
    render(<JoinTableDialog table={TABLE} onClose={() => {}} onJoin={vi.fn()} />)
    await waitFor(() => expect(screen.getAllByText('Mono Red Burn')[0]).toBeTruthy())
    fireEvent.click(screen.getByTestId('join-import-toggle-btn'))
    expect(importer()).not.toBeNull()
    expect(screen.getAllByText('Mono Red Burn')[0]).toBeTruthy()
  })
})
