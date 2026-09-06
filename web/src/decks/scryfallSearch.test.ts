import { describe, it, expect, vi } from 'vitest'
import {
  scryfallCardImage,
  scryfallCardBackImage,
  scryfallCardArtCrop,
  type ScryfallSearchCard,
} from './scryfallSearch'

describe('scryfallSearch', () => {
  const singleFaceCard: ScryfallSearchCard = {
    id: 'card-1',
    name: 'Lightning Bolt',
    set: 'M10',
    collector_number: '146',
    cmc: 1,
    mana_cost: '{R}',
    type_line: 'Instant',
    colors: ['R'],
    color_identity: ['R'],
    image_uris: {
      small: 'https://cards.scryfall.io/small/bolt.jpg',
      normal: 'https://cards.scryfall.io/normal/bolt.jpg',
      art_crop: 'https://cards.scryfall.io/art_crop/bolt.jpg',
    },
  }

  const doubleFaceCard: ScryfallSearchCard = {
    id: 'card-2',
    name: 'Delver of Secrets // Insectile Aberration',
    set: 'ISD',
    collector_number: '51',
    cmc: 1,
    mana_cost: '{U}',
    type_line: 'Creature — Human Wizard',
    colors: ['U'],
    color_identity: ['U'],
    card_faces: [
      {
        image_uris: {
          small: 'https://cards.scryfall.io/small/delver_front.jpg',
          normal: 'https://cards.scryfall.io/normal/delver_front.jpg',
          art_crop: 'https://cards.scryfall.io/art_crop/delver_front.jpg',
        },
        mana_cost: '{U}',
        type_line: 'Creature — Human Wizard',
      },
      {
        image_uris: {
          small: 'https://cards.scryfall.io/small/delver_back.jpg',
          normal: 'https://cards.scryfall.io/normal/delver_back.jpg',
          art_crop: 'https://cards.scryfall.io/art_crop/delver_back.jpg',
        },
        type_line: 'Creature — Human Insect',
      },
    ],
  }

  it('extracts normal card image correctly', () => {
    expect(scryfallCardImage(singleFaceCard)).toBe('https://cards.scryfall.io/normal/bolt.jpg')
    expect(scryfallCardImage(doubleFaceCard)).toBe('https://cards.scryfall.io/normal/delver_front.jpg')
  })

  it('extracts back face card image correctly', () => {
    expect(scryfallCardBackImage(singleFaceCard)).toBeNull()
    expect(scryfallCardBackImage(doubleFaceCard)).toBe('https://cards.scryfall.io/normal/delver_back.jpg')
  })

  it('extracts art crop image correctly', () => {
    expect(scryfallCardArtCrop(singleFaceCard)).toBe('https://cards.scryfall.io/art_crop/bolt.jpg')
    expect(scryfallCardArtCrop(doubleFaceCard)).toBe('https://cards.scryfall.io/art_crop/delver_front.jpg')
  })

  it('handles language parameter in searchScryfall', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ data: [{ id: '1', name: 'Lightning Bolt', printed_name: 'Relámpago', lang: 'es' }], has_more: false }),
    } as any)

    const { searchScryfall } = await import('./scryfallSearch')
    const res = await searchScryfall('Relámpago', 1, 'es')
    expect(res.data).toHaveLength(1)
    expect(res.data[0].printed_name).toBe('Relámpago')
    expect(fetchSpy).toHaveBeenCalledWith(
      expect.stringContaining('lang%3Aes%20Rel%C3%A1mpago'),
      expect.any(Object),
    )
    fetchSpy.mockRestore()
  })

  it('defaults to order=cmc&dir=asc (U6-1)', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ data: [], has_more: false }),
    } as any)

    const { searchScryfall } = await import('./scryfallSearch')
    await searchScryfall('bolt')
    const url = String(fetchSpy.mock.calls[0][0])
    expect(url).toContain('order=cmc')
    expect(url).toContain('dir=asc')
    fetchSpy.mockRestore()
  })

  it('passes order and dir to Scryfall (U6-1)', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ data: [], has_more: false }),
    } as any)

    const { searchScryfall } = await import('./scryfallSearch')
    await searchScryfall('bolt', 1, undefined, 'name', 'desc')
    const url = String(fetchSpy.mock.calls[0][0])
    expect(url).toContain('order=name')
    expect(url).toContain('dir=desc')
    await searchScryfall('bolt', 2, undefined, 'edhrec', 'asc')
    const url2 = String(fetchSpy.mock.calls[1][0])
    expect(url2).toContain('order=edhrec')
    expect(url2).toContain('dir=asc')
    expect(url2).toContain('page=2')
    fetchSpy.mockRestore()
  })

  it('does not refetch unfiltered when a later page is empty (U6-1)', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ data: [], has_more: false }),
    } as any)

    const { searchScryfall } = await import('./scryfallSearch')
    const res = await searchScryfall('bolt', 3, 'es')
    expect(res.data).toHaveLength(0)
    expect(fetchSpy).toHaveBeenCalledTimes(1)
    expect(String(fetchSpy.mock.calls[0][0])).toContain('lang%3Aes')
    fetchSpy.mockRestore()
  })
})

