import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import { useDeckMetadata } from './useDeckMetadata'
import { isMetaLoaded } from './metaLoaded'
import { resetCardArtPreferences, setCardArtPreference } from '../cards/artPreferences'
import { getCachedCardName } from '../cards/cardLocalization'
import { fetchCardJson } from '../cards/scryfallCards'
import { resetScryfallClient, setScryfallPacing } from '../cards/scryfallClient'
import type { DeckCard } from '../lobby/decks'

function scryfallCard(imageUrl: string) {
  return {
    name: 'Lightning Bolt',
    mana_cost: '{R}',
    cmc: 1,
    type_line: 'Instant',
    colors: ['R'],
    image_uris: { normal: imageUrl },
  }
}

describe('useDeckMetadata printing changes', () => {
  beforeEach(() => {
    vi.unstubAllGlobals()
    resetCardArtPreferences()
  })

  it('refetches when the same card name arrives with a new set/number', async () => {
    const fetchMock = vi.fn().mockImplementation((url: string) => {
      const imageUrl = url.includes('/lea/161') ? 'https://img.test/lea-bolt.jpg' : 'https://img.test/m10-bolt.jpg'
      return Promise.resolve({ ok: true, json: () => Promise.resolve(scryfallCard(imageUrl)) })
    })
    vi.stubGlobal('fetch', fetchMock)

    const { result } = renderHook(() => useDeckMetadata())
    const bolt = (setCode: string, cardNumber: string): DeckCard => ({ cardName: 'Lightning Bolt', setCode, cardNumber, amount: 4 })

    act(() => {
      result.current.updateMetaForDeck([bolt('M10', '146')])
    })
    await waitFor(() => expect(result.current.metaMap.get('M10/146')?.imageUrl).toBe('https://img.test/m10-bolt.jpg'))

    fetchMock.mockClear()
    act(() => {
      result.current.updateMetaForDeck([bolt('LEA', '161')])
    })
    await waitFor(() => expect(result.current.metaMap.get('LEA/161')?.imageUrl).toBe('https://img.test/lea-bolt.jpg'))
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(fetchMock.mock.calls[0][0]).toContain('/lea/161')
    expect(result.current.metaMap.get('lightning bolt')?.imageUrl).toBe('https://img.test/lea-bolt.jpg')
  })

  it('does not refetch a known printing nor a printing-less card by name', async () => {
    const fetchMock = vi.fn().mockImplementation(() =>
      Promise.resolve({ ok: true, json: () => Promise.resolve(scryfallCard('https://img.test/x.jpg')) }),
    )
    vi.stubGlobal('fetch', fetchMock)

    const { result } = renderHook(() => useDeckMetadata())
    const bolt = (setCode: string, cardNumber: string): DeckCard => ({ cardName: 'Lightning Bolt', setCode, cardNumber, amount: 4 })

    act(() => {
      result.current.updateMetaForDeck([bolt('M10', '146')])
    })
    await waitFor(() => expect(result.current.metaMap.has('M10/146')).toBe(true))
    fetchMock.mockClear()

    act(() => {
      result.current.updateMetaForDeck([bolt('M10', '146')])
    })
    expect(fetchMock).not.toHaveBeenCalled()

    act(() => {
      result.current.updateMetaForDeck([{ cardName: 'Mystery', setCode: '', cardNumber: '0', amount: 1 }])
    })
    await waitFor(() => expect(result.current.metaMap.has('mystery')).toBe(true))
    fetchMock.mockClear()
    act(() => {
      result.current.updateMetaForDeck([{ cardName: 'Mystery', setCode: '', cardNumber: '0', amount: 1 }])
    })
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('dedup llamadas solapadas antes de resolver (AUDIT)', async () => {
    let resolveFetch!: (v: unknown) => void
    const fetchMock = vi.fn().mockImplementation(
      () => new Promise((res) => { resolveFetch = res as (v: unknown) => void }),
    )
    vi.stubGlobal('fetch', fetchMock)

    const { result } = renderHook(() => useDeckMetadata())
    const bolt: DeckCard = { cardName: 'Lightning Bolt', setCode: 'M10', cardNumber: '146', amount: 4 }
    act(() => {
      result.current.updateMetaForDeck([bolt])
      result.current.updateMetaForDeck([bolt])
    })
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1))
    await act(async () => {
      resolveFetch({ ok: true, json: () => Promise.resolve(scryfallCard('https://img.test/m10-bolt.jpg')) })
    })
    await waitFor(() => expect(result.current.metaMap.has('M10/146')).toBe(true))
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('no envenena la caché con el nombre de otra impresión (AUDIT)', async () => {
    const fetchMock = vi.fn().mockImplementation(() =>
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ name: 'Armored Griffin', printed_name: 'Grifo acorazado', type_line: 'Creature — Griffin' }),
      }),
    )
    vi.stubGlobal('fetch', fetchMock)

    const { result } = renderHook(() => useDeckMetadata())
    act(() => {
      result.current.updateMetaForDeck([{ cardName: 'Sidar Kondo of Jamuraa', setCode: 'PC2', cardNumber: '1', amount: 1 }])
    })
    await waitFor(() => expect(fetchMock).toHaveBeenCalled())
    await waitFor(() => expect(getCachedCardName('Armored Griffin', 'es')).toBe('Grifo acorazado'))
    expect(getCachedCardName('Sidar Kondo of Jamuraa', 'es')).toBeNull()
  })

  it('usa la impresión preferida del jugador y la deja también bajo la clave del mazo', async () => {
    const fetchMock = vi.fn().mockImplementation((url: string) => {
      const imageUrl = url.includes('/zen/246') ? 'https://img.test/pref.jpg' : 'https://img.test/default.jpg'
      return Promise.resolve({ ok: true, json: () => Promise.resolve(scryfallCard(imageUrl)) })
    })
    vi.stubGlobal('fetch', fetchMock)
    setCardArtPreference('Lightning Bolt', 'ZEN', '246')

    const { result } = renderHook(() => useDeckMetadata())
    act(() => {
      result.current.updateMetaForDeck([{ cardName: 'Lightning Bolt', setCode: 'M10', cardNumber: '146', amount: 4 }])
    })
    await waitFor(() => expect(result.current.metaMap.get('M10/146')?.imageUrl).toBe('https://img.test/pref.jpg'))
    expect(result.current.metaMap.get('lightning bolt')?.imageUrl).toBe('https://img.test/pref.jpg')
    expect(fetchMock.mock.calls[0][0]).toContain('/zen/246')
  })

  it('no comparte imagen entre cartas sin set/número (import de texto plano) (AUDIT)', async () => {
    const fetchMock = vi.fn().mockImplementation((url: string) => {
      const name = decodeURIComponent(url.split('exact=')[1] ?? '')
      const card = name === 'Sol Ring'
        ? { name: 'Sol Ring', mana_cost: '{1}', cmc: 1, type_line: 'Artifact', colors: [], image_uris: { normal: 'https://img.test/sol-ring.jpg' } }
        : { name: 'Arcane Signet', mana_cost: '{1}', cmc: 1, type_line: 'Artifact', colors: [], image_uris: { normal: 'https://img.test/arcane-signet.jpg' } }
      return Promise.resolve({ ok: true, json: () => Promise.resolve(card) })
    })
    vi.stubGlobal('fetch', fetchMock)

    const { result } = renderHook(() => useDeckMetadata())
    act(() => {
      result.current.updateMetaForDeck([
        { cardName: 'Sol Ring', setCode: '', cardNumber: '', amount: 1 },
        { cardName: 'Arcane Signet', setCode: '', cardNumber: '', amount: 1 },
      ])
    })
    await waitFor(() => expect(result.current.metaMap.get('sol ring')?.imageUrl).toBe('https://img.test/sol-ring.jpg'))
    await waitFor(() => expect(result.current.metaMap.get('arcane signet')?.imageUrl).toBe('https://img.test/arcane-signet.jpg'))
    // La clave "/" (setCode y cardNumber vacíos) no debe existir: si existiera,
    // pisaría la búsqueda por nombre y todas las cartas sin impresión mostrarían
    // la imagen de la última resuelta.
    expect(result.current.metaMap.has('/')).toBe(false)
  })
})

function jsonResponse(body: unknown, code = 200) {
  return { ok: code < 400, status: code, json: () => Promise.resolve(body), headers: { get: () => null } }
}

const swiftspear: DeckCard = { cardName: 'Monastery Swiftspear', setCode: '', cardNumber: '', amount: 4 }

describe('DCK-11 deck metadata when Scryfall is busy or unavailable', () => {
  beforeEach(() => {
    vi.unstubAllGlobals()
    resetCardArtPreferences()
    resetScryfallClient()
    setScryfallPacing({ spacingMs: 0, maxConcurrent: 3 })
  })
  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })

  it('DCK-11: a deck card is requested ahead of catalogue thumbnails queued before it', async () => {
    setScryfallPacing({ maxConcurrent: 1 })
    const requested: string[] = []
    vi.stubGlobal('fetch', vi.fn((url: string) => {
      requested.push(url)
      return Promise.resolve(jsonResponse(scryfallCard('https://img.test/swiftspear.jpg')))
    }))
    for (let i = 0; i < 20; i++) {
      void fetchCardJson({ cardName: `Catalogue ${i}`, setCode: 'M10', cardNumber: String(i + 1) }, { fallbackToName: true })
    }

    const { result } = renderHook(() => useDeckMetadata())
    act(() => {
      result.current.updateMetaForDeck([swiftspear])
    })

    await waitFor(() => expect(result.current.metaMap.get('monastery swiftspear')?.imageUrl).toBe('https://img.test/swiftspear.jpg'), { timeout: 3000 })
    expect(requested.findIndex((url) => url.includes('Monastery'))).toBeLessThanOrEqual(2)
  })

  it('DCK-11: a card whose request fails is requested again and loads', async () => {
    const fetchMock = vi.fn()
      .mockRejectedValueOnce(new TypeError('Failed to fetch'))
      .mockImplementation(() => Promise.resolve(jsonResponse(scryfallCard('https://img.test/retry.jpg'))))
    vi.stubGlobal('fetch', fetchMock)

    const { result } = renderHook(() => useDeckMetadata())
    act(() => {
      result.current.updateMetaForDeck([swiftspear])
    })

    await waitFor(() => expect(result.current.metaMap.get('monastery swiftspear')?.imageUrl).toBe('https://img.test/retry.jpg'), { timeout: 3000 })
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('DCK-11: a card that never loads stays in the Loading pile with its name once the retries are spent', async () => {
    vi.useFakeTimers()
    const fetchMock = vi.fn(() => Promise.reject(new TypeError('Failed to fetch')))
    vi.stubGlobal('fetch', fetchMock)

    const { result } = renderHook(() => useDeckMetadata())
    act(() => {
      result.current.updateMetaForDeck([swiftspear])
    })
    await act(async () => {
      await vi.advanceTimersByTimeAsync(120_000)
    })

    const meta = result.current.metaMap.get('monastery swiftspear')
    expect(meta).toBeDefined()
    expect(meta?.name).toBe('Monastery Swiftspear')
    expect(isMetaLoaded(meta)).toBe(false)
    expect(meta?.imageUrl ?? null).toBeNull()
    expect(meta?.cmc).toBeUndefined()
    expect(fetchMock.mock.calls.length).toBe(5)
  })

  it('DCK-11: a card whose Scryfall rate-limit window is still closed loads when the window reopens', async () => {
    vi.useFakeTimers()
    const opensAt = Date.now() + 40_000
    const fetchMock = vi.fn(() => Date.now() < opensAt
      ? Promise.reject(new TypeError('Failed to fetch'))
      : Promise.resolve(jsonResponse(scryfallCard('https://img.test/window.jpg'))))
    vi.stubGlobal('fetch', fetchMock)

    const { result } = renderHook(() => useDeckMetadata())
    act(() => {
      result.current.updateMetaForDeck([swiftspear])
    })
    await act(async () => {
      await vi.advanceTimersByTimeAsync(90_000)
    })

    expect(result.current.metaMap.get('monastery swiftspear')?.imageUrl).toBe('https://img.test/window.jpg')
  })

  it('DCK-11: a printing Scryfall does not know falls back to the card by name', async () => {
    vi.stubGlobal('fetch', vi.fn((url: string) =>
      Promise.resolve(url.includes('/cards/xyz/1')
        ? jsonResponse({}, 404)
        : jsonResponse(scryfallCard('https://img.test/named.jpg'))),
    ))

    const { result } = renderHook(() => useDeckMetadata())
    act(() => {
      result.current.updateMetaForDeck([{ cardName: 'Adeline, Resplendent Cathar', setCode: 'XYZ', cardNumber: '1', amount: 1 }])
    })

    await waitFor(() => expect(result.current.metaMap.get('XYZ/1')?.imageUrl).toBe('https://img.test/named.jpg'))
  })

  it('DCK-11: a card dropped from the metadata map is looked up again', async () => {
    vi.stubGlobal('fetch', vi.fn(() => Promise.resolve(jsonResponse(scryfallCard('https://img.test/swiftspear.jpg')))))

    const { result } = renderHook(() => useDeckMetadata())
    act(() => {
      result.current.updateMetaForDeck([swiftspear])
    })
    await waitFor(() => expect(result.current.metaMap.has('monastery swiftspear')).toBe(true))

    act(() => {
      result.current.setMetaMap(new Map())
    })
    act(() => {
      result.current.updateMetaForDeck([swiftspear])
    })

    await waitFor(() => expect(result.current.metaMap.get('monastery swiftspear')?.imageUrl).toBe('https://img.test/swiftspear.jpg'))
  })
})

