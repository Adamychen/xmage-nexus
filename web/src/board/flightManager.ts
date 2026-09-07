import { useSyncExternalStore } from 'react'
import type { CardView, PermanentView } from '../net/types'
import { fxEnabled, fxDuration } from './fx'
import type { CardSourceSize } from './cardPositionRegistry'
import { soundManager } from '../audio/soundManager'

export interface FlightRecord {
  flightId: string
  cardId: string
  card: CardView | PermanentView
  fromRect: DOMRect
  toRect: DOMRect
  /** Selector del destino real: permite re-medir en vuelo si el layout se mueve. */
  toSelector?: string
  startTime: number
  duration: number
  /** El origen era una carta girada 90° (tapped): el clon debe partir rotado. */
  rotated90?: boolean
  /** Timers de backstop/limpieza: se reprograman al encadenar un redirect. */
  timers?: Array<ReturnType<typeof setTimeout>>
}

let activeFlights: FlightRecord[] = []
let flightCounter = 0
const listeners = new Set<() => void>()
const landedListeners = new Map<string, Set<() => void>>()

function notify() {
  listeners.forEach((fn) => fn())
}

function prefersReducedMotion(): boolean {
  return typeof window !== 'undefined' && typeof window.matchMedia === 'function'
    && window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

/** Aspect w/h de una carta MTG (0.714 ≈ 63×88). */
export const FLIGHT_CARD_ASPECT = 0.714
const MIN_FLIGHT_CARD_W = 44
const MAX_FLIGHT_CARD_W = 240

function clamp(v: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, v))
}

export interface NormalizedRect {
  rect: DOMRect
  rotated90: boolean
}

/** Normaliza un rect de origen/destino a forma de carta. `getBoundingClientRect`
 *  devuelve el AABB del elemento ya transformado: una carta tapped rota 90° da un
 *  rect ancho (140×100), una fila del stack es una tira (~200×40) y un fallback de
 *  zona puede ser enorme — todo eso rompía la silueta del clon volador.
 *  - Con `size` conocida (offsetWidth/offsetHeight, sin transforms) se usa tal cual.
 *  - Rect ancho con aspect ≈ 1/aspect-carta (1.05–2.0) ⇒ carta tapped: invertir + flag.
 *  - Tiras extremas (aspect ≥ 2 o ≤ 0.45) ⇒ derivar carta del eje corto (con clamp).
 *  - Rects ya con forma de carta (aspect 0.45–1.05) ⇒ intactos (incluye thumbs pequeños).
 *  El rect resultante queda centrado en el centro del rect original. */
export function normalizeFlightRect(rect: DOMRect, size?: CardSourceSize | null): NormalizedRect {
  if (!rect || rect.width <= 0 || rect.height <= 0) return { rect, rotated90: false }

  const cx = rect.left + rect.width / 2
  const cy = rect.top + rect.height / 2
  let w = size?.w ?? rect.width
  let h = size?.h ?? rect.height
  let rotated90 = false

  if (!size) {
    const aspect = rect.width / rect.height
    if (aspect > 1.05 && aspect < 2.0) {
      // AABB de una carta girada 90° (tapped)
      w = rect.height
      h = rect.width
      rotated90 = true
    } else if (aspect >= 2.0) {
      // tira ancha (fila del stack, barra de mano): derivar del alto
      w = clamp(rect.height * FLIGHT_CARD_ASPECT, MIN_FLIGHT_CARD_W, MAX_FLIGHT_CARD_W)
      h = w / FLIGHT_CARD_ASPECT
    } else if (aspect <= 0.45) {
      // tira estrecha (panel vertical): derivar del ancho
      w = clamp(rect.width, MIN_FLIGHT_CARD_W, MAX_FLIGHT_CARD_W)
      h = w / FLIGHT_CARD_ASPECT
    }
  }

  return {
    rect: {
      left: cx - w / 2,
      top: cy - h / 2,
      width: w,
      height: h,
      right: cx + w / 2,
      bottom: cy + h / 2,
      x: cx - w / 2,
      y: cy - h / 2,
      toJSON: () => {},
    } as DOMRect,
    rotated90,
  }
}

export interface FlightOptions {
  /** Vuelo "en sitio" (origen == destino): se usa como flash de resolución
   *  (aparece y se desvanece sin desplazarse) y salta el chequeo de distancia. */
  static?: boolean
  /** Tamaño real de la carta de origen (sin transforms), si se conoce. */
  sourceSize?: CardSourceSize | null
}

// ── Diagnóstico de vuelos (F0 animaciones): cada skip silencioso deja una
// entrada con su motivo para poder cazar "a veces no va" en E2E/real. ──
export type FlightSkipReason =
  | 'zero-rect'
  | 'fx-off'
  | 'reduced-motion'
  | 'short-distance'
  | 'dedupe-cancel'
  | 'no-prev'
  | 'same-zone'
  | 'no-source'
  | 'no-dest'
  | 'guard-active-flight'

export interface FlightDiagEntry {
  t: number
  kind: 'skip' | 'start' | 'cancel' | 'chain'
  reason?: FlightSkipReason
  cardId: string
  detail?: string
}

const flightDiag: FlightDiagEntry[] = []
const FLIGHT_DIAG_CAP = 80

export function noteFlightEvent(e: Omit<FlightDiagEntry, 't'>): void {
  flightDiag.push({ t: Date.now(), ...e })
  if (flightDiag.length > FLIGHT_DIAG_CAP) {
    flightDiag.splice(0, flightDiag.length - FLIGHT_DIAG_CAP)
  }
}

export function getFlightDiagnostics(): FlightDiagEntry[] {
  return [...flightDiag]
}

export function clearFlightDiagnostics(): void {
  flightDiag.length = 0
}

if (typeof window !== 'undefined') {
  ;(window as unknown as { __mageFlights?: unknown }).__mageFlights = {
    log: getFlightDiagnostics,
    clear: clearFlightDiagnostics,
    active: getActiveFlights,
  }
}

export function startCardFlight(
  card: CardView | PermanentView,
  fromRect: DOMRect,
  toRect: DOMRect,
  duration = 360,
  toSelector?: string,
  options?: FlightOptions
): string | null {
  const cardId = (card as any)?.id || (card as any)?.parentId || ''
  const cardName = (card as any)?.name ?? ''
  if (!fromRect || !toRect) {
    noteFlightEvent({ kind: 'skip', reason: 'zero-rect', cardId, detail: `missing-${!fromRect ? 'from' : 'to'}:${cardName}` })
    return null
  }
  if (fromRect.width <= 0 || toRect.width <= 0) {
    noteFlightEvent({ kind: 'skip', reason: 'zero-rect', cardId, detail: `w${fromRect.width}x${toRect.width}:${cardName}` })
    return null
  }
  if (prefersReducedMotion()) {
    noteFlightEvent({ kind: 'skip', reason: 'reduced-motion', cardId, detail: cardName })
    return null
  }
  if (!fxEnabled()) {
    noteFlightEvent({ kind: 'skip', reason: 'fx-off', cardId, detail: cardName })
    return null
  }

  const from = normalizeFlightRect(fromRect, options?.sourceSize)
  const to = normalizeFlightRect(toRect)
  const scaledDuration = fxDuration(duration)

  // Distance check sobre los rects crudos (esquinas), igual que siempre: evita
  // vuelos intra-elemento (p.ej. origen = la propia entrada del stack).
  const dx = toRect.left - fromRect.left
  const dy = toRect.top - fromRect.top
  const dist = Math.hypot(dx, dy)
  if (!options?.static && dist < 25) {
    noteFlightEvent({ kind: 'skip', reason: 'short-distance', cardId, detail: `${Math.round(dist)}px:${cardName}` })
    return null
  }

  if (cardId) {
    const existing = activeFlights.find((f) => f.cardId === cardId)
    if (existing) {
      const age = performance.now() - existing.startTime
      const sameDest =
        Math.hypot(
          to.rect.left + to.rect.width / 2 - (existing.toRect.left + existing.toRect.width / 2),
          to.rect.top + to.rect.height / 2 - (existing.toRect.top + existing.toRect.height / 2),
        ) < 8
      if (age < 120 && sameDest) {
        // Carrera A-vs-B de la misma actualización (el slot montó y el engine
        // confirma el mismo destino ms después): no hacer nada.
        noteFlightEvent({ kind: 'skip', reason: 'guard-active-flight', cardId, detail: `same-dest:${cardName}` })
        return existing.flightId
      }
      if (age < existing.duration) {
        // Ráfaga: redirigir el fantasma en vuelo en vez de cancelarlo. El
        // overlay re-ancla el tramo final vía toSelector en cada frame, así
        // que la curva se dobla suavemente al nuevo destino sin parpadeo.
        existing.toRect = to.rect
        existing.toSelector = toSelector ?? existing.toSelector
        existing.card = card
        existing.duration = Math.min(age + Math.round(scaledDuration * 0.8), age + 1200)
        existing.timers?.forEach((t) => clearTimeout(t))
        existing.timers = scheduleFlightTimers(existing)
        activeFlights = [...activeFlights]
        notify()
        noteFlightEvent({ kind: 'chain', cardId, detail: `age-${Math.round(age)}ms:${cardName}` })
        return existing.flightId
      }
      noteFlightEvent({
        kind: 'cancel', reason: 'dedupe-cancel', cardId,
        detail: `age-${Math.round(age)}ms-of-${existing.duration}ms`,
      })
      existing.timers?.forEach((t) => clearTimeout(t))
      activeFlights = activeFlights.filter((f) => f.flightId !== existing.flightId)
      landedListeners.delete(existing.flightId)
    }
  }

  const flightId = `flight-${++flightCounter}-${Date.now()}`
  const record: FlightRecord = {
    flightId,
    cardId: cardId || flightId,
    card,
    fromRect: from.rect,
    toRect: to.rect,
    toSelector,
    startTime: performance.now(),
    duration: scaledDuration,
    rotated90: from.rotated90 || undefined,
  }

  activeFlights = [...activeFlights, record]
  notify()
  noteFlightEvent({
    kind: 'start', cardId: record.cardId,
    detail: `${Math.round(Math.hypot(to.rect.left - from.rect.left, to.rect.top - from.rect.top))}px:${(card as any)?.name ?? ''}${options?.static ? ':static' : ''}`,
  })

  if (toSelector?.includes('hand') || toSelector?.includes('hand-bar') || toSelector?.includes('hand-zone')) {
    soundManager.play('draw', 'game')
  } else if (toSelector?.includes('stack')) {
    soundManager.play('stack_cast', 'game')
  } else if (toSelector?.includes('graveyard')) {
    soundManager.play('destroy', 'game')
  } else {
    soundManager.play('play_card', 'game')
  }

  // Backstop: si el clon no llega a notificar el aterrizaje (cancel/unmount),
  // la carta real nunca queda oculta.
  record.timers = scheduleFlightTimers(record)

  return flightId
}

/** Timers de backstop + limpieza de un vuelo. Se guardan en el record para
 *  poder reprogramarlos al encadenar un redirect en ráfaga. */
function scheduleFlightTimers(record: FlightRecord): Array<ReturnType<typeof setTimeout>> {
  const { flightId, duration } = record
  return [
    setTimeout(() => markFlightLanded(flightId), duration + 120),
    // El clon permanece montado durante el fade-out posterior al aterrizaje.
    setTimeout(() => {
      activeFlights = activeFlights.filter((f) => f.flightId !== flightId)
      landedListeners.delete(flightId)
      notify()
    }, duration + 240),
  ]
}

export function getFlightFor(cardId: string): FlightRecord | null {
  if (!cardId) return null
  return activeFlights.find((f) => f.cardId === cardId) ?? null
}

export function hasFlightFor(cardId: string): boolean {
  return getFlightFor(cardId) !== null
}

/** Callback cuando el clon volador aterriza (animación terminada). Si el vuelo
 *  desaparece antes (dedupe/unmount), también se notifica para que la carta
 *  real nunca quede oculta. */
export function onFlightLanded(flightId: string, cb: () => void): () => void {
  let set = landedListeners.get(flightId)
  if (!set) {
    set = new Set()
    landedListeners.set(flightId, set)
  }
  set.add(cb)
  return () => {
    const s = landedListeners.get(flightId)
    if (!s) return
    s.delete(cb)
    if (s.size === 0) landedListeners.delete(flightId)
  }
}

export function markFlightLanded(flightId: string) {
  const set = landedListeners.get(flightId)
  if (!set) return
  landedListeners.delete(flightId)
  set.forEach((fn) => fn())
}

export function getActiveFlights(): FlightRecord[] {
  return activeFlights
}

export function subscribeFlights(callback: () => void): () => void {
  listeners.add(callback)
  return () => {
    listeners.delete(callback)
  }
}

export function useActiveFlights(): FlightRecord[] {
  return useSyncExternalStore(subscribeFlights, getActiveFlights, getActiveFlights)
}

export function clearFlights() {
  activeFlights.forEach((f) => f.timers?.forEach((t) => clearTimeout(t)))
  activeFlights = []
  landedListeners.clear()
  notify()
}
