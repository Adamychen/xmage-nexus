import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const xmagePrintingsFor = vi.hoisted(() => vi.fn())
vi.mock('./xmageCatalog', () => ({ xmagePrintingsFor }))

import { resolveDeckPrintings } from './importResolve'
import { setScryfallPacing } from '../cards/scryfallClient'
import type { DeckCard } from '../lobby/decks'

interface Identifier {
  name: string
  set?: string
}

const card = (cardName: string, amount = 1): DeckCard => ({ cardName, setCode: '', cardNumber: '', amount })

function json(body: unknown, status = 200): Response {
  return { ok: status < 400, status, json: async () => body, headers: { get: () => null } } as unknown as Response
}

function scry(name: string, set = 'tst', num = '1') {
  return { object: 'card', name, set, collector_number: num, type_line: 'Instant', cmc: 1, legalities: {} }
}

/** Scryfall double: `exists` decides which names are real cards; the log keeps every request. */
function scryfall(exists: (name: string) => boolean, opts: { collection?: 'ok' | 'offline'; named?: 'ok' | 'offline' } = {}) {
  const log: string[] = []
  vi.stubGlobal('fetch', vi.fn(async (url: string, init?: RequestInit) => {
    log.push(url)
    if (url.endsWith('/cards/collection')) {
      if (opts.collection === 'offline') throw new TypeError('Failed to fetch')
      const { identifiers } = JSON.parse(String(init?.body)) as { identifiers: Identifier[] }
      return json({
        object: 'list',
        data: identifiers.filter((id) => exists(id.name)).map((id) => scry(id.name)),
        not_found: identifiers.filter((id) => !exists(id.name)),
      })
    }
    if (opts.named === 'offline') throw new TypeError('Failed to fetch')
    const fuzzy = /fuzzy=([^&]+)/.exec(url)
    if (fuzzy) {
      const typo = decodeURIComponent(fuzzy[1])
      return typo === 'Lightnin Bolt' ? json(scry('Lightning Bolt', 'clu', '141')) : json({ object: 'error' }, 404)
    }
    const exact = /exact=([^&]+)/.exec(url)
    if (exact) {
      const name = decodeURIComponent(exact[1])
      return exists(name) ? json(scry(name)) : json({ object: 'error' }, 404)
    }
    return json({ object: 'error' }, 404)
  }))
  return log
}

describe('DCK-26 resolveDeckPrintings against Scryfall', () => {
  beforeEach(() => {
    xmagePrintingsFor.mockReset()
    xmagePrintingsFor.mockResolvedValue(new Map())
  })
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.useRealTimers()
  })

  it('DCK-26: resolves 100 cards XMage did not place with two collection requests and no per-card lookups', async () => {
    const names = Array.from({ length: 100 }, (_, i) => `Card ${i}`)
    const log = scryfall(() => true)

    const res = await resolveDeckPrintings({ cards: names.map((n) => card(n)), sideboard: [] }, { strategy: 'default' })

    expect(log.filter((u) => u.endsWith('/cards/collection'))).toHaveLength(2)
    expect(log.filter((u) => u.includes('/cards/named'))).toEqual([])
    expect(res.resolved).toBe(100)
    expect(res.unresolved).toEqual([])
    expect(res.unanswered).toEqual([])
    expect(res.metaByName.size).toBe(100)
  })

  it('DCK-26: looks up on its own only what the collection did not find', async () => {
    const log = scryfall((name) => name !== 'Lightnin Bolt' && name !== 'Not A Card')

    const res = await resolveDeckPrintings(
      { cards: [card('Shock'), card('Lightnin Bolt'), card('Not A Card')], sideboard: [] },
      { strategy: 'default' },
    )

    expect(log.filter((u) => u.includes('exact='))).toEqual([])
    expect(log.filter((u) => u.includes('fuzzy=')).map((u) => decodeURIComponent(u.split('fuzzy=')[1]))).toEqual(['Lightnin Bolt', 'Not A Card'])
    expect(res.fellBack).toEqual(['Lightnin Bolt'])
    expect(res.unresolved).toEqual(['Not A Card'])
    expect(res.unanswered).toEqual([])
  })

  it('DCK-26: falls back to per-card lookups when the collection request fails', async () => {
    const log = scryfall(() => true, { collection: 'offline' })
    const res = await resolveDeckPrintings({ cards: [card('Shock'), card('Opt')], sideboard: [] }, { strategy: 'default' })
    expect(log.filter((u) => u.includes('exact='))).toHaveLength(2)
    expect(res.resolved).toBe(2)
  })

  it('DCK-26: a card Scryfall did not answer for is reported as unanswered, never as not found', async () => {
    scryfall(() => true, { collection: 'offline', named: 'offline' })
    const res = await resolveDeckPrintings({ cards: [card('Shock', 4), card('Opt')], sideboard: [] }, { strategy: 'default' })
    expect(res.unresolved).toEqual([])
    expect(res.unanswered).toEqual(['Opt', 'Shock'])
    expect(res.cards).toEqual([card('Shock', 4), card('Opt')])
  })

  it('DCK-26: a card throttled past every attempt is unanswered, and asking again resolves it from Scryfall', async () => {
    vi.useFakeTimers()
    setScryfallPacing({ maxAttempts: 2 })
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false, status: 429, json: async () => ({}), headers: { get: () => '1' } })))
    const pending = resolveDeckPrintings({ cards: [card('Shock')], sideboard: [] }, { strategy: 'default' })
    await vi.advanceTimersByTimeAsync(10_000)
    const first = await pending
    expect(first.unresolved).toEqual([])
    expect(first.unanswered).toEqual(['Shock'])

    vi.useRealTimers()
    scryfall(() => true)
    const again = await resolveDeckPrintings({ cards: first.cards, sideboard: first.sideboard }, { strategy: 'default' })
    expect(again.unanswered).toEqual([])
    expect(again.cards[0]).toMatchObject({ cardName: 'Shock', setCode: 'TST', cardNumber: '1' })
  })

  it('DCK-26: a set import asks the collection by name and set, then by name for the cards missing from the set', async () => {
    const bodies: Identifier[][] = []
    vi.stubGlobal('fetch', vi.fn(async (url: string, init?: RequestInit) => {
      if (!url.endsWith('/cards/collection')) throw new TypeError(`unexpected ${url}`)
      const { identifiers } = JSON.parse(String(init?.body)) as { identifiers: Identifier[] }
      bodies.push(identifiers)
      const inSet = (id: Identifier) => !id.set || id.name === 'Shock'
      return json({
        object: 'list',
        data: identifiers.filter(inSet).map((id) => scry(id.name, id.set ?? 'dflt', id.set ? '159' : '9')),
        not_found: identifiers.filter((id) => !inSet(id)),
      })
    }))

    const res = await resolveDeckPrintings({ cards: [card('Shock'), card('Opt')], sideboard: [] }, { strategy: 'set', setCode: 'M21' })

    expect(bodies).toEqual([[{ name: 'Shock', set: 'm21' }, { name: 'Opt', set: 'm21' }], [{ name: 'Opt' }]])
    expect(res.cards).toEqual([
      { cardName: 'Shock', setCode: 'M21', cardNumber: '159', amount: 1 },
      { cardName: 'Opt', setCode: 'DFLT', cardNumber: '9', amount: 1 },
    ])
    expect(res.fellBack).toEqual(['Opt'])
    expect(res.unanswered).toEqual([])
  })
})
