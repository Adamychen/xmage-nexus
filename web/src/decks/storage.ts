import { createStore, get as idbGet, set as idbSet, del as idbDel, keys as idbKeys } from 'idb-keyval'
import { CUSTOM_DECKS_STORAGE_KEY, loadSavedCustomDecks, type Deck } from '../lobby/decks'
import type { DeckV2 } from './types'
import { makeDeckId } from './types'

const IDB_DB_NAME = 'mage-nexus'
const IDB_STORE_NAME = 'decks-v2'
const IDB_KEY_PREFIX = 'deck:'

let idbStore: ReturnType<typeof createStore> | null = null
function getIdbStore() {
  if (idbStore) return idbStore
  try {
    idbStore = createStore(IDB_DB_NAME, IDB_STORE_NAME)
    return idbStore
  } catch {
    return null
  }
}

function isIdbAvailable(): boolean {
  try {
    return typeof indexedDB !== 'undefined' && !!indexedDB
  } catch {
    return false
  }
}

async function idbList(): Promise<DeckV2[]> {
  const store = getIdbStore()
  if (!store) throw new Error('no idb')
  const ks = (await idbKeys(store)) as string[]
  const res: DeckV2[] = []
  for (const k of ks) {
    if (typeof k === 'string' && k.startsWith(IDB_KEY_PREFIX)) {
      const v = (await idbGet(k, store)) as DeckV2 | undefined
      if (v) res.push(v)
    }
  }
  return res.sort((a, b) => b.updatedAt - a.updatedAt)
}

async function idbPut(deck: DeckV2): Promise<void> {
  const store = getIdbStore()
  if (!store) throw new Error('no idb')
  await idbSet(`${IDB_KEY_PREFIX}${deck.id}`, deck, store)
}
async function idbGetOne(id: string): Promise<DeckV2 | null> {
  const store = getIdbStore()
  if (!store) return null
  const v = (await idbGet(`${IDB_KEY_PREFIX}${id}`, store)) as DeckV2 | undefined
  return v ?? null
}
async function idbDelete(id: string): Promise<void> {
  const store = getIdbStore()
  if (!store) return
  await idbDel(`${IDB_KEY_PREFIX}${id}`, store)
}

const LS_KEY_V2 = 'mage_decks_v2'
const LS_KEY_MIGRATED = 'mage_decks_v2_migrated'

function lsList(): DeckV2[] {
  try {
    const raw = localStorage.getItem(LS_KEY_V2)
    if (!raw) return []
    const arr = JSON.parse(raw) as DeckV2[]
    return Array.isArray(arr) ? arr : []
  } catch {
    return []
  }
}
function lsSaveAll(decks: DeckV2[]): void {
  localStorage.setItem(LS_KEY_V2, JSON.stringify(decks))
}

function legacyToV2(decks: Deck[]): DeckV2[] {
  const now = Date.now()
  return decks.map((d) => ({
    ...d,
    id: makeDeckId(),
    format: (d.cards.reduce((s, c) => s + c.amount, 0) >= 99 ? 'Commander' : 'Freeform') as DeckV2['format'],
    colors: [],
    favorite: false,
    coverCard: d.cards[0],
    createdAt: now,
    updatedAt: now,
    source: 'custom' as const,
  }))
}

async function migrateIfNeeded(): Promise<void> {
  try {
    if (localStorage.getItem(LS_KEY_MIGRATED) === '1') return
    const legacy = loadSavedCustomDecks()
    if (legacy.length === 0) {
      localStorage.setItem(LS_KEY_MIGRATED, '1')
      return
    }
    const v2 = legacyToV2(legacy)
    if (isIdbAvailable()) {
      for (const d of v2) await idbPut(d)
      localStorage.setItem(LS_KEY_MIGRATED, '1')
      try {
        localStorage.removeItem(CUSTOM_DECKS_STORAGE_KEY)
      } catch {}
    } else {
      const existing = lsList()
      lsSaveAll([...existing, ...v2])
      localStorage.setItem(LS_KEY_MIGRATED, '1')
      try { localStorage.removeItem(CUSTOM_DECKS_STORAGE_KEY) } catch {}
    }
  } catch {}
}

export interface DeckStorage {
  list(): Promise<DeckV2[]>
  get(id: string): Promise<DeckV2 | null>
  put(deck: DeckV2): Promise<void>
  del(id: string): Promise<void>
  count(): Promise<number>
}

class IdbDeckStorage implements DeckStorage {
  async list(): Promise<DeckV2[]> {
    await migrateIfNeeded()
    try {
      return await idbList()
    } catch {
      return lsList()
    }
  }
  async get(id: string): Promise<DeckV2 | null> {
    await migrateIfNeeded()
    try {
      const v = await idbGetOne(id)
      if (v) return v
    } catch {}
    return lsList().find((d) => d.id === id) ?? null
  }
  async put(deck: DeckV2): Promise<void> {
    await migrateIfNeeded()
    const toSave = { ...deck, updatedAt: Date.now() }
    if (!toSave.createdAt) toSave.createdAt = toSave.updatedAt
    if (isIdbAvailable()) {
      try {
        await idbPut(toSave)
        return
      } catch {}
    }
    const all = lsList()
    const idx = all.findIndex((d) => d.id === deck.id)
    if (idx >= 0) all[idx] = toSave
    else all.unshift(toSave)
    lsSaveAll(all)
  }
  async del(id: string): Promise<void> {
    if (isIdbAvailable()) {
      try { await idbDelete(id) } catch {}
    }
    const all = lsList().filter((d) => d.id !== id)
    try { lsSaveAll(all) } catch {}
  }
  async count(): Promise<number> {
    const all = await this.list()
    return all.length
  }
}

class MemoryDeckStorage implements DeckStorage {
  private map = new Map<string, DeckV2>()
  async list(): Promise<DeckV2[]> {
    return [...this.map.values()].sort((a, b) => b.updatedAt - a.updatedAt)
  }
  async get(id: string): Promise<DeckV2 | null> {
    return this.map.get(id) ?? null
  }
  async put(deck: DeckV2): Promise<void> {
    this.map.set(deck.id, { ...deck, updatedAt: Date.now() })
  }
  async del(id: string): Promise<void> {
    this.map.delete(id)
  }
  async count(): Promise<number> {
    return this.map.size
  }
  seed(decks: DeckV2[]) {
    for (const d of decks) this.map.set(d.id, d)
  }
}

let singleton: DeckStorage | null = null
export function getDeckStorage(): DeckStorage {
  if (singleton) return singleton
  try {
    if (typeof window === 'undefined') {
      singleton = new MemoryDeckStorage()
      return singleton
    }
    singleton = new IdbDeckStorage()
    return singleton
  } catch {
    singleton = new MemoryDeckStorage()
    return singleton
  }
}

export function createMemoryStorage(): MemoryDeckStorage {
  return new MemoryDeckStorage()
}

export const __testables = { legacyToV2, lsList, lsSaveAll, isIdbAvailable }
