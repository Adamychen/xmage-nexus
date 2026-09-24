import { scryfallFetch } from '../cards/scryfallClient'
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
const DB_NAME = 'xmage-edhrec-cache'
const DB_STORE = 'pages'
const MAX_RESOLVE_NAMES = 150
const COLLECTION_BATCH = 75

export function edhrecSlug(name: string): string {
  return name
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

let dbPromise: Promise<IDBDatabase | null> | null = null

function openDb(): Promise<IDBDatabase | null> {
  if (dbPromise) return dbPromise
  dbPromise = new Promise<IDBDatabase | null>((resolve) => {
    try {
      if (typeof indexedDB === 'undefined' || !indexedDB) {
        resolve(null)
        return
      }
      const req = indexedDB.open(DB_NAME, 1)
      req.onupgradeneeded = () => {
        req.result.createObjectStore(DB_STORE)
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

async function loadCommander(slug: string): Promise<EdhrecResult> {
  const cached = await idbGet(slug)
  if (cached) {
    memory.set(slug, cached)
    return cached
  }
  let result: EdhrecResult
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
 *  name (lowercase). Unmatched names are simply absent from the map. */
export async function resolveCardsByNames(names: string[]): Promise<Map<string, ScryfallSearchCard>> {
  const out = new Map<string, ScryfallSearchCard>()
  for (let i = 0; i < names.length; i += COLLECTION_BATCH) {
    const chunk = names.slice(i, i + COLLECTION_BATCH)
    let res: Response
    try {
      res = await scryfallFetch('https://api.scryfall.com/cards/collection', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identifiers: chunk.map((name) => ({ name })) }),
        urgent: true,
        timeoutMs: 15000,
      })
    } catch {
      continue
    }
    if (!res.ok) continue
    let payload: CollectionResponse
    try {
      payload = (await res.json()) as CollectionResponse
    } catch {
      continue
    }
    for (const raw of payload.data ?? []) {
      const card = toSearchCard(raw)
      if (!card) continue
      out.set(card.name.toLowerCase(), card)
      const faceName = card.card_faces?.[0]?.name
      if (faceName) out.set(faceName.toLowerCase(), card)
    }
  }
  return out
}

export function resetEdhrecCacheForTests() {
  memory.clear()
  inflight.clear()
  dbPromise = null
}
