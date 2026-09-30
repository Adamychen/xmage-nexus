import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { renderHook } from '@testing-library/react'
import {
  getCachedCardName,
  setCachedCardName,
  fetchLocalizedCardName,
  fetchLocalizedCardText,
  getCachedCardText,
  isUuidLikeCardName,
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

  it('fetchLocalizedCardText resuelve nombre, tipo y reglas de la impresión localizada', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        name: 'The One Ring',
        printed_name: 'El Anillo Único',
        printed_type_line: 'Artefacto legendario',
        printed_text: 'Indestructible.\nCuando El Anillo Único entre al campo de batalla, obtienes protección.',
      }),
    } as Response)

    const card = makeMockCard({ name: 'The One Ring', expansionSetCode: 'LTR', cardNumber: '246' })
    const text = await fetchLocalizedCardText(card, 'es')

    expect(text?.name).toBe('El Anillo Único')
    expect(text?.typeLine).toBe('Artefacto legendario')
    expect(text?.rules).toEqual([
      'Indestructible.',
      'Cuando El Anillo Único entre al campo de batalla, obtienes protección.',
    ])
    expect(getCachedCardText('The One Ring', 'es')?.name).toBe('El Anillo Único')
  })

  it('fetchLocalizedCardText cae a la búsqueda por nombre si la impresión no existe', async () => {
    vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce({ ok: false, status: 404 } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: [
            {
              name: 'Counterspell',
              printed_name: 'Contromagia',
              printed_type_line: 'Istantaneo',
              printed_text: 'Annulla una magia bersaglio.',
            },
          ],
        }),
      } as Response)

    const card = makeMockCard({ name: 'Counterspell', expansionSetCode: 'TST', cardNumber: '7' })
    const text = await fetchLocalizedCardText(card, 'it')

    expect(text?.name).toBe('Contromagia')
    expect(text?.rules).toEqual(['Annulla una magia bersaglio.'])
  })

  it('fetchLocalizedCardText empareja la cara pedida de una carta de doble cara', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        name: 'Delver of Secrets // Insectile Aberration',
        card_faces: [
          { name: 'Delver of Secrets', printed_name: 'Delver de Secretos', printed_type_line: 'Criatura — Humano Hechicero', printed_text: 'Al comienzo...' },
          { name: 'Insectile Aberration', printed_name: 'Aberración Insectil', printed_type_line: 'Criatura — Insecto', printed_text: 'Vuela.' },
        ],
      }),
    } as Response)

    const card = makeMockCard({ name: 'Insectile Aberration', expansionSetCode: 'ISD', cardNumber: '51' })
    const text = await fetchLocalizedCardText(card, 'es')

    expect(text?.name).toBe('Aberración Insectil')
    expect(text?.typeLine).toBe('Criatura — Insecto')
    expect(text?.rules).toEqual(['Vuela.'])
  })

  it('fetchLocalizedCardText no pide red en inglés', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch')
    const card = makeMockCard({ name: 'Lightning Bolt' })
    expect(await fetchLocalizedCardText(card, 'en')).toBeNull()
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it('no pide red para nombres-UUID del pool CONSTRUCT sin nombres', async () => {
    const uuid = '37094b2c-7d96-4491-9041-80d14cc8d5d1'
    expect(isUuidLikeCardName(uuid)).toBe(true)
    expect(isUuidLikeCardName('Lightning Bolt')).toBe(false)
    const fetchSpy = vi.spyOn(globalThis, 'fetch')
    const card = makeMockCard({ name: uuid })
    expect(await fetchLocalizedCardName(card, 'es')).toBeNull()
    expect(fetchSpy).not.toHaveBeenCalled()
  })
})
