import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, renderHook, waitFor } from '@testing-library/react'
import { getState, setState } from '../state/state'
import type { DeckFormatValidationResult } from '../net/types'
import type { CardStripMeta } from './ArenaCardStrip'
import type { DeckV2 } from './types'

const fetchFormatIssues = vi.fn<(deck: unknown, format: string) => Promise<DeckFormatValidationResult | null>>()
vi.mock('./deckIssues', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./deckIssues')>()),
  fetchFormatIssues: (deck: unknown, format: string) => fetchFormatIssues(deck, format),
}))

const gargantos: CardStripMeta = {
  name: 'Gargantos, the Endbringer',
  typeLine: 'Legendary Creature — Elder God Horror',
  colorIdentity: ['B', 'G'],
  legalities: { commander: 'not_legal' },
} as CardStripMeta
vi.mock('./useDeckMetadata', () => ({
  useDeckMetadata: () => ({
    metaMap: new Map([['MDC/1', gargantos]]),
    updateMetaForDeck: () => {},
  }),
}))

const { useDeckLegality, resetDeckLegalityCacheForTest } = await import('./deckLegality')

const commander = { cardName: 'Gargantos, the Endbringer', setCode: 'MDC', cardNumber: '1', amount: 1 }
const deck = (over: Partial<DeckV2> = {}): DeckV2 => ({
  id: 'g1',
  name: 'Gargantos',
  format: 'Commander',
  colors: ['B', 'G'],
  cards: [commander, { cardName: 'Swamp', setCode: 'MDC', cardNumber: '300', amount: 99 }],
  sideboard: [],
  commanderCard: commander,
  createdAt: 1,
  updatedAt: 2,
  source: 'custom',
  ...over,
}) as DeckV2

const verdict = (over: Partial<DeckFormatValidationResult> = {}): DeckFormatValidationResult => ({
  ready: true,
  supported: true,
  valid: true,
  validator: 'Commander',
  errors: [],
  ...over,
})

const initialWsAlive = getState().wsAlive

beforeEach(() => {
  resetDeckLegalityCacheForTest()
  fetchFormatIssues.mockReset()
  setState({ wsAlive: true })
})

afterEach(() => {
  cleanup()
  setState({ wsAlive: initialWsAlive })
})

describe('deck list legality', () => {
  it('DCK-19: a deck XMage accepts is legal in the list, whatever Scryfall says about unreleased cards', async () => {
    fetchFormatIssues.mockResolvedValue(verdict())
    const { result } = renderHook(() => useDeckLegality(deck()))

    await waitFor(() => expect(result.current.isValid).toBe(true))
    expect(result.current.reasons).toEqual([])
    expect(fetchFormatIssues).toHaveBeenCalledTimes(1)
  })

  it('DCK-19: a deck XMage rejects gives XMage\'s reasons', async () => {
    fetchFormatIssues.mockResolvedValue(verdict({
      valid: false,
      errors: [{ type: 'BANNED', group: 'Banned', message: 'Banned', cardName: 'Hullbreacher' }],
    }))
    const { result } = renderHook(() => useDeckLegality(deck()))

    await waitFor(() => expect(result.current.reasons).toEqual(['Banned']))
    expect(result.current.isValid).toBe(false)
  })

  it('DCK-19: without the proxy the local check decides, and it says which card is the problem', () => {
    setState({ wsAlive: false })
    const { result } = renderHook(() => useDeckLegality(deck()))

    expect(fetchFormatIssues).not.toHaveBeenCalled()
    expect(result.current.isValid).toBe(false)
    expect(result.current.reasons.some((r) => r.startsWith('Gargantos, the Endbringer'))).toBe(true)
  })

  it('DCK-19: each saved version of a deck is asked about once', async () => {
    fetchFormatIssues.mockResolvedValue(verdict())
    const first = renderHook(() => useDeckLegality(deck()))
    await waitFor(() => expect(first.result.current.isValid).toBe(true))
    first.unmount()

    const again = renderHook(() => useDeckLegality(deck()))
    expect(again.result.current.isValid).toBe(true)
    expect(fetchFormatIssues).toHaveBeenCalledTimes(1)

    renderHook(() => useDeckLegality(deck({ updatedAt: 3 })))
    await waitFor(() => expect(fetchFormatIssues).toHaveBeenCalledTimes(2))
  })
})
