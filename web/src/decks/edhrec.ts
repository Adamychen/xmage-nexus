import { scryfallFetch } from '../cards/scryfallClient'
import { fetchEdhrecPageViaProxy } from '../net/commands'
import type { ScryfallSearchCard } from './scryfallSearch'

export interface EdhrecCardView {
  name: string
  synergy: number | null
  numDecks: number | null
  potentialDecks: number | null
}

export interface EdhrecList {
  tag: string
  header: string
  cards: EdhrecCardView[]
}

export interface EdhrecCommanderData {
  slug: string
  commanderName: string
  numDecks: number | null
  lists: EdhrecList[]
}

export type EdhrecResult =
  | { status: 'ok'; data: EdhrecCommanderData }
  | { status: 'not_found' }
  | { status: 'error' }

const CACHE_TTL_MS = 24 * 60 * 60 * 1000
const CARD_CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000
const DB_NAME = 'xmage-edhrec-cache'
const DB_VERSION = 2
const DB_STORE = 'pages'
const DB_CARD_STORE = 'cards'
/** Tope de seguridad: las páginas de EDHREC rondan 220–300 nombres únicos, así
 *  que en la práctica se resuelve la página entera (≈4 POSTs, cacheados por nombre). */
export const MAX_RESOLVE_NAMES = 600
const COLLECTION_BATCH = 75

export function edhrecSlug(name: string): string {
  // DFC commanders (e.g. "Slicer, Hired Muscle // Slicer, High-Speed Antagonist")
  // live on EDHREC under the front-face slug only; the full name returns AccessDenied.
  return name
    .split(/\s*\/\/\s*/)[0]
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/['’"]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

export function edhrecPageUrl(commanderName: string): string {
  return `https://edhrec.com/commanders/${edhrecSlug(commanderName)}`
}

function jsonUrl(slug: string): string {
  return `https://json.edhrec.com/pages/commanders/${slug}.json`
}

function parseCardView(raw: unknown): EdhrecCardView | null {
  if (!raw || typeof raw !== 'object') return null
  const c = raw as Record<string, unknown>
  if (typeof c.name !== 'string' || !c.name) return null
  return {
    name: c.name,
    synergy: typeof c.synergy === 'number' ? c.synergy : null,
    numDecks: typeof c.num_decks === 'number' ? c.num_decks : null,
    potentialDecks: typeof c.potential_decks === 'number' ? c.potential_decks : null,
  }
}

export function parseEdhrecPage(slug: string, raw: unknown): EdhrecCommanderData | null {
  if (!raw || typeof raw !== 'object') return null
  const container = (raw as Record<string, unknown>).container
  if (!container || typeof container !== 'object') return null
  const jsonDict = (container as Record<string, unknown>).json_dict
  if (!jsonDict || typeof jsonDict !== 'object') return null
  const dict = jsonDict as Record<string, unknown>
  const card = (dict.card ?? {}) as Record<string, unknown>
  const rawLists = Array.isArray(dict.cardlists) ? dict.cardlists : []
  const lists: EdhrecList[] = []
  for (const rl of rawLists) {
    if (!rl || typeof rl !== 'object') continue
    const l = rl as Record<string, unknown>
    const rawCards = Array.isArray(l.cardviews) ? l.cardviews : []
    const cards = rawCards.map(parseCardView).filter((c): c is EdhrecCardView => c !== null)
    if (cards.length === 0) continue
    lists.push({
      tag: typeof l.tag === 'string' && l.tag ? l.tag : `list-${lists.length}`,
      header: typeof l.header === 'string' && l.header ? l.header : '',
      cards,
    })
  }
  if (lists.length === 0) return null
  return {
    slug,
    commanderName: typeof card.name === 'string' && card.name ? card.name : slug,
    numDecks: typeof card.num_decks === 'number' ? card.num_decks : null,
    lists,
  }
}

const memory = new Map<string, EdhrecResult>()
const inflight = new Map<string, Promise<EdhrecResult>>()
/** Nombre (minúsculas) → carta resuelta; null = Scryfall no la conoce.
 *  Evita repetir los POST a /cards/collection cada vez que se monta el panel. */
const cardMemory = new Map<string, ScryfallSearchCard | null>()

let dbPromise: Promise<IDBDatabase | null> | null = null

function openDb(): Promise<IDBDatabase | null> {
  if (dbPromise) return dbPromise
  dbPromise = new Promise<IDBDatabase | null>((resolve) => {
    try {
      if (typeof indexedDB === 'undefined' || !indexedDB) {
        resolve(null)
        return
      }
      const req = indexedDB.open(DB_NAME, DB_VERSION)
      req.onupgradeneeded = () => {
        const db = req.result
        if (!db.objectStoreNames.contains(DB_STORE)) db.createObjectStore(DB_STORE)
        if (!db.objectStoreNames.contains(DB_CARD_STORE)) db.createObjectStore(DB_CARD_STORE)
      }
      req.onsuccess = () => resolve(req.result)
      req.onerror = () => resolve(null)
      req.onblocked = () => resolve(null)
    } catch {
      resolve(null)
    }
  })
  return dbPromise
}

async function idbGet(slug: string): Promise<EdhrecResult | undefined> {
  const db = await openDb()
  if (!db) return undefined
  return new Promise((resolve) => {
    try {
      const req = db.transaction(DB_STORE, 'readonly').objectStore(DB_STORE).get(slug)
      req.onsuccess = () => {
        const entry = req.result as { value: EdhrecResult; at: number } | undefined
        resolve(entry && Date.now() - entry.at < CACHE_TTL_MS ? entry.value : undefined)
      }
      req.onerror = () => resolve(undefined)
    } catch {
      resolve(undefined)
    }
  })
}

async function idbPut(slug: string, value: EdhrecResult) {
  const db = await openDb()
  if (!db) return
  try {
    db.transaction(DB_STORE, 'readwrite').objectStore(DB_STORE).put({ value, at: Date.now() }, slug)
  } catch {}
}

function cardIdbGetMany(db: IDBDatabase, keys: string[]): Promise<Map<string, ScryfallSearchCard | null>> {
  return new Promise((resolve) => {
    const out = new Map<string, ScryfallSearchCard | null>()
    try {
      const store = db.transaction(DB_CARD_STORE, 'readonly').objectStore(DB_CARD_STORE)
      let remaining = keys.length
      const done = () => {
        if (--remaining === 0) resolve(out)
      }
      for (const key of keys) {
        const req = store.get(key)
        req.onsuccess = () => {
          const entry = req.result as { value: ScryfallSearchCard | null; at: number } | undefined
          if (entry && Date.now() - entry.at < CARD_CACHE_TTL_MS) out.set(key, entry.value)
          done()
        }
        req.onerror = done
      }
    } catch {
      resolve(out)
    }
  })
}

function cardIdbPut(key: string, value: ScryfallSearchCard | null) {
  void openDb().then((db) => {
    if (!db) return
    try {
      db.transaction(DB_CARD_STORE, 'readwrite').objectStore(DB_CARD_STORE).put({ value, at: Date.now() }, key)
    } catch {}
  })
}

/** json.edhrec.com sends no CORS headers, so browsers can't fetch it directly;
 *  the proxy fetches it server-side. Null = proxy unavailable (not connected,
 *  older proxy build) → caller falls back to a direct fetch. */
async function loadViaProxy(slug: string): Promise<EdhrecResult | null> {
  try {
    const res = await fetchEdhrecPageViaProxy(slug)
    if (res.ok) {
      const data = parseEdhrecPage(slug, res.data)
      return data ? { status: 'ok', data } : { status: 'not_found' }
    }
    const code = (res as { errorCode?: string }).errorCode
    if (code === 'CARD_NOT_FOUND') return { status: 'not_found' }
    if (code === 'FAILED') return { status: 'error' }
    return null
  } catch {
    return null
  }
}

async function loadCommander(slug: string): Promise<EdhrecResult> {
  const cached = await idbGet(slug)
  if (cached) {
    memory.set(slug, cached)
    return cached
  }
  let result: EdhrecResult
  const proxied = await loadViaProxy(slug)
  if (proxied) {
    if (proxied.status !== 'error') {
      memory.set(slug, proxied)
      void idbPut(slug, proxied)
    }
    return proxied
  }
  try {
    const res = await fetch(jsonUrl(slug), { headers: { Accept: 'application/json' } })
    if (res.status === 404) {
      result = { status: 'not_found' }
    } else if (!res.ok) {
      result = { status: 'error' }
    } else {
      const data = parseEdhrecPage(slug, await res.json())
      result = data ? { status: 'ok', data } : { status: 'not_found' }
    }
  } catch {
    return { status: 'error' }
  }
  memory.set(slug, result)
  if (result.status !== 'error') void idbPut(slug, result)
  return result
}

/** Recommendations for one commander. Memory + IndexedDB (24 h) cache,
 *  single-flight per slug; never throws (network/HTTP failures → 'error'). */
export function fetchEdhrecCommander(commanderName: string): Promise<EdhrecResult> {
  const slug = edhrecSlug(commanderName)
  if (!slug) return Promise.resolve({ status: 'not_found' })
  const hit = memory.get(slug)
  if (hit) return Promise.resolve(hit)
  const pending = inflight.get(slug)
  if (pending) return pending
  const p = loadCommander(slug).finally(() => inflight.delete(slug))
  inflight.set(slug, p)
  return p
}

/** Unique card names across the given lists, in list order, capped for the
 *  collection resolve budget. */
export function collectSuggestionNames(lists: EdhrecList[], perListCap: number, max = MAX_RESOLVE_NAMES): string[] {
  const seen = new Set<string>()
  const names: string[] = []
  for (const list of lists) {
    for (const card of list.cards.slice(0, perListCap)) {
      const key = card.name.toLowerCase()
      if (seen.has(key)) continue
      seen.add(key)
      names.push(card.name)
      if (names.length >= max) return names
    }
  }
  return names
}

/** Toda la página de EDHREC (deduplicada, con el tope global de seguridad). */
export function collectAllSuggestionNames(lists: EdhrecList[]): string[] {
  return collectSuggestionNames(lists, Number.POSITIVE_INFINITY, MAX_RESOLVE_NAMES)
}

interface CollectionResponse {
  object?: string
  data?: Array<Record<string, unknown>>
  not_found?: Array<Record<string, unknown>>
}

function toSearchCard(raw: Record<string, unknown>): ScryfallSearchCard | null {
  if (typeof raw.name !== 'string' || !raw.name) return null
  const card = raw as unknown as ScryfallSearchCard
  return {
    ...card,
    id: typeof card.id === 'string' && card.id ? card.id : `edhrec-${card.name.toLowerCase()}`,
    set: typeof card.set === 'string' && card.set ? card.set : 'unk',
    collector_number: typeof card.collector_number === 'string' && card.collector_number ? card.collector_number : '0',
    cmc: typeof card.cmc === 'number' ? card.cmc : 0,
    type_line: typeof card.type_line === 'string' ? card.type_line : '',
    colors: Array.isArray(card.colors) ? card.colors : [],
    color_identity: Array.isArray(card.color_identity) ? card.color_identity : [],
  }
}

/** Batch name → Scryfall card resolution via /cards/collection (POST, 75 per
 *  request) through the shared Scryfall queue. Indexed by full and front-face
 *  name (lowercase). Unmatched names are simply absent from the map.
 *
 *  Resultado cacheado por nombre (memoria + IndexedDB, 7 días: los datos de una
 *  carta cambian poco y el pool de sugerencias repite nombres entre comandantes);
 *  solo se piden a Scryfall los nombres que falten, así reabrir el panel o
 *  cambiar de pestaña no vuelve a pagar los ~3 s del POST. */
export async function resolveCardsByNames(names: string[]): Promise<Map<string, ScryfallSearchCard>> {
  const out = new Map<string, ScryfallSearchCard>()
  const pending = new Map<string, string>()
  const seen = new Set<string>()
  for (const name of names) {
    const key = name.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    const cached = cardMemory.get(key)
    if (cached !== undefined) {
      if (cached) out.set(key, cached)
    } else {
      pending.set(key, name)
    }
  }

  let missing = [...pending.keys()]
  if (missing.length > 0) {
    const db = await openDb()
    if (db) {
      const stored = await cardIdbGetMany(db, missing)
      missing = missing.filter((key) => {
        if (!stored.has(key)) return true
        const value = stored.get(key) ?? null
        cardMemory.set(key, value)
        if (value) out.set(key, value)
        return false
      })
    }
  }

  const index = (card: ScryfallSearchCard) => {
    cardMemory.set(card.name.toLowerCase(), card)
    cardIdbPut(card.name.toLowerCase(), card)
    out.set(card.name.toLowerCase(), card)
    const faceName = card.card_faces?.[0]?.name
    if (faceName) {
      cardMemory.set(faceName.toLowerCase(), card)
      cardIdbPut(faceName.toLowerCase(), card)
      out.set(faceName.toLowerCase(), card)
    }
  }

  const batches: string[][] = []
  for (let i = 0; i < missing.length; i += COLLECTION_BATCH) {
    batches.push(missing.slice(i, i + COLLECTION_BATCH))
  }
  // En paralelo: el cliente de Scryfall ya limita concurrencia (3 en vuelo,
  // 150 ms de espaciado), y una página entera son ~4 batches.
  const payloads = await Promise.all(
    batches.map(async (chunk): Promise<CollectionResponse | null> => {
      try {
        const res = await scryfallFetch('https://api.scryfall.com/cards/collection', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ identifiers: chunk.map((key) => ({ name: pending.get(key) ?? key })) }),
          urgent: true,
          timeoutMs: 15000,
        })
        if (!res.ok) return null
        return (await res.json()) as CollectionResponse
      } catch {
        return null
      }
    }),
  )

  for (const payload of payloads) {
    if (!payload) continue
    for (const raw of payload.data ?? []) {
      const card = toSearchCard(raw)
      if (!card) continue
      index(card)
    }
    for (const raw of payload.not_found ?? []) {
      const name = typeof raw?.name === 'string' ? raw.name.toLowerCase() : null
      if (!name) continue
      cardMemory.set(name, null)
      cardIdbPut(name, null)
    }
  }
  return out
}

export function resetEdhrecCacheForTests() {
  memory.clear()
  cardMemory.clear()
  inflight.clear()
  dbPromise = null
}
