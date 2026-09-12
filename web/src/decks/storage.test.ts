import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { createMemoryStorage, DeckStorageError, getDeckStorage, isQuotaError, __testables } from './storage'
import type { DeckV2 } from './types'

function make(id: string, name: string): DeckV2 {
  return {
    id,
    name,
    cards: [{ cardName: 'Mountain', setCode: 'LEA', cardNumber: '292', amount: 60 }],
    sideboard: [],
    format: 'Freeform',
    colors: [],
    createdAt: Date.now(),
    updatedAt: Date.now(),
    source: 'custom',
  }
}

describe('MemoryDeckStorage', () => {
  let s: ReturnType<typeof createMemoryStorage>
  beforeEach(() => {
    s = createMemoryStorage()
  })
  it('put and list sorts by updatedAt', async () => {
    await s.put(make('1', 'A'))
    await new Promise((r) => setTimeout(r, 2))
    await s.put(make('2', 'B'))
    const all = await s.list()
    expect(all[0].id).toBe('2')
  })
  it('get and del', async () => {
    await s.put(make('1', 'A'))
    expect(await s.get('1')).not.toBeNull()
    await s.del('1')
    expect(await s.get('1')).toBeNull()
  })
  it('count', async () => {
    await s.put(make('1', 'A'))
    await s.put(make('2', 'B'))
    expect(await s.count()).toBe(2)
  })
})

describe('DeckStorage quota (AUDIT bloqueante)', () => {
  let bomb = false
  let bombError: Error | null = null
  const mem = new Map<string, string>()
  const fakeLS = {
    getItem: (k: string) => (mem.has(k) ? mem.get(k)! : null),
    setItem: (k: string, v: string) => {
      if (bomb && bombError) throw bombError
      mem.set(k, String(v))
    },
    removeItem: (k: string) => { mem.delete(k) },
    clear: () => { mem.clear() },
  }

  beforeEach(() => {
    bomb = false
    bombError = null
    mem.clear()
    vi.stubGlobal('localStorage', fakeLS)
  })
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  function quotaBomb() {
    bomb = true
    const e = new Error('quota') as Error & { code?: number }
    e.name = 'QuotaExceededError'
    bombError = e
  }

  it('lsSaveAll lanza DeckStorageError con code quota', () => {
    quotaBomb()
    try {
      __testables.lsSaveAll([])
      expect.unreachable('debería lanzar')
    } catch (e) {
      expect(e).toBeInstanceOf(DeckStorageError)
      expect((e as DeckStorageError).code).toBe('quota')
      expect(isQuotaError(e)).toBe(true)
    }
  })

  it('lsSaveAll mapea otros fallos a io', () => {
    bomb = true
    bombError = new Error('denied')
    try {
      __testables.lsSaveAll([])
      expect.unreachable('debería lanzar')
    } catch (e) {
      expect(e).toBeInstanceOf(DeckStorageError)
      expect((e as DeckStorageError).code).toBe('io')
      expect(isQuotaError(e)).toBe(false)
    }
  })

  it('put propaga el error tipado en vez de dejar el badge en saving', async () => {
    quotaBomb()
    const store = getDeckStorage()
    await expect(store.put(make('quota-1', 'Q'))).rejects.toBeInstanceOf(DeckStorageError)
  })
})
