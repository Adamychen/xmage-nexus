import { cleanup, fireEvent, render, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import DeckIssuesDialog, { requestDeckValidation } from './DeckIssuesDialog'
import type { Deck } from './decks'
import type { DeckValidationResult } from '../net/types'

vi.mock('../decks/deckIssues', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../decks/deckIssues')>()
  return { ...actual, fetchDeckIssues: vi.fn() }
})

vi.mock('../decks/deckRepair', () => ({
  isRepairPersistable: vi.fn(async () => true),
  persistDeckRepair: vi.fn(async () => null),
}))

import { fetchDeckIssues } from '../decks/deckIssues'
import { isRepairPersistable, persistDeckRepair } from '../decks/deckRepair'

afterEach(() => {
  cleanup()
  vi.mocked(fetchDeckIssues).mockReset()
  vi.mocked(persistDeckRepair).mockClear()
  vi.mocked(isRepairPersistable).mockReset().mockResolvedValue(true)
})

const DECK = {
  name: 'Test',
  cards: [{ cardName: 'Andúril', setCode: 'LTR', cardNumber: '1', amount: 1 }],
  sideboard: [],
} as unknown as Deck

const mismatchOnly: DeckValidationResult = {
  ready: true,
  missing: [],
  mismatches: [
    { cardName: 'Andúril', setCode: 'LTR', cardNumber: '1', amount: 1, resolvedName: 'Anduril', suggestions: [] },
  ],
} as unknown as DeckValidationResult

describe('DeckIssuesDialog', () => {
  it('lets the player accept a deck that only has name mismatches', async () => {
    vi.mocked(fetchDeckIssues).mockResolvedValue(mismatchOnly)
    const { findByTestId, queryByTestId } = render(<DeckIssuesDialog />)
    const result = requestDeckValidation(DECK)

    fireEvent.click(await findByTestId('deck-issues-accept-and-play'))

    await expect(result).resolves.toBe(DECK)
    await waitFor(() => expect(queryByTestId('deck-issues-dialog')).toBeNull())
  })

  it('does not offer to accept when the server would reject a card', async () => {
    vi.mocked(fetchDeckIssues).mockResolvedValue({
      ...mismatchOnly,
      missing: [{ cardName: 'Nope', setCode: 'ZZZ', cardNumber: '1', amount: 1, reason: 'UNIMPLEMENTED' }],
      fixedDeck: { name: 'Test', cards: [], sideboard: [] },
    } as unknown as DeckValidationResult)
    const { findByTestId, queryByTestId } = render(<DeckIssuesDialog />)
    void requestDeckValidation(DECK)

    await findByTestId('deck-issues-remove-and-play')
    expect(queryByTestId('deck-issues-accept-and-play')).toBeNull()
    fireEvent.click(await findByTestId('deck-issues-cancel'))
  })
})

const STORED_DECK = { ...DECK, id: 'd1' } as Deck

const outdatedPrinting: DeckValidationResult = {
  ready: true,
  missing: [
    {
      cardName: 'Andúril', setCode: 'LTR', cardNumber: '1', amount: 1, reason: 'OUTDATED_PRINTING',
      suggestions: [{ cardName: 'Andúril', setCode: 'LTR', cardNumber: '7' }],
    },
  ],
  mismatches: [],
} as unknown as DeckValidationResult

describe('DeckIssuesDialog saves the repair to the deck', () => {
  it('DCK-30: writes the applied fixes back to the stored deck and plays with the repaired deck', async () => {
    vi.mocked(fetchDeckIssues).mockResolvedValueOnce(outdatedPrinting).mockResolvedValueOnce(null)
    const { findByTestId } = render(<DeckIssuesDialog />)
    const result = requestDeckValidation(STORED_DECK)

    fireEvent.click(await findByTestId('deck-issues-auto-resolve'))

    await waitFor(() => expect(persistDeckRepair).toHaveBeenCalledTimes(1))
    expect(persistDeckRepair).toHaveBeenCalledWith('d1', [
      { from: { cardName: 'Andúril', setCode: 'LTR', cardNumber: '1' }, to: { cardName: 'Andúril', setCode: 'LTR', cardNumber: '7' } },
    ])
    await expect(result).resolves.toMatchObject({ cards: [{ setCode: 'LTR', cardNumber: '7', amount: 1 }] })
  })

  it('DCK-30: a row suggestion saves its own fix', async () => {
    vi.mocked(fetchDeckIssues).mockResolvedValueOnce(outdatedPrinting).mockResolvedValueOnce(null)
    const { findByTestId } = render(<DeckIssuesDialog />)
    void requestDeckValidation(STORED_DECK)

    fireEvent.click(await findByTestId('deck-issue-suggestion'))

    await waitFor(() => expect(persistDeckRepair).toHaveBeenCalledWith('d1', [
      { from: { cardName: 'Andúril', setCode: 'LTR', cardNumber: '1' }, to: { cardName: 'Andúril', setCode: 'LTR', cardNumber: '7' } },
    ]))
  })

  it('DCK-30: says the repair is saved, and says nothing for a deck that is not stored', async () => {
    vi.mocked(fetchDeckIssues).mockResolvedValue(outdatedPrinting)
    const stored = render(<DeckIssuesDialog />)
    void requestDeckValidation(STORED_DECK)
    await stored.findByTestId('deck-issues-saved-note')
    fireEvent.click(await stored.findByTestId('deck-issues-cancel'))
    cleanup()

    vi.mocked(isRepairPersistable).mockResolvedValue(false)
    const bundled = render(<DeckIssuesDialog />)
    void requestDeckValidation(DECK)
    await bundled.findByTestId('deck-issues-auto-resolve')
    expect(bundled.queryByTestId('deck-issues-saved-note')).toBeNull()
    fireEvent.click(await bundled.findByTestId('deck-issues-cancel'))
  })
})
