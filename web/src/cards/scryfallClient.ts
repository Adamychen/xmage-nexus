export interface ScryfallFetchOptions extends Omit<RequestInit, 'headers'> {
  headers?: Record<string, string>
  urgent?: boolean
  timeoutMs?: number
}

export interface ScryfallPacing {
  spacingMs: number
  maxConcurrent: number
  maxAttempts: number
}

const DEFAULT_PACING: ScryfallPacing = { spacingMs: 150, maxConcurrent: 3, maxAttempts: 3 }
const DEFAULT_BACKOFF_MS = 2000
const MAX_BACKOFF_MS = 30_000
const MAX_MEMORY_ENTRIES = 4000
const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000
const DB_NAME = 'xmage-scryfall-cache'
const DB_STORE = 'cards'
const CACHE_VERSION = 'v1|'

interface Task {
  url: string
  init: ScryfallFetchOptions
  attempts: number
  resolve: (res: Response) => void
  reject: (err: unknown) => void
}

let pacing: ScryfallPacing = { ...DEFAULT_PACING }
let active = 0
let nextSlotAt = 0
let blockedUntil = 0
let timer: ReturnType<typeof setTimeout> | null = null
const queue: Task[] = []

const memory = new Map<string, unknown>()
const inflight = new Map<string, Promise<unknown>>()

const BUS_NAME = 'xmage-scryfall-budget'
type BusMessage = { slotAt: number } | { blockedUntil: number }
let bus: BroadcastChannel | null | undefined

/**
 * El límite de Scryfall es por IP, pero la cola vive en el módulo: sin esto,
 * dos pestañas del mismo usuario gastan el doble del presupuesto y una pausa
 * por 429 solo frena a la pestaña que la recibió. El canal comparte el reloj de
 * la cola (cada hueco consumido) y las pausas, así que el ritmo es por usuario.
 */
function getBus(): BroadcastChannel | null {
  if (bus !== undefined) return bus
  try {
    if (typeof BroadcastChannel === 'undefined') {
      bus = null
      return bus
    }
    const channel = new BroadcastChannel(BUS_NAME)
    channel.onmessage = (ev: MessageEvent<BusMessage>) => {
      const msg = ev.data
      if (!msg || typeof msg !== 'object') return
      if ('slotAt' in msg && Number.isFinite(msg.slotAt)) {
        nextSlotAt = Math.max(nextSlotAt, msg.slotAt)
      }
      if ('blockedUntil' in msg && Number.isFinite(msg.blockedUntil) && msg.blockedUntil > blockedUntil) {
        blockedUntil = msg.blockedUntil
        notifyThrottle()
      }
      pump()
    }
    ;(channel as unknown as { unref?: () => void }).unref?.()
    bus = channel
  } catch {
    bus = null
  }
  return bus
}

function announce(msg: BusMessage) {
  try {
    getBus()?.postMessage(msg)
  } catch {}
}

function abortError(): Error {
  return new DOMException('Aborted', 'AbortError')
}

function retryAfterMs(res: Response): number {
  const raw = res.headers?.get?.('Retry-After')
  const seconds = raw ? Number.parseInt(raw, 10) : Number.NaN
  if (!Number.isFinite(seconds) || seconds < 0) return DEFAULT_BACKOFF_MS
  return Math.min(seconds * 1000, MAX_BACKOFF_MS)
}

const throttleListeners = new Set<(untilMs: number) => void>()

function notifyThrottle() {
  const remaining = scryfallThrottleMs()
  for (const listener of throttleListeners) {
    try {
      listener(remaining)
    } catch {}
  }
}

/** Pausa común: el 429 de una petición frena a todas (y a las demás pestañas). */
function throttle(forMs: number) {
  blockedUntil = Math.max(blockedUntil, Date.now() + forMs)
  announce({ blockedUntil })
  notifyThrottle()
}

/** Milisegundos que falta esperar por un 429 de Scryfall (0 si no hay pausa). */
export function scryfallThrottleMs(): number {
  return Math.max(0, blockedUntil - Date.now())
}

/** Avisa cuando Scryfall impone una pausa, con los ms que quedan. */
export function onScryfallThrottle(listener: (untilMs: number) => void): () => void {
  throttleListeners.add(listener)
  return () => throttleListeners.delete(listener)
}

function pump() {
  if (timer) return
  while (active < pacing.maxConcurrent && queue.length > 0) {
    const now = Date.now()
    const readyAt = Math.max(nextSlotAt, blockedUntil)
    if (readyAt > now) {
      timer = setTimeout(() => {
        timer = null
        pump()
      }, readyAt - now)
      return
    }
    const task = queue.shift()!
    if (task.init.signal?.aborted) {
      task.reject(abortError())
      continue
    }
    nextSlotAt = now + pacing.spacingMs
    announce({ slotAt: nextSlotAt })
    active++
    void run(task)
  }
}

async function run(task: Task) {
  task.attempts++
  const { urgent: _urgent, timeoutMs, headers, signal, ...rest } = task.init
  const controller = new AbortController()
  const onAbort = () => controller.abort()
  signal?.addEventListener('abort', onAbort)
  const timeout = timeoutMs ? setTimeout(() => controller.abort(), timeoutMs) : null
  try {
    const res = await fetch(task.url, {
      ...rest,
      headers: { Accept: 'application/json', ...headers },
      signal: controller.signal,
    })
    if (res.status === 429) {
      throttle(retryAfterMs(res))
      if (task.attempts < pacing.maxAttempts) {
        queue.unshift(task)
        return
      }
    }
    task.resolve(res)
  } catch (err) {
    task.reject(err)
  } finally {
    if (timeout) clearTimeout(timeout)
    signal?.removeEventListener('abort', onAbort)
    active = Math.max(0, active - 1)
    pump()
  }
}

/**
 * fetch a api.scryfall.com con cola global: separación mínima entre peticiones,
 * tope de concurrencia y pausa común ante 429 (respeta Retry-After). Toda
 * petición a la API debe pasar por aquí para compartir un único presupuesto.
 */
export function scryfallFetch(url: string, init: ScryfallFetchOptions = {}): Promise<Response> {
  return new Promise<Response>((resolve, reject) => {
    if (init.signal?.aborted) {
      reject(abortError())
      return
    }
    const task: Task = { url, init, attempts: 0, resolve, reject }
    if (init.urgent) queue.unshift(task)
    else queue.push(task)
    pump()
  })
}

export function setScryfallPacing(next: Partial<ScryfallPacing>) {
  pacing = { ...pacing, ...next }
}

export function resetScryfallClient() {
  if (timer) clearTimeout(timer)
  timer = null
  queue.length = 0
  active = 0
  nextSlotAt = 0
  blockedUntil = 0
  memory.clear()
  inflight.clear()
  pacing = { ...DEFAULT_PACING }
}

function remember(url: string, value: unknown) {
  memory.delete(url)
  memory.set(url, value)
  while (memory.size > MAX_MEMORY_ENTRIES) {
    const oldest = memory.keys().next().value as string | undefined
    if (oldest === undefined) break
    memory.delete(oldest)
  }
}

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

async function idbGet(url: string): Promise<unknown | undefined> {
  const db = await openDb()
  if (!db) return undefined
  return new Promise((resolve) => {
    try {
      const req = db.transaction(DB_STORE, 'readonly').objectStore(DB_STORE).get(CACHE_VERSION + url)
      req.onsuccess = () => {
        const entry = req.result as { value: unknown; at: number } | undefined
        resolve(entry && Date.now() - entry.at < CACHE_TTL_MS ? entry.value : undefined)
      }
      req.onerror = () => resolve(undefined)
    } catch {
      resolve(undefined)
    }
  })
}

async function idbPut(url: string, value: unknown) {
  const db = await openDb()
  if (!db) return
  try {
    db.transaction(DB_STORE, 'readwrite').objectStore(DB_STORE).put({ value, at: Date.now() }, CACHE_VERSION + url)
  } catch {}
}

const CARD_FIELDS = [
  'id', 'object', 'name', 'printed_name', 'lang', 'set', 'collector_number', 'layout',
  'mana_cost', 'cmc', 'type_line', 'printed_type_line', 'oracle_text', 'keywords',
  'colors', 'color_identity', 'rarity', 'legalities', 'power', 'toughness', 'loyalty',
] as const
const FACE_FIELDS = [
  'name', 'printed_name', 'mana_cost', 'type_line', 'printed_type_line', 'oracle_text',
  'colors', 'power', 'toughness', 'loyalty',
] as const
const IMAGE_FIELDS = ['small', 'normal', 'art_crop'] as const

function pick(source: Record<string, unknown>, fields: readonly string[]): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  for (const f of fields) {
    if (source[f] !== undefined) out[f] = source[f]
  }
  return out
}

function slimImages(uris: unknown): Record<string, unknown> | undefined {
  return uris && typeof uris === 'object' ? pick(uris as Record<string, unknown>, IMAGE_FIELDS) : undefined
}

/** Reduce el JSON de una carta a los campos que usa la web (~1 KB en vez de ~6 KB). */
function slimCard(raw: unknown): unknown {
  if (!raw || typeof raw !== 'object') return raw
  const card = raw as Record<string, unknown>
  if (card.object !== 'card') return raw
  const out = pick(card, CARD_FIELDS)
  const images = slimImages(card.image_uris)
  if (images) out.image_uris = images
  if (Array.isArray(card.card_faces)) {
    out.card_faces = card.card_faces.map((face) => {
      const f = face as Record<string, unknown>
      const slim = pick(f, FACE_FIELDS)
      const faceImages = slimImages(f.image_uris)
      if (faceImages) slim.image_uris = faceImages
      return slim
    })
  }
  return out
}

export interface ScryfallJsonOptions {
  persist?: boolean
  urgent?: boolean
  timeoutMs?: number
}

async function loadJson<T>(url: string, opts: ScryfallJsonOptions): Promise<T | null> {
  if (opts.persist) {
    const hit = await idbGet(url)
    if (hit !== undefined) {
      remember(url, hit)
      return hit as T | null
    }
  }
  try {
    const res = await scryfallFetch(url, { urgent: opts.urgent, timeoutMs: opts.timeoutMs })
    if (res.status === 404) {
      remember(url, null)
      return null
    }
    if (!res.ok) return null
    const value = slimCard(await res.json())
    remember(url, value)
    if (opts.persist) void idbPut(url, value)
    return value as T
  } catch {
    return null
  }
}

/**
 * GET JSON con caché en memoria (incluye los 404), deduplicación de peticiones
 * en vuelo y, con `persist`, caché en IndexedDB de 7 días. Nunca lanza: devuelve
 * null ante 404, error HTTP o de red (estos dos últimos no se cachean).
 */
export function scryfallJson<T = unknown>(url: string, opts: ScryfallJsonOptions = {}): Promise<T | null> {
  if (memory.has(url)) return Promise.resolve(memory.get(url) as T | null)
  const pending = inflight.get(url)
  if (pending) return pending as Promise<T | null>
  const p = loadJson<T>(url, opts).finally(() => inflight.delete(url))
  inflight.set(url, p)
  return p
}
