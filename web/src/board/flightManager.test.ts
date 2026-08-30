import { describe, it, expect, beforeEach, vi } from 'vitest'
import { startCardFlight, getActiveFlights, subscribeFlights } from './flightManager'
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
  })

  it('starts a card flight when distance is significant', () => {
    const flightId = startCardFlight(dummyCard, fromRect, toRect, 300)
    expect(flightId).not.toBeNull()

    const active = getActiveFlights()
    expect(active.length).toBeGreaterThan(0)
    expect(active.find((f) => f.flightId === flightId)?.card.name).toBe('Lightning Bolt')
  })

  it('ignores flight if distance is too small', () => {
    const closeRect = { ...fromRect, left: 105, top: 505 } as DOMRect
    const flightId = startCardFlight(dummyCard, fromRect, closeRect)
    expect(flightId).toBeNull()
  })

  it('cleans up flights after duration expires', () => {
    const flightId = startCardFlight(dummyCard, fromRect, toRect, 200)
    expect(flightId).not.toBeNull()

    vi.advanceTimersByTime(280)
    const active = getActiveFlights()
    expect(active.find((f) => f.flightId === flightId)).toBeUndefined()
  })

  it('notifies subscribers on flight start and cleanup', () => {
    const listener = vi.fn()
    const unsubscribe = subscribeFlights(listener)

    startCardFlight(dummyCard, fromRect, toRect, 100)
    expect(listener).toHaveBeenCalled()

    vi.advanceTimersByTime(180)
    expect(listener.mock.calls.length).toBeGreaterThan(1)

    unsubscribe()
  })
})
