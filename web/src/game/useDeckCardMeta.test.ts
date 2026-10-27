// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { fetchCardJson, type ScryfallCardJson } from '../cards/scryfallCards'
import type { Deck } from '../lobby/decks'
import { cardTypesFromTypeLine, deckCardMetaFromScryfall, useDeckCardMeta } from './useDeckCardMeta'

vi.mock('../cards/scryfallCards', () => ({
  fetchCardJson: vi.fn(),
}))

const fetchMock = vi.mocked(fetchCardJson)

const deck: Deck = {
  name: 'Korvold',
  cards: [
    { cardName: 'Grizzly Bears', amount: 4, setCode: 'M10', cardNumber: '200' },
    { cardName: 'Sol Ring', amount: 1, setCode: 'C21', cardNumber: '263' },
    { cardName: 'Mountain', amount: 10, setCode: 'LEA', cardNumber: '292' },
  ],
  sideboard: [],
}

const bears: ScryfallCardJson = {
  name: 'Grizzly Bears',
  mana_cost: '{1}{G}',
  cmc: 2,
  type_line: 'Creature — Bear',
  colors: ['G'],
}

const solRing: ScryfallCardJson = {
  name: 'Sol Ring',
  mana_cost: '{1}',
  cmc: 1,
  type_line: 'Artifact',
  colors: [],
}

describe('useDeckCardMeta', () => {
  beforeEach(() => {
    fetchMock.mockReset()
    fetchMock.mockImplementation(async (card) => {
      if (card.cardName === 'Grizzly Bears') return bears
      if (card.cardName === 'Sol Ring') return solRing
      return null
    })
  })

  it('fetches every non-basic card once and keys the meta by the lower-cased name', async () => {
    const { result, rerender } = renderHook(({ d }) => useDeckCardMeta(d), { initialProps: { d: deck } })
    expect(result.current.loading).toBe(true)
    await waitFor(() => expect(result.current.loading).toBe(false))

    expect(result.current.meta.get('grizzly bears')).toEqual({
      manaCost: '{1}{G}',
      manaValue: 2,
      cardTypes: ['CREATURE'],
      colors: ['G'],
    })
    expect(result.current.meta.get('sol ring')?.cardTypes).toEqual(['ARTIFACT'])
    expect(result.current.meta.has('mountain')).toBe(false)
    expect(result.current.missing).toBe(0)
    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(fetchMock).toHaveBeenCalledWith(
      { cardName: 'Grizzly Bears', setCode: 'M10', cardNumber: '200' },
      { fallbackToName: true },
    )

    rerender({ d: { ...deck, cards: [...deck.cards] } })
    expect(result.current.loading).toBe(false)
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('counts a card that Scryfall cannot resolve as missing and does not guess its type', async () => {
    fetchMock.mockImplementation(async (card) => (card.cardName === 'Grizzly Bears' ? bears : null))
    const { result } = renderHook(() => useDeckCardMeta(deck))
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.meta.has('sol ring')).toBe(false)
    expect(result.current.meta.has('grizzly bears')).toBe(true)
    expect(result.current.missing).toBe(1)
  })

  it('is not loading for a deck of basic lands only', async () => {
    const lands: Deck = { name: 'Lands', cards: [{ cardName: 'Island', amount: 20, setCode: '', cardNumber: '0' }], sideboard: [] }
    const { result } = renderHook(() => useDeckCardMeta(lands))
    expect(result.current.loading).toBe(false)
    expect(result.current.meta.size).toBe(0)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('is empty and not loading without a deck', () => {
    const { result } = renderHook(() => useDeckCardMeta(null))
    expect(result.current.loading).toBe(false)
    expect(result.current.meta.size).toBe(0)
  })
})

describe('card type and metadata parsing', () => {
  it('reads the card types of the front face in upper case, in type-line order', () => {
    expect(cardTypesFromTypeLine('Legendary Artifact Creature — Golem')).toEqual(['ARTIFACT', 'CREATURE'])
    expect(cardTypesFromTypeLine('Basic Land — Mountain')).toEqual(['LAND'])
    expect(cardTypesFromTypeLine('Instant // Sorcery')).toEqual(['INSTANT'])
    expect(cardTypesFromTypeLine('Tribal Instant — Goblin')).toEqual(['INSTANT'])
    expect(cardTypesFromTypeLine('Creature — Sorcery Adept')).toEqual(['CREATURE'])
  })

  it('takes the cost, colours and type of the front face of a multi-face card', () => {
    const delver: ScryfallCardJson = {
      name: 'Delver of Secrets // Insectile Aberration',
      cmc: 1,
      card_faces: [
        { name: 'Delver of Secrets', mana_cost: '{U}', type_line: 'Creature — Human Wizard', colors: ['U'] },
        { name: 'Insectile Aberration', type_line: 'Creature — Insect Horror', colors: ['U'] },
      ],
    }
    expect(deckCardMetaFromScryfall(delver)).toEqual({
      manaCost: '{U}',
      manaValue: 1,
      cardTypes: ['CREATURE'],
      colors: ['U'],
    })
  })

  it('returns no metadata for a card JSON without any type', () => {
    expect(deckCardMetaFromScryfall({ name: 'Unknown' })).toBeNull()
  })
})
