import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import { useDeckMetadata } from './useDeckMetadata'
import { getCachedCardName } from '../cards/cardLocalization'
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
    expect(fetchMock).toHaveBeenCalledTimes(1)
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
})

