import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import {
  startCardFlight,
  getActiveFlights,
  subscribeFlights,
  hasFlightFor,
  getFlightFor,
  onFlightLanded,
  markFlightLanded,
  clearFlights,
} from './flightManager'
import type { CardView } from '../net/types'

describe('flightManager', () => {
  const dummyCard: CardView = {
    id: 'card-1',
    name: 'Lightning Bolt',
    manaValue: 1,
    expansionSetCode: 'LEA',
    cardNumber: '161',
  }

  const fromRect = {
    left: 100,
    top: 500,
    right: 200,
    bottom: 640,
    width: 100,
    height: 140,
    x: 100,
    y: 500,
    toJSON: () => {},
  } as DOMRect

  const toRect = {
    left: 400,
    top: 200,
    right: 500,
    bottom: 340,
    width: 100,
    height: 140,
    x: 400,
    y: 200,
    toJSON: () => {},
  } as DOMRect

  beforeEach(() => {
    vi.useFakeTimers()
    clearFlights()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('starts a card flight when distance is significant', () => {
    const flightId = startCardFlight(dummyCard, fromRect, toRect, 300)
    expect(flightId).not.toBeNull()

    const active = getActiveFlights()
    expect(active.length).toBeGreaterThan(0)
    expect(active.find((f) => f.flightId === flightId)?.card.name).toBe('Lightning Bolt')
  })

  it('stores the toSelector so the overlay can retarget mid-flight', () => {
    startCardFlight(dummyCard, fromRect, toRect, 300, '[data-card-id="card-1"]')

    const active = getActiveFlights()
    expect(active[0].toSelector).toBe('[data-card-id="card-1"]')
  })

  it('keeps toSelector undefined when omitted', () => {
    startCardFlight(dummyCard, fromRect, toRect, 300)

    const active = getActiveFlights()
    expect(active[0].toSelector).toBeUndefined()
  })

  it('ignores flight if distance is too small', () => {
    const closeRect = { ...fromRect, left: 105, top: 505 } as DOMRect
    const flightId = startCardFlight(dummyCard, fromRect, closeRect)
    expect(flightId).toBeNull()
  })

  it('skips flights when prefers-reduced-motion is set', () => {
    const matchMedia = vi.fn().mockReturnValue({ matches: true })
    vi.stubGlobal('matchMedia', matchMedia)
    window.matchMedia = matchMedia as unknown as typeof window.matchMedia
    const flightId = startCardFlight(dummyCard, fromRect, toRect, 300)
    expect(flightId).toBeNull()
    vi.unstubAllGlobals()
    delete (window as { matchMedia?: unknown }).matchMedia
  })

  it('cleans up flights after duration plus landing window expires', () => {
    const flightId = startCardFlight(dummyCard, fromRect, toRect, 200)
    expect(flightId).not.toBeNull()

    vi.advanceTimersByTime(220)
    expect(getActiveFlights().find((f) => f.flightId === flightId)).not.toBeUndefined()

    vi.advanceTimersByTime(300)
    expect(getActiveFlights().find((f) => f.flightId === flightId)).toBeUndefined()
  })

  it('notifies subscribers on flight start and cleanup', () => {
    const listener = vi.fn()
    const unsubscribe = subscribeFlights(listener)

    startCardFlight(dummyCard, fromRect, toRect, 100)
    expect(listener).toHaveBeenCalled()

    vi.advanceTimersByTime(500)
    expect(listener.mock.calls.length).toBeGreaterThan(1)

    unsubscribe()
  })

  it('tracks flights by cardId', () => {
    expect(hasFlightFor('card-1')).toBe(false)
    startCardFlight(dummyCard, fromRect, toRect, 300)
    expect(hasFlightFor('card-1')).toBe(true)
    expect(getFlightFor('card-1')?.card.name).toBe('Lightning Bolt')
    vi.advanceTimersByTime(600)
    expect(hasFlightFor('card-1')).toBe(false)
  })

  it('deduplicates: second flight for the same cardId cancels the first', () => {
    const firstId = startCardFlight(dummyCard, fromRect, toRect, 500)
    expect(firstId).not.toBeNull()
    expect(getActiveFlights().length).toBe(1)

    const altDest = { ...toRect, left: 700, top: 100 } as DOMRect
    const secondId = startCardFlight(dummyCard, fromRect, altDest, 500)
    expect(secondId).not.toBeNull()

    const active = getActiveFlights()
    expect(active.length).toBe(1)
    expect(active[0].flightId).toBe(secondId)
    expect(active.find((f) => f.flightId === firstId)).toBeUndefined()
  })

  it('notifies landed listeners once and cleans them up on removal', () => {
    const landed = vi.fn()
    const flightId = startCardFlight(dummyCard, fromRect, toRect, 200)
    expect(flightId).not.toBeNull()

    const off = onFlightLanded(flightId!, landed)

    markFlightLanded(flightId!)
    expect(landed).toHaveBeenCalledTimes(1)

    markFlightLanded(flightId!)
    expect(landed).toHaveBeenCalledTimes(1)

    off()
    markFlightLanded(flightId!)
    expect(landed).toHaveBeenCalledTimes(1)
  })

  it('drops landed listeners when the dedupe replaces a flight', () => {
    const landed = vi.fn()
    const firstId = startCardFlight(dummyCard, fromRect, toRect, 500)
    onFlightLanded(firstId!, landed)

    const altDest = { ...toRect, left: 700, top: 100 } as DOMRect
    startCardFlight(dummyCard, fromRect, altDest, 500)

    markFlightLanded(firstId!)
    expect(landed).not.toHaveBeenCalled()
  })
})
