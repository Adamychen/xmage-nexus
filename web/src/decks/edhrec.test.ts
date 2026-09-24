import { beforeEach, describe, expect, it, vi, afterEach } from 'vitest'
import {
  collectSuggestionNames,
  edhrecSlug,
  fetchEdhrecCommander,
  parseEdhrecPage,
  resetEdhrecCacheForTests,
  resolveCardsByNames,
  edhrecPageUrl,
} from './edhrec'
import { resetScryfallClient, setScryfallPacing } from '../cards/scryfallClient'

function samplePayload() {
  return {
    container: {
      json_dict: {
        card: { name: 'Test Commander', num_decks: 1234 },
        cardlists: [
          {
            header: 'High Synergy Cards',
            tag: 'highsynergycards',
            cardviews: [
              { name: 'Sol Ring', synergy: 0.25, num_decks: 100, potential_decks: 1000 },
              { name: 'Arcane Signet', synergy: 0.1, num_decks: 90, potential_decks: 1000 },
            ],
          },
          {
            header: 'Creatures',
            tag: 'creatures',
            cardviews: [{ name: 'Llanowar Elves', synergy: -0.05, num_decks: 50, potential_decks: 1000 }],
          },
          { header: 'Empty', tag: 'empty', cardviews: [] },
        ],
      },
    },
  }
}

describe('edhrecSlug', () => {
  it('builds EDHREC slugs from commander names', () => {
    expect(edhrecSlug("Atraxa, Praetors' Voice")).toBe('atraxa-praetors-voice')
    expect(edhrecSlug("K'rrik, Son of Yawgmoth")).toBe('krrik-son-of-yawgmoth')
    expect(edhrecSlug('Lim-Dûl the Necromancer')).toBe('lim-dul-the-necromancer')
    expect(edhrecSlug('The Ur-Dragon')).toBe('the-ur-dragon')
    expect(edhrecSlug('  Muldrotha, the Gravetide  ')).toBe('muldrotha-the-gravetide')
  })

  it('builds the public page url with the same slug', () => {
    expect(edhrecPageUrl('The Ur-Dragon')).toBe('https://edhrec.com/commanders/the-ur-dragon')
  })
})

describe('parseEdhrecPage', () => {
  it('parses cardlists and skips empty ones', () => {
    const data = parseEdhrecPage('test-commander', samplePayload())
    expect(data).not.toBeNull()
    expect(data!.commanderName).toBe('Test Commander')
    expect(data!.numDecks).toBe(1234)
    expect(data!.lists.map((l) => l.tag)).toEqual(['highsynergycards', 'creatures'])
    expect(data!.lists[0].cards[0]).toEqual({
      name: 'Sol Ring',
      synergy: 0.25,
      numDecks: 100,
      potentialDecks: 1000,
    })
  })

  it('returns null when the payload has no usable lists', () => {
    expect(parseEdhrecPage('x', { container: { json_dict: { cardlists: [] } } })).toBeNull()
    expect(parseEdhrecPage('x', {})).toBeNull()
    expect(parseEdhrecPage('x', null)).toBeNull()
  })
})

describe('collectSuggestionNames', () => {
  it('dedupes across lists keeping list order and applies caps', () => {
    const data = parseEdhrecPage('x', samplePayload())!
    expect(collectSuggestionNames(data.lists, 12)).toEqual(['Sol Ring', 'Arcane Signet', 'Llanowar Elves'])
    expect(collectSuggestionNames(data.lists, 1)).toEqual(['Sol Ring', 'Llanowar Elves'])
    expect(collectSuggestionNames(data.lists, 12, 2)).toEqual(['Sol Ring', 'Arcane Signet'])
  })
})

describe('fetchEdhrecCommander', () => {
  beforeEach(() => {
    resetEdhrecCacheForTests()
  })
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('fetches and caches a commander page (memory hit avoids a second fetch)', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve(samplePayload()),
    })
    vi.stubGlobal('fetch', fetchMock)

    const first = await fetchEdhrecCommander('Test Commander')
    expect(first.status).toBe('ok')
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(fetchMock.mock.calls[0][0]).toBe('https://json.edhrec.com/pages/commanders/test-commander.json')

    const second = await fetchEdhrecCommander('Test Commander')
    expect(second.status).toBe('ok')
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('maps 404 to not_found', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 404 }))
    expect(await fetchEdhrecCommander('Unknown Dude')).toEqual({ status: 'not_found' })
  })

  it('maps network failures to error without caching them in memory', async () => {
    const fetchMock = vi.fn().mockRejectedValue(new Error('offline'))
    vi.stubGlobal('fetch', fetchMock)
    expect(await fetchEdhrecCommander('Test Commander')).toEqual({ status: 'error' })
    expect(await fetchEdhrecCommander('Test Commander')).toEqual({ status: 'error' })
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })
})

describe('resolveCardsByNames', () => {
  beforeEach(() => {
    resetScryfallClient()
    setScryfallPacing({ spacingMs: 0 })
  })
  afterEach(() => {
    vi.unstubAllGlobals()
    resetScryfallClient()
  })

  function collectionResponse(names: string[]) {
    return {
      object: 'list',
      data: names.map((name) => ({
        id: `id-${name}`,
        name,
        set: 'tst',
        collector_number: '1',
        cmc: 1,
        type_line: 'Artifact',
        colors: [],
        color_identity: [],
      })),
      not_found: [],
    }
  }

  function stubCollectionFetch() {
    const calls: Array<{ url: string; body: { identifiers: Array<{ name: string }> } }> = []
    const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body)) as { identifiers: Array<{ name: string }> }
      calls.push({ url, body })
      return {
        ok: true,
        status: 200,
        json: () => Promise.resolve(collectionResponse(body.identifiers.map((i) => i.name))),
      } as unknown as Response
    })
    vi.stubGlobal('fetch', fetchMock)
    return calls
  }

  it('batches names into chunks of 75 and indexes them lowercase', async () => {
    const calls = stubCollectionFetch()
    const names = Array.from({ length: 80 }, (_, i) => `Card ${i}`)
    const resolved = await resolveCardsByNames(names)
    expect(calls).toHaveLength(2)
    expect(calls[0].url).toBe('https://api.scryfall.com/cards/collection')
    expect(calls[0].body.identifiers).toHaveLength(75)
    expect(calls[1].body.identifiers).toHaveLength(5)
    expect(resolved.get('card 0')?.name).toBe('Card 0')
    expect(resolved.get('card 79')?.set).toBe('tst')
  })

  it('also indexes double-faced cards by their front-face name', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({
      ok: true,
      status: 200,
      json: () =>
        Promise.resolve({
          object: 'list',
          data: [
            {
              id: 'dfc-1',
              name: 'Bala Ged Recovery // Bala Ged Sanctuary',
              set: 'znr',
              collector_number: '180',
              cmc: 3,
              type_line: 'Sorcery',
              colors: ['G'],
              color_identity: ['G'],
              card_faces: [{ name: 'Bala Ged Recovery' }, { name: 'Bala Ged Sanctuary' }],
            },
          ],
          not_found: [],
        }),
    }) as unknown as Response))
    const resolved = await resolveCardsByNames(['Bala Ged Recovery'])
    expect(resolved.get('bala ged recovery')?.id).toBe('dfc-1')
  })

  it('tolerates failed batches and keeps the rest', async () => {
    let call = 0
    vi.stubGlobal('fetch', vi.fn(async () => {
      call++
      if (call === 1) throw new TypeError('Failed to fetch')
      return {
        ok: true,
        status: 200,
        json: () => Promise.resolve(collectionResponse(['Card 75'])),
      } as unknown as Response
    }))
    const names = Array.from({ length: 76 }, (_, i) => `Card ${i}`)
    const resolved = await resolveCardsByNames(names)
    expect(resolved.size).toBe(1)
    expect(resolved.get('card 75')?.name).toBe('Card 75')
  })
})
