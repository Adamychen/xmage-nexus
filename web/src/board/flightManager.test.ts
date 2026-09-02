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
  normalizeFlightRect,
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

describe('normalizeFlightRect', () => {
  const CENTER_TOLERANCE = 0.51

  beforeEach(() => {
    clearFlights()
  })
  const baseRect = {
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
  const destRect = {
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
  const card: CardView = {
    id: 'norm-card-1',
    name: 'Lightning Bolt',
    manaValue: 1,
    expansionSetCode: 'LEA',
    cardNumber: '161',
  }

  function centerOf(rect: DOMRect) {
    return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 }
  }

  it('keeps card-shaped rects untouched', () => {
    const { rect, rotated90 } = normalizeFlightRect(baseRect)
    expect(rotated90).toBe(false)
    expect(rect.width).toBe(100)
    expect(rect.height).toBe(140)
  })

  it('detects a tapped card (90° AABB) and restores the portrait shape', () => {
    const tappedAabb = { ...baseRect, width: 140, height: 100, right: 240, bottom: 600 } as DOMRect
    const { rect, rotated90 } = normalizeFlightRect(tappedAabb)
    expect(rotated90).toBe(true)
    expect(rect.width).toBe(100)
    expect(rect.height).toBe(140)
    const origin = centerOf(tappedAabb)
    const out = centerOf(rect)
    expect(Math.abs(out.x - origin.x)).toBeLessThan(CENTER_TOLERANCE)
    expect(Math.abs(out.y - origin.y)).toBeLessThan(CENTER_TOLERANCE)
  })

  it('derives a card shape from a wide strip (stack rows)', () => {
    const strip = { ...baseRect, width: 200, height: 40, right: 300, bottom: 540 } as DOMRect
    const { rect, rotated90 } = normalizeFlightRect(strip)
    expect(rotated90).toBe(false)
    expect(rect.width).toBeGreaterThanOrEqual(44)
    expect(rect.height / rect.width).toBeCloseTo(1.4, 1)
    const origin = centerOf(strip)
    const out = centerOf(rect)
    expect(Math.abs(out.x - origin.x)).toBeLessThan(CENTER_TOLERANCE)
    expect(Math.abs(out.y - origin.y)).toBeLessThan(CENTER_TOLERANCE)
  })

  it('derives a card shape from a tall strip (vertical panels)', () => {
    const strip = { ...baseRect, width: 100, height: 600, bottom: 1100 } as DOMRect
    const { rect } = normalizeFlightRect(strip)
    expect(rect.height / rect.width).toBeCloseTo(1.4, 1)
  })

  it('uses the known source size when provided (immune to transforms)', () => {
    const rotated = { ...baseRect, width: 140, height: 100, right: 240, bottom: 600 } as DOMRect
    const { rect, rotated90 } = normalizeFlightRect(rotated, { w: 100, h: 140 })
    expect(rotated90).toBe(false)
    expect(rect.width).toBe(100)
    expect(rect.height).toBe(140)
  })

  it('keeps tiny size-known cards untouched (real thumbs are small)', () => {
    const tiny = { ...baseRect, width: 30, height: 42, right: 130, bottom: 542 } as DOMRect
    const { rect, rotated90 } = normalizeFlightRect(tiny, { w: 30, h: 42 })
    expect(rotated90).toBe(false)
    expect(rect.width).toBe(30)
    expect(rect.height).toBe(42)
  })

  it('marks flights as rotated90 when starting from a tapped card', () => {
    const tappedAabb = { ...baseRect, width: 140, height: 100, right: 240, bottom: 600 } as DOMRect
    startCardFlight(card, tappedAabb, destRect, 300)
    const flight = getActiveFlights()[0]
    expect(flight?.rotated90).toBe(true)
    expect(flight?.fromRect.width).toBe(100)
    expect(flight?.fromRect.height).toBe(140)
  })
})
