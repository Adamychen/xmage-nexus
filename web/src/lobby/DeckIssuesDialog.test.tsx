import { cleanup, fireEvent, render, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import DeckIssuesDialog, { requestDeckValidation } from './DeckIssuesDialog'
import type { Deck } from './decks'
import type { DeckValidationResult } from '../net/types'

vi.mock('../decks/deckIssues', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../decks/deckIssues')>()
  return { ...actual, fetchDeckIssues: vi.fn() }
})

import { fetchDeckIssues } from '../decks/deckIssues'

afterEach(() => {
  cleanup()
  vi.mocked(fetchDeckIssues).mockReset()
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
