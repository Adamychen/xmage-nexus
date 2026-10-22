import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { StrictMode } from 'react'
import { act, cleanup, render } from '@testing-library/react'
import CardSlot from './CardSlot'
import { clearFlights } from './flightManager'
import { getPreviousCardPosition } from './cardPositionRegistry'
import type { PermanentView } from '../net/types'
import { combatHoldRemaining } from './combatStrikes'

const listeners = vi.hoisted(() => ({ subscribed: 0, unsubscribed: 0, landed: 0, landedOff: 0 }))

vi.mock('./cardPositionRegistry', () => ({
  getPreviousCardPosition: vi.fn(() => ({ left: 0, top: 0, width: 63, height: 88, right: 63, bottom: 88, x: 0, y: 0, toJSON: () => {} })),
  getPreviousCardZone: vi.fn(() => 'hand-zone'),
  getPreviousCardSize: vi.fn(() => null),
  recordCardPosition: vi.fn(),
}))

vi.mock('./combatStrikes', async (importOriginal) => {
  const mod = await importOriginal<typeof import('./combatStrikes')>()
  return { ...mod, combatHoldRemaining: vi.fn(() => 0) }
})

vi.mock('./flightManager', async (importOriginal) => {
  const mod = await importOriginal<typeof import('./flightManager')>()
  return {
    ...mod,
    subscribeFlights: (callback: () => void) => {
      listeners.subscribed++
      const off = mod.subscribeFlights(callback)
      return () => {
        listeners.unsubscribed++
        off()
      }
    },
    onFlightLanded: (flightId: string, callback: () => void) => {
      listeners.landed++
      const off = mod.onFlightLanded(flightId, callback)
      return () => {
        listeners.landedOff++
        off()
      }
    },
  }
})

const perm = (over: Record<string, unknown> = {}) =>
  ({
    id: 'c1',
    name: 'Grizzly Bears',
    expansionSetCode: 'DMU',
    cardNumber: '1',
    cardTypes: ['CREATURE'],
    subTypes: ['BEAR'],
    rules: [],
    power: '2',
    toughness: '2',
    ...over,
  }) as unknown as PermanentView

const rect = (left: number, top: number, width: number, height: number) =>
  ({ left, top, width, height, right: left + width, bottom: top + height, x: left, y: top, toJSON: () => {} }) as DOMRect

function mountOnBattlefield(card = perm()) {
  return render(
    <div className="player-zone">
      <div className="permanents-band">
        <CardSlot card={card} />
      </div>
    </div>,
  )
}

describe('CardSlot enter flight', () => {
  const originalRect = Element.prototype.getBoundingClientRect

  beforeEach(() => {
    vi.useFakeTimers()
    clearFlights()
    Element.prototype.getBoundingClientRect = function () {
      return this.classList?.contains('card-slot') ? rect(300, 300, 63, 88) : rect(0, 0, 0, 0)
    }
    listeners.subscribed = 0
    listeners.unsubscribed = 0
    listeners.landed = 0
    listeners.landedOff = 0
  })

  afterEach(() => {
    cleanup()
    vi.useRealTimers()
    Element.prototype.getBoundingClientRect = originalRect
  })

  it('keeps the real card hidden until its clone lands, then drops both flight classes', () => {
    const { container } = mountOnBattlefield()
    const slot = container.querySelector('.card-slot')!
    expect(slot.classList.contains('flight-hidden')).toBe(true)

    act(() => vi.advanceTimersByTime(700))
    expect(slot.classList.contains('flight-hidden')).toBe(true)
    expect(slot.classList.contains('flight-land')).toBe(false)

    act(() => vi.advanceTimersByTime(520))
    expect(slot.classList.contains('flight-hidden')).toBe(false)
    expect(slot.classList.contains('flight-land')).toBe(true)

    act(() => vi.advanceTimersByTime(180))
    expect(slot.classList.contains('flight-hidden')).toBe(false)
    expect(slot.classList.contains('flight-land')).toBe(false)
  })

  it('detaches its flight listeners and timers when unmounted', () => {
    const { unmount } = mountOnBattlefield()
    expect(listeners.subscribed).toBe(1)
    expect(listeners.landed).toBe(1)

    unmount()
    expect(listeners.unsubscribed).toBe(listeners.subscribed)
    expect(listeners.landedOff).toBe(listeners.landed)
    expect(vi.getTimerCount()).toBe(2)
  })

  it('clears the entering timer when unmounted before it fires', () => {
    vi.mocked(getPreviousCardPosition).mockReturnValueOnce(null)
    const { unmount } = mountOnBattlefield()
    unmount()
    expect(vi.getTimerCount()).toBe(0)
  })

  it('still reveals the card under StrictMode double mount (dev)', () => {
    const { container } = render(
      <StrictMode>
        <div className="player-zone">
          <div className="permanents-band">
            <CardSlot card={perm()} />
          </div>
        </div>
      </StrictMode>,
    )
    const slot = container.querySelector('.card-slot')!
    expect(slot.classList.contains('flight-hidden')).toBe(true)

    act(() => vi.advanceTimersByTime(1220))
    expect(slot.classList.contains('flight-land')).toBe(true)

    act(() => vi.advanceTimersByTime(180))
    expect(slot.classList.contains('flight-hidden')).toBe(false)
    expect(slot.classList.contains('flight-land')).toBe(false)
  })

  it('waits out a combat hold and then flies in under StrictMode double mount (dev)', () => {
    vi.mocked(combatHoldRemaining).mockReturnValueOnce(500)
    const { container } = render(
      <StrictMode>
        <div className="player-zone">
          <div className="permanents-band">
            <CardSlot card={perm()} />
          </div>
        </div>
      </StrictMode>,
    )
    const slot = container.querySelector('.card-slot')!
    expect(slot.classList.contains('flight-hidden')).toBe(true)

    act(() => vi.advanceTimersByTime(1000))
    expect(slot.classList.contains('flight-hidden')).toBe(true)

    act(() => vi.advanceTimersByTime(800))
    expect(slot.classList.contains('flight-hidden')).toBe(false)
    expect(slot.classList.contains('flight-land')).toBe(true)

    act(() => vi.advanceTimersByTime(300))
    expect(slot.classList.contains('flight-hidden')).toBe(false)
    expect(slot.classList.contains('flight-land')).toBe(false)
  })
})
