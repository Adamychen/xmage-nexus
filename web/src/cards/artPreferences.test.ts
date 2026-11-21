import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { applyArtPreferences, cardArtPreference, resetCardArtPreferences, setCardArtPreference } from './artPreferences'

describe('artPreferences', () => {
  const mockStorage: Record<string, string> = {}

  beforeEach(() => {
    for (const k of Object.keys(mockStorage)) delete mockStorage[k]
    vi.stubGlobal('localStorage', {
      getItem: (key: string) => mockStorage[key] ?? null,
      setItem: (key: string, value: string) => {
        mockStorage[key] = value
      },
      removeItem: (key: string) => {
        delete mockStorage[key]
      },
      clear: () => {
        for (const k of Object.keys(mockStorage)) delete mockStorage[k]
      },
    })
    resetCardArtPreferences()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('guarda y lee la impresión por nombre (case-insensitive)', () => {
    setCardArtPreference('Lightning Bolt', 'LEA', '161')
    expect(cardArtPreference('lightning bolt')).toEqual({ setCode: 'LEA', cardNumber: '161' })
    expect(cardArtPreference('Shock')).toBeNull()
    expect(cardArtPreference(null)).toBeNull()
  })

  it('indexa las caras de una carta doble (cara trasera incluida)', () => {
    setCardArtPreference('Delver of Secrets // Insectile Aberration', 'ISD', '51')
    expect(cardArtPreference('Delver of Secrets // Insectile Aberration')).toEqual({ setCode: 'ISD', cardNumber: '51' })
    expect(cardArtPreference('Insectile Aberration')).toEqual({ setCode: 'ISD', cardNumber: '51' })
    expect(cardArtPreference('Delver of Secrets')).toEqual({ setCode: 'ISD', cardNumber: '51' })
  })

  it('persiste en localStorage y sobrevive a un reload del módulo', async () => {
    setCardArtPreference('Lightning Bolt', 'LEA', '161')
    vi.resetModules()
    const fresh = await import('./artPreferences')
    expect(fresh.cardArtPreference('Lightning Bolt')).toEqual({ setCode: 'LEA', cardNumber: '161' })
  })
it('DCK-32: keeps the server-confirmed flag across a reload', async () => {
    setCardArtPreference('Lightning Bolt', 'LEA', '161', true)
    vi.resetModules()
    const fresh = await import('./artPreferences')
    expect(fresh.cardArtPreference('Lightning Bolt')).toEqual({ setCode: 'LEA', cardNumber: '161', onServer: true })
  })

  it('DCK-32: sends a server-confirmed printing with the deck, in every list', () => {
    setCardArtPreference('Lightning Bolt', 'LEA', '161', true)
    setCardArtPreference('Sol Ring', 'SLD', '1011')
    const deck = applyArtPreferences({
      name: 'd',
      cards: [
        { cardName: 'Lightning Bolt', setCode: 'M10', cardNumber: '146', amount: 4 },
        { cardName: 'Sol Ring', setCode: 'C21', cardNumber: '263', amount: 1 },
        { cardName: 'Shock', setCode: 'M21', cardNumber: '159', amount: 4 },
      ],
      sideboard: [{ cardName: 'Lightning Bolt', setCode: '2XM', cardNumber: '130', amount: 1 }],
      commanders: [{ cardName: 'Lightning Bolt', setCode: 'M10', cardNumber: '146', amount: 1 }],
    })
    expect(deck.cards).toEqual([
      { cardName: 'Lightning Bolt', setCode: 'LEA', cardNumber: '161', amount: 4 },
      { cardName: 'Sol Ring', setCode: 'C21', cardNumber: '263', amount: 1 },
      { cardName: 'Shock', setCode: 'M21', cardNumber: '159', amount: 4 },
    ])
    expect(deck.sideboard[0]).toMatchObject({ setCode: 'LEA', cardNumber: '161' })
    expect(deck.commanders?.[0]).toMatchObject({ setCode: 'LEA', cardNumber: '161' })
  })
})
