import { useSyncExternalStore } from 'react'
import type { CardView, PermanentView } from '../net/types'

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

export function startCardFlight(
  card: CardView | PermanentView,
  fromRect: DOMRect,
  toRect: DOMRect,
  duration = 360,
  toSelector?: string
): string | null {
  if (!fromRect || !toRect) return null
  if (fromRect.width <= 0 || toRect.width <= 0) return null
  if (prefersReducedMotion()) return null

  // Distance check
  const dx = toRect.left - fromRect.left
  const dy = toRect.top - fromRect.top
  if (Math.hypot(dx, dy) < 25) return null

  const cardId = (card as any).id || (card as any).parentId || ''

  if (cardId) {
    const existing = activeFlights.find((f) => f.cardId === cardId)
    if (existing) {
      activeFlights = activeFlights.filter((f) => f.flightId !== existing.flightId)
      landedListeners.delete(existing.flightId)
    }
  }

  const flightId = `flight-${++flightCounter}-${Date.now()}`
  const record: FlightRecord = {
    flightId,
    cardId: cardId || flightId,
    card,
    fromRect,
    toRect,
    toSelector,
    startTime: performance.now(),
    duration,
  }

  activeFlights = [...activeFlights, record]
  notify()

  // Backstop: si el clon no llega a notificar el aterrizaje (cancel/unmount),
  // la carta real nunca queda oculta.
  setTimeout(() => markFlightLanded(flightId), duration + 120)

  // El clon permanece montado durante el fade-out posterior al aterrizaje.
  setTimeout(() => {
    activeFlights = activeFlights.filter((f) => f.flightId !== flightId)
    landedListeners.delete(flightId)
    notify()
  }, duration + 240)

  return flightId
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
  activeFlights = []
  landedListeners.clear()
  notify()
}
