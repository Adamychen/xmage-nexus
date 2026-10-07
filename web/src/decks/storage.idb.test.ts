import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { DeckV2 } from './types'

// The real browser path (IndexedDB through idb-keyval). jsdom has no IndexedDB,
// so idb-keyval is replaced by a Map and `indexedDB` by any object: what matters
// here is the storage.ts logic on top (legacy migration, one-off normalization,
// localStorage fallback), not idb-keyval.
const idb = new Map<string, unknown>()
const idbFail = { keys: false, get: false, set: false, del: false }

vi.mock('idb-keyval', () => ({
  // The real createStore opens the DB right away: without `indexedDB` it throws.
  createStore: () => {
    if (!globalThis.indexedDB) throw new ReferenceError('indexedDB is not defined')
    return 'store'
  },
  keys: async () => {
    if (idbFail.keys) throw new Error('idb keys')
    return [...idb.keys()]
  },
  get: async (k: string) => {
    if (idbFail.get) throw new Error('idb get')
    return idb.get(k)
  },
  set: async (k: string, v: unknown) => {
    if (idbFail.set) throw new Error('idb set')
    idb.set(k, v)
  },
  del: async (k: string) => {
    if (idbFail.del) throw new Error('idb del')
    idb.delete(k)
  },
}))

const ls = new Map<string, string>()
const fakeLS = {
  getItem: (k: string) => (ls.has(k) ? ls.get(k)! : null),
  setItem: (k: string, v: string) => { ls.set(k, String(v)) },
  removeItem: (k: string) => { ls.delete(k) },
  clear: () => { ls.clear() },
}

const MIGRATED = 'mage_decks_v2_migrated'
const FIXED = 'mage_decks_robust_fixed_v2'
const LEGACY = 'mage_custom_decks'
const LS_V2 = 'mage_decks_v2'

function make(id: string, over: Partial<DeckV2> = {}): DeckV2 {
  return {
    id,
    name: id,
    cards: [{ cardName: 'Mountain', setCode: 'LEA', cardNumber: '292', amount: 60 }],
    sideboard: [],
    format: 'Freeform',
    colors: [],
    createdAt: 1,
    updatedAt: 1,
    source: 'custom',
    ...over,
  }
}

/** storage.ts keeps the store and the singleton at module level: fresh module per test. */
async function freshStorage() {
  vi.resetModules()
  const mod = await import('./storage')
  return mod.getDeckStorage()
}

/** State of a user who already went through both migrations. */
function settled() {
  ls.set(MIGRATED, '1')
  ls.set(FIXED, '1')
}

beforeEach(() => {
  idb.clear()
  ls.clear()
  Object.assign(idbFail, { keys: false, get: false, set: false, del: false })
  vi.stubGlobal('localStorage', fakeLS)
  vi.stubGlobal('indexedDB', {})
  vi.spyOn(console, 'info').mockImplementation(() => {})
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('IdbDeckStorage', () => {
  beforeEach(settled)

  it('put/get/list/count/del on IndexedDB', async () => {
    const s = await freshStorage()
    await s.put(make('a', { updatedAt: 0 }))
    await new Promise((r) => setTimeout(r, 2))
    await s.put(make('b'))

    expect([...idb.keys()].sort()).toEqual(['deck:a', 'deck:b'])
    expect((await s.list()).map((d) => d.id)).toEqual(['b', 'a'])
    expect((await s.get('a'))!.name).toBe('a')
    expect(await s.count()).toBe(2)
    // Does not write to localStorage while IndexedDB works.
    expect(ls.has(LS_V2)).toBe(false)

    await s.del('a')
    expect(await s.get('a')).toBeNull()
    expect(await s.count()).toBe(1)
  })

  it('put stamps updatedAt and fills a missing createdAt', async () => {
    const s = await freshStorage()
    const before = Date.now()
    await s.put(make('a', { createdAt: 0, updatedAt: 0 }))
    const saved = idb.get('deck:a') as DeckV2
    expect(saved.updatedAt).toBeGreaterThanOrEqual(before)
    expect(saved.createdAt).toBe(saved.updatedAt)
  })

  it('list ignores foreign keys and empty entries', async () => {
    idb.set('other:x', make('x'))
    idb.set('deck:ghost', undefined)
    idb.set('deck:a', make('a'))
    const s = await freshStorage()
    expect((await s.list()).map((d) => d.id)).toEqual(['a'])
  })

  it('when an IndexedDB write fails it saves to localStorage and reads it back', async () => {
    const s = await freshStorage()
    idbFail.set = true
    await s.put(make('a'))
    await s.put(make('a', { name: 'renamed' }))

    const stored = JSON.parse(ls.get(LS_V2)!) as DeckV2[]
    expect(stored.map((d) => d.name)).toEqual(['renamed'])

    idbFail.keys = true
    idbFail.get = true
    expect((await s.list()).map((d) => d.id)).toEqual(['a'])
    expect((await s.get('a'))!.name).toBe('renamed')
  })

  it('del removes from both places even if IndexedDB fails', async () => {
    ls.set(LS_V2, JSON.stringify([make('a'), make('b')]))
    const s = await freshStorage()
    idbFail.del = true
    await s.del('a')
    expect((JSON.parse(ls.get(LS_V2)!) as DeckV2[]).map((d) => d.id)).toEqual(['b'])
  })

  it('without IndexedDB in the browser it uses localStorage', async () => {
    vi.stubGlobal('indexedDB', undefined)
    const s = await freshStorage()
    await s.put(make('a'))
    expect(idb.size).toBe(0)
    expect((JSON.parse(ls.get(LS_V2)!) as DeckV2[]).map((d) => d.id)).toEqual(['a'])
  })
})

describe('migration from the legacy decks (mage_custom_decks)', () => {
  const legacy = [
    { name: 'Edh', cards: [{ cardName: 'Forest', setCode: 'LEA', cardNumber: '294', amount: 99 }], sideboard: [] },
    { name: 'Burn', cards: [{ cardName: 'Lightning Bolt', setCode: 'PLST', cardNumber: 'M10-146', amount: 4 }], sideboard: [] },
  ]

  it('moves every deck to v2 in IndexedDB and drops the legacy key', async () => {
    ls.set(LEGACY, JSON.stringify(legacy))
    const s = await freshStorage()
    const decks = await s.list()

    expect(decks.map((d) => d.name).sort()).toEqual(['Burn', 'Edh'])
    const edh = decks.find((d) => d.name === 'Edh')!
    expect(edh.format).toBe('Commander') // >= 99 cards
    expect(edh.coverCard).toEqual(legacy[0].cards[0])
    expect(edh.source).toBe('custom')
    expect(decks.find((d) => d.name === 'Burn')!.format).toBe('Freeform')
    // PLST M10-146 -> M10 146
    expect(decks.find((d) => d.name === 'Burn')!.cards[0]).toMatchObject({ setCode: 'M10', cardNumber: '146' })
    expect(ls.get(MIGRATED)).toBe('1')
    expect(ls.has(LEGACY)).toBe(false)
  })

  it('without IndexedDB it migrates to localStorage keeping what was there', async () => {
    vi.stubGlobal('indexedDB', undefined)
    ls.set(LEGACY, JSON.stringify(legacy))
    ls.set(LS_V2, JSON.stringify([make('existing')]))
    const s = await freshStorage()

    expect((await s.list()).map((d) => d.name).sort()).toEqual(['Burn', 'Edh', 'existing'])
    expect(ls.get(MIGRATED)).toBe('1')
    expect(ls.has(LEGACY)).toBe(false)
  })

  it('if IndexedDB fails midway it neither marks the migration nor drops the legacy decks', async () => {
    ls.set(LEGACY, JSON.stringify(legacy))
    idbFail.set = true
    const s = await freshStorage()
    await s.list()

    expect(ls.has(MIGRATED)).toBe(false)
    expect(ls.get(LEGACY)).toBe(JSON.stringify(legacy))
  })

  it('without legacy decks it only marks the migration', async () => {
    const s = await freshStorage()
    expect(await s.list()).toEqual([])
    expect(ls.get(MIGRATED)).toBe('1')
  })
})

describe('one-off normalization of stored printings', () => {
  const card = (setCode: string, cardNumber: string) => ({ cardName: 'X', setCode, cardNumber, amount: 1 })

  async function normalize(cards: ReturnType<typeof card>[]) {
    ls.set(MIGRATED, '1')
    idb.set('deck:a', make('a', { cards }))
    const s = await freshStorage()
    await s.list()
    return (idb.get('deck:a') as DeckV2).cards.map((c) => `${c.setCode} ${c.cardNumber}`)
  }

  it('rewrites PLST, set-prefixed numbers and promo suffixes', async () => {
    expect(await normalize([
      card('PLST', 'M10-146'),
      card('plst', 'C18-12p'),
      card('M10', 'M10-146'),
      card('WOE', '242p'),
    ])).toEqual(['M10 146', 'C18 12', 'M10 146', 'WOE 242'])
    expect(ls.get(FIXED)).toBe('1')
  })

  it('leaves sets starting with P alone, real sets and promos alike', async () => {
    // PIP = Fallout, PCY = Prophecy, PLS = Planeshift, POR = Portal,
    // PC2 = Planechase 2012. Without a set index they cannot be told apart from a
    // promo (PWOE): the proxy decides with Sets.findSet (DeckJson.normalizePrinting).
    expect(await normalize([
      card('PWOE', '242'),
      card('PIP', '1'),
      card('PCY', '77'),
      card('PLS', '1'),
      card('POR', '1'),
      card('PC2', '1'),
    ])).toEqual(['PWOE 242', 'PIP 1', 'PCY 77', 'PLS 1', 'POR 1', 'PC2 1'])
  })

  it('runs only once', async () => {
    await normalize([card('PLST', 'M10-146')])
    idb.set('deck:b', make('b', { cards: [card('PLST', 'M10-146')] }))
    const s = await freshStorage()
    await s.list()
    expect((idb.get('deck:b') as DeckV2).cards[0].setCode).toBe('PLST')
  })

  it('does not rewrite decks that are already fine', async () => {
    ls.set(MIGRATED, '1')
    const deck = make('a')
    idb.set('deck:a', deck)
    const s = await freshStorage()
    await s.list()
    expect(idb.get('deck:a')).toBe(deck)
  })
})
