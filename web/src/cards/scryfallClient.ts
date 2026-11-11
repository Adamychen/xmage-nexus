import { createStore, get, set, type UseStore } from 'idb-keyval'

export interface ScryfallFetchOptions extends Omit<RequestInit, 'headers'> {
  headers?: Record<string, string>
  urgent?: boolean
  timeoutMs?: number
}

export interface ScryfallPacing {
  spacingMs: number
  limitedSpacingMs: number
  maxConcurrent: number
  maxAttempts: number
}

const DEFAULT_PACING: ScryfallPacing = { spacingMs: 150, limitedSpacingMs: 500, maxConcurrent: 3, maxAttempts: 3 }
const DEFAULT_BACKOFF_MS = 2000
const MAX_BACKOFF_MS = 30_000
const RATE_LIMIT_BLOCK_MS = 30_000
const MAX_RETRY_AFTER_MS = 60_000
const RATE_LIMITED_PATHS = ['/cards/search', '/cards/named', '/cards/random', '/cards/collection']
const DEFAULT_TIMEOUT_MS = 15_000
const MAX_MEMORY_ENTRIES = 4000
const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000
const DB_NAME = 'xmage-scryfall-cache'
const DB_STORE = 'cards'
const CACHE_VERSION = 'v2|'

interface Task {
  url: string
  init: ScryfallFetchOptions
  limited: boolean
  attempts: number
  resolve: (res: Response) => void
  reject: (err: unknown) => void
}

let pacing: ScryfallPacing = { ...DEFAULT_PACING }
let active = 0
let nextSlotAt = 0
let nextLimitedSlotAt = 0
let blockedUntil = 0
let networkBlockedUntil = 0
let networkWindowMs = 0
let timer: ReturnType<typeof setTimeout> | null = null
const urgentQueue: Task[] = []
const queue: Task[] = []

const memory = new Map<string, unknown>()
const inflight = new Map<string, Promise<Outcome>>()
const urgentUrls = new Set<string>()

const BUS_NAME = 'xmage-scryfall-budget'
type BusMessage =
  | { slotAt: number }
  | { limitedSlotAt: number }
  | { blockedUntil: number }
  | { networkBlockedUntil: number }
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
      if ('limitedSlotAt' in msg && Number.isFinite(msg.limitedSlotAt)) {
        nextLimitedSlotAt = Math.max(nextLimitedSlotAt, msg.limitedSlotAt)
      }
      if ('blockedUntil' in msg && Number.isFinite(msg.blockedUntil) && msg.blockedUntil > blockedUntil) {
        blockedUntil = msg.blockedUntil
        notifyThrottle()
      }
      if ('networkBlockedUntil' in msg && Number.isFinite(msg.networkBlockedUntil)) {
        networkBlockedUntil = Math.max(networkBlockedUntil, msg.networkBlockedUntil)
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

function retryAfterMs(res: Response, fallbackMs: number): number {
  const raw = res.headers?.get?.('Retry-After')
  const seconds = raw ? Number.parseInt(raw, 10) : Number.NaN
  if (!Number.isFinite(seconds) || seconds < 0) return fallbackMs
  return Math.min(seconds * 1000, MAX_RETRY_AFTER_MS)
}

/**
 * Scryfall allows 2 requests per second on these endpoints (10 on the rest of
 * the API), and answers a burst with a 429 that blocks the IP for 30 s.
 */
export function isRateLimitedScryfallUrl(url: string): boolean {
  try {
    const { hostname, pathname } = new URL(url)
    return hostname === 'api.scryfall.com' && RATE_LIMITED_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`))
  } catch {
    return false
  }
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

function networkFailure() {
  const now = Date.now()
  if (now < networkBlockedUntil) return
  networkWindowMs = Math.min(networkWindowMs > 0 ? networkWindowMs * 2 : DEFAULT_BACKOFF_MS, MAX_BACKOFF_MS)
  networkBlockedUntil = now + networkWindowMs
  announce({ networkBlockedUntil })
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

/** First task of `list` that may start now, or the time the earliest one may. */
function nextReady(list: Task[], baseAt: number, now: number): { index: number; at: number } {
  if (list.length === 0) return { index: -1, at: Infinity }
  if (baseAt > now) return { index: -1, at: baseAt }
  const limitedAt = Math.max(baseAt, nextLimitedSlotAt)
  for (let i = 0; i < list.length; i++) {
    if (!list[i].limited || limitedAt <= now) return { index: i, at: now }
  }
  return { index: -1, at: limitedAt }
}

function pump() {
  if (timer) {
    clearTimeout(timer)
    timer = null
  }
  while (active < pacing.maxConcurrent) {
    const now = Date.now()
    const slotAt = Math.max(nextSlotAt, blockedUntil)
    const urgent = nextReady(urgentQueue, slotAt, now)
    const background = urgent.index === -1 ? nextReady(queue, Math.max(slotAt, networkBlockedUntil), now) : null
    if (urgent.index === -1 && (!background || background.index === -1)) {
      const wakeAt = Math.min(urgent.at, background?.at ?? Infinity)
      if (timer) clearTimeout(timer)
      timer = wakeAt === Infinity ? null : setTimeout(() => {
        timer = null
        pump()
      }, wakeAt - now)
      return
    }
    const [list, index] = urgent.index !== -1 ? [urgentQueue, urgent.index] : [queue, background!.index]
    const [task] = list.splice(index, 1)
    if (task.init.signal?.aborted) {
      task.reject(abortError())
      continue
    }
    nextSlotAt = now + pacing.spacingMs
    announce({ slotAt: nextSlotAt })
    if (task.limited) {
      nextLimitedSlotAt = now + pacing.limitedSpacingMs
      announce({ limitedSlotAt: nextLimitedSlotAt })
    }
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
  const timeout = setTimeout(() => controller.abort(), timeoutMs ?? DEFAULT_TIMEOUT_MS)
  try {
    const res = await fetch(task.url, {
      ...rest,
      headers: { Accept: 'application/json', ...headers },
      signal: controller.signal,
    })
    networkWindowMs = 0
    if (res.status === 429 || res.status === 503) {
      throttle(retryAfterMs(res, res.status === 429 ? RATE_LIMIT_BLOCK_MS : DEFAULT_BACKOFF_MS))
      if (task.attempts < pacing.maxAttempts) {
        ;(task.init.urgent ? urgentQueue : queue).unshift(task)
        return
      }
    }
    task.resolve(res)
  } catch (err) {
    if (err instanceof TypeError) networkFailure()
    task.reject(err)
  } finally {
    clearTimeout(timeout)
    signal?.removeEventListener('abort', onAbort)
    active = Math.max(0, active - 1)
    pump()
  }
}

/**
 * fetch to api.scryfall.com through one global queue: a minimum gap between
 * requests (a wider one on the rate-limited endpoints), a concurrency cap, and
 * a common pause on 429 (Retry-After, or Scryfall's 30 s block) and 503, after
 * which the request is retried. Every API request goes through here so they
 * all share one budget.
 */
export function scryfallFetch(url: string, init: ScryfallFetchOptions = {}): Promise<Response> {
  return new Promise<Response>((resolve, reject) => {
    if (init.signal?.aborted) {
      reject(abortError())
      return
    }
    const task: Task = { url, init, limited: isRateLimitedScryfallUrl(url), attempts: 0, resolve, reject }
    if (init.urgent) urgentQueue.push(task)
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
  urgentQueue.length = 0
  queue.length = 0
  active = 0
  nextSlotAt = 0
  nextLimitedSlotAt = 0
  blockedUntil = 0
  networkBlockedUntil = 0
  networkWindowMs = 0
  memory.clear()
  inflight.clear()
  urgentUrls.clear()
  pacing = { ...DEFAULT_PACING }
}

function promoteQueued(url: string) {
  urgentUrls.add(url)
  const at = queue.findIndex((task) => task.url === url)
  if (at === -1) return
  const [task] = queue.splice(at, 1)
  task.init = { ...task.init, urgent: true }
  urgentQueue.push(task)
  pump()
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

let cacheStore: UseStore | null | undefined

function getCacheStore(): UseStore | null {
  if (cacheStore !== undefined) return cacheStore
  try {
    if (typeof indexedDB === 'undefined' || !indexedDB) {
      cacheStore = null
      return null
    }
    cacheStore = createStore(DB_NAME, DB_STORE)
  } catch {
    cacheStore = null
  }
  return cacheStore
}

async function idbGet(url: string): Promise<unknown | undefined> {
  const store = getCacheStore()
  if (!store) return undefined
  try {
    const entry = await get<{ value: unknown; at: number }>(CACHE_VERSION + url, store)
    return entry && Date.now() - entry.at < CACHE_TTL_MS ? entry.value : undefined
  } catch {
    return undefined
  }
}

async function idbPut(url: string, value: unknown) {
  const store = getCacheStore()
  if (!store) return
  try {
    await set(CACHE_VERSION + url, { value, at: Date.now() }, store)
  } catch {}
}

const CARD_FIELDS = [
  'id', 'object', 'name', 'printed_name', 'lang', 'set', 'collector_number', 'layout',
  'mana_cost', 'cmc', 'type_line', 'printed_type_line', 'oracle_text', 'printed_text', 'keywords',
  'colors', 'color_identity', 'rarity', 'legalities', 'power', 'toughness', 'loyalty',
] as const
const FACE_FIELDS = [
  'name', 'printed_name', 'mana_cost', 'type_line', 'printed_type_line', 'oracle_text', 'printed_text',
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
  /** Reject with ScryfallUnavailableError instead of resolving null when Scryfall did not answer. */
  rejectOnFailure?: boolean
}

/** Scryfall did not answer (network error, throttled past every retry, or an HTTP error other than 404). */
export class ScryfallUnavailableError extends Error {
  constructor(readonly url: string) {
    super(`Scryfall did not answer: ${url}`)
    this.name = 'ScryfallUnavailableError'
  }
}

type Outcome = { found: true; value: unknown } | { found: false; missing: boolean }

async function loadJson(url: string, opts: ScryfallJsonOptions): Promise<Outcome> {
  if (opts.persist) {
    const hit = await idbGet(url)
    if (hit !== undefined) {
      remember(url, hit)
      return hit === null ? { found: false, missing: true } : { found: true, value: hit }
    }
  }
  try {
    const res = await scryfallFetch(url, { urgent: opts.urgent || urgentUrls.has(url), timeoutMs: opts.timeoutMs })
    if (res.status === 404) {
      remember(url, null)
      return { found: false, missing: true }
    }
    if (!res.ok) return { found: false, missing: false }
    const value = slimCard(await res.json())
    remember(url, value)
    if (opts.persist) void idbPut(url, value)
    return { found: true, value }
  } catch {
    return { found: false, missing: false }
  }
}

function settle<T>(url: string, outcome: Outcome, opts: ScryfallJsonOptions): T | null {
  if (outcome.found) return outcome.value as T
  if (!outcome.missing && opts.rejectOnFailure) throw new ScryfallUnavailableError(url)
  return null
}

/**
 * GET JSON con caché en memoria (incluye los 404), deduplicación de peticiones
 * en vuelo y, con `persist`, caché en IndexedDB de 7 días. Nunca lanza: devuelve
 * null ante 404, error HTTP o de red (estos dos últimos no se cachean), salvo con
 * `rejectOnFailure`, que separa "no existe" (null) de "Scryfall no respondió".
 */
export async function scryfallJson<T = unknown>(url: string, opts: ScryfallJsonOptions = {}): Promise<T | null> {
  if (memory.has(url)) return memory.get(url) as T | null
  let pending = inflight.get(url)
  if (pending) {
    if (opts.urgent) promoteQueued(url)
  } else {
    if (opts.urgent) urgentUrls.add(url)
    pending = loadJson(url, opts).finally(() => {
      inflight.delete(url)
      urgentUrls.delete(url)
    })
    inflight.set(url, pending)
  }
  return settle<T>(url, await pending, opts)
}

/**
 * The cached answer for `url` without asking Scryfall: the JSON, null for a
 * remembered 404, or undefined when nothing is cached (memory, then IndexedDB
 * with `persist`).
 */
export async function scryfallCachedJson<T = unknown>(url: string, opts: { persist?: boolean } = {}): Promise<T | null | undefined> {
  if (memory.has(url)) return memory.get(url) as T | null
  if (!opts.persist) return undefined
  const hit = await idbGet(url)
  if (hit === undefined) return undefined
  remember(url, hit)
  return hit as T | null
}

/**
 * Stores an answer obtained some other way (a batch request) under the URL a
 * single lookup would use, so that lookup is served from the cache. A null
 * value records a 404 in memory only, like a real one.
 */
export function primeScryfallJson<T = unknown>(url: string, value: unknown, opts: { persist?: boolean } = {}): T | null {
  if (value === null) {
    remember(url, null)
    return null
  }
  const slim = slimCard(value)
  remember(url, slim)
  if (opts.persist) void idbPut(url, slim)
  return slim as T
}
