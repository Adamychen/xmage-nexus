import { afterEach, describe, expect, it, vi } from 'vitest'
import { scryfallJson } from './scryfallClient'
import { fetchCardJson, namedCardUrl, primeCardsByName } from './scryfallCards'

interface Identifier {
  name: string
  set?: string
}

function ok(body: unknown): Response {
  return { ok: true, status: 200, json: async () => body, headers: { get: () => null } } as unknown as Response
}

function card(name: string, set = 'tst', num = '1') {
  return { object: 'card', name, set, collector_number: num, type_line: 'Instant', cmc: 1 }
}

/** A fetch that answers /cards/collection from `known` and fails every other request. */
function collectionFetch(known: (id: Identifier) => object | null) {
  const bodies: Identifier[][] = []
  const other: string[] = []
  const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
    if (!url.endsWith('/cards/collection')) {
      other.push(url)
      throw new TypeError('unexpected request')
    }
    const { identifiers } = JSON.parse(String(init?.body)) as { identifiers: Identifier[] }
    bodies.push(identifiers)
    const data: object[] = []
    const notFound: Identifier[] = []
    for (const id of identifiers) {
      const hit = known(id)
      if (hit) data.push(hit)
      else notFound.push(id)
    }
    return ok({ object: 'list', not_found: notFound, data })
  })
  vi.stubGlobal('fetch', fetchMock)
  return { bodies, other, fetchMock }
}

describe('primeCardsByName', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('DCK-26: asks for 160 cards in three collection requests of at most 75, then serves each lookup from the cache', async () => {
    const names = Array.from({ length: 160 }, (_, i) => `Card ${i}`)
    const { bodies, other, fetchMock } = collectionFetch((id) => card(id.name, 'tst', id.name.split(' ')[1]))

    await primeCardsByName(names.map((name) => ({ name })), { urgent: true })

    expect(bodies.map((b) => b.length)).toEqual([75, 75, 10])
    const init = (fetchMock.mock.calls[0] as unknown as [string, RequestInit])[1]
    expect(init).toMatchObject({ method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json' } })
    expect(await fetchCardJson({ cardName: 'Card 42' })).toMatchObject({ name: 'Card 42', set: 'tst', collector_number: '42' })
    expect(await fetchCardJson({ cardName: 'Card 42', setCode: 'TST', cardNumber: '42' })).toMatchObject({ name: 'Card 42' })
    expect(other).toEqual([])
  })

  it('DCK-26: remembers what the collection did not find, so the exact lookup is not sent', async () => {
    const { other } = collectionFetch((id) => (id.name === 'Shock' ? card('Shock') : null))

    await primeCardsByName([{ name: 'Shock' }, { name: 'Shcok' }])

    expect(await scryfallJson(namedCardUrl('Shcok'), { rejectOnFailure: true })).toBeNull()
    expect(other).toEqual([])
  })

  it('DCK-26: asks for a split card by its first face, since the collection does not find the full name', async () => {
    const { bodies } = collectionFetch((id) =>
      id.name === 'Fire' ? card('Fire // Ice', 'mh2', '290') : id.name === 'Shock' && id.set === 'm21' ? card('Shock', 'm21', '159') : null)

    await primeCardsByName([{ name: 'Fire // Ice' }, { name: 'Wear // Tear' }, { name: 'Shock', setCode: 'M21' }])

    expect(bodies[0]).toEqual([{ name: 'Fire' }, { name: 'Wear' }, { name: 'Shock', set: 'm21' }])
    expect(await scryfallJson(namedCardUrl('Fire // Ice'))).toMatchObject({ name: 'Fire // Ice' })
    expect(await scryfallJson(namedCardUrl('Wear // Tear'))).toBeNull()
    expect(await scryfallJson(namedCardUrl('Shock', 'M21'))).toMatchObject({ set: 'm21', collector_number: '159' })
  })

  it('DCK-26: does not ask again for cards already cached', async () => {
    const { bodies } = collectionFetch((id) => card(id.name))
    await primeCardsByName([{ name: 'Shock' }])
    await primeCardsByName([{ name: 'Shock' }, { name: 'Opt' }])
    expect(bodies).toEqual([[{ name: 'Shock' }], [{ name: 'Opt' }]])
  })

  it('DCK-26: a batch Scryfall did not answer leaves its cards uncached for their own lookups', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => { throw new TypeError('Failed to fetch') }))
    await expect(primeCardsByName([{ name: 'Shock' }])).resolves.toBeUndefined()
    vi.stubGlobal('fetch', vi.fn(async () => ok(card('Shock'))))
    expect(await scryfallJson(namedCardUrl('Shock'))).toMatchObject({ name: 'Shock' })
  })
})
