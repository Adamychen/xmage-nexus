import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { renderHook } from '@testing-library/react'
import {
  getCachedCardName,
  setCachedCardName,
  fetchLocalizedCardName,
  useLocalizedCardName,
  resetCardLocalizationCacheForTest,
} from './cardLocalization'
import type { CardView } from '../net/types'

function makeMockCard(overrides: Partial<CardView> = {}): CardView {
  const name = overrides.name ?? 'Card'
  return {
    id: 'c-1',
    name,
    displayName: overrides.displayName ?? name,
    rules: [],
    power: '0',
    toughness: '0',
    loyalty: '',
    defense: '',
    cardTypes: [],
    subTypes: [],
    superTypes: [],
    color: {},
    manaCostLeftStr: [],
    manaCostRightStr: [],
    manaValue: 0,
    targets: [],
    counters: [],
    ...overrides,
  }
}

describe('cardLocalization', () => {
  beforeEach(() => {
    resetCardLocalizationCacheForTest()
    try {
      localStorage.clear()
    } catch {}
    vi.restoreAllMocks()
  })

  afterEach(() => {
    resetCardLocalizationCacheForTest()
  })

  it('returns english name directly when lang is en', () => {
    expect(getCachedCardName('Lightning Bolt', 'en')).toBe('Lightning Bolt')
  })

  it('caches and retrieves translated card names', () => {
    expect(getCachedCardName('Lightning Bolt', 'it')).toBeNull()
    setCachedCardName('Lightning Bolt', 'Fulmine', 'it')
    expect(getCachedCardName('Lightning Bolt', 'it')).toBe('Fulmine')
  })

  it('hook useLocalizedCardName returns cached name when available', () => {
    setCachedCardName('Counterspell', 'Contromagia', 'it')
    const card = makeMockCard({ name: 'Counterspell' })

    const { result } = renderHook(() => useLocalizedCardName(card))
    expect(result.current.originalName).toBe('Counterspell')
    expect(result.current.displayName).toBeDefined()
  })

  it('fetchLocalizedCardName resolves from Scryfall search API mock', async () => {
    const mockResponse = {
      data: [
        {
          name: 'Lightning Bolt',
          printed_name: 'Fulmine',
        },
      ],
    }
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: true,
      json: async () => mockResponse,
    } as Response)

    const card = makeMockCard({ name: 'Lightning Bolt' })

    const translated = await fetchLocalizedCardName(card, 'it')
    expect(translated).toBe('Fulmine')
    expect(getCachedCardName('Lightning Bolt', 'it')).toBe('Fulmine')
  })

  it('handles ability card by resolving sourceCard with direct endpoint', async () => {
    const mockDirectCard = {
      name: 'Llanowar Elves',
      printed_name: 'Elfi di Llanowar',
    }
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: true,
      json: async () => mockDirectCard,
    } as Response)

    const abilityCard = makeMockCard({
      name: 'Ability',
      displayName: 'Ability',
      mageObjectType: 'ABILITY_STACK_FROM_CARD',
      sourceCard: makeMockCard({
        name: 'Llanowar Elves',
        displayName: 'Llanowar Elves',
        expansionSetCode: 'M11',
        cardNumber: '180',
      }),
    })

    const translated = await fetchLocalizedCardName(abilityCard, 'it')
    expect(translated).toBe('Elfi di Llanowar')
    expect(getCachedCardName('Llanowar Elves', 'it')).toBe('Elfi di Llanowar')
  })

  it('localizes DeckCard instances seamlessly', async () => {
    setCachedCardName('Lightning Bolt', 'Relámpago', 'es')
    const deckCard = { cardName: 'Lightning Bolt', setCode: 'M10', cardNumber: '146', amount: 4 }

    const { result } = renderHook(() => useLocalizedCardName(deckCard))
    expect(result.current.originalName).toBe('Lightning Bolt')
    expect(result.current.displayName).toBe('Relámpago')
  })
})
