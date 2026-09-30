import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cardArtPreference, resetCardArtPreferences, setCardArtPreference } from './artPreferences'

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
})
