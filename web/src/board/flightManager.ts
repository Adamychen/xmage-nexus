import { useSyncExternalStore } from 'react'
import type { CardView, PermanentView } from '../net/types'

export interface FlightRecord {
  flightId: string
  cardId: string
  card: CardView | PermanentView
  fromRect: DOMRect
  toRect: DOMRect
  startTime: number
  duration: number
}

let activeFlights: FlightRecord[] = []
let flightCounter = 0
const listeners = new Set<() => void>()

function notify() {
  listeners.forEach((fn) => fn())
}

export function startCardFlight(
  card: CardView | PermanentView,
  fromRect: DOMRect,
  toRect: DOMRect,
  duration = 360
): string | null {
  if (!fromRect || !toRect) return null
  if (fromRect.width <= 0 || toRect.width <= 0) return null

  // Distance check
  const dx = toRect.left - fromRect.left
  const dy = toRect.top - fromRect.top
  if (Math.hypot(dx, dy) < 25) return null

  const flightId = `flight-${++flightCounter}-${Date.now()}`
  const record: FlightRecord = {
    flightId,
    cardId: card.id || (card as any).parentId || flightId,
    card,
    fromRect,
    toRect,
    startTime: performance.now(),
    duration,
  }

  activeFlights = [...activeFlights, record]
  notify()

  setTimeout(() => {
    activeFlights = activeFlights.filter((f) => f.flightId !== flightId)
    notify()
  }, duration + 60)

  return flightId
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
