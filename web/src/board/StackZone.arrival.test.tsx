import { act, render } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { RecordedStackEntry } from './StackZone'
import { clearFlights, markFlightLanded, startCardFlight } from './flightManager'
import { clearStackArrivals, primeStackArrivals } from './stackLinks'
import { clearCardPositionRegistry } from './cardPositionRegistry'
import { makeCard, makeGameView, makePlayer } from '../__fixtures__/gameViews'
import type { CardView } from '../net/types'

const SPELL = 'bolt-spell'

function rect(left: number, top: number): DOMRect {
  return {
    left, top, width: 100, height: 140, right: left + 100, bottom: top + 140, x: left, y: top,
    toJSON: () => ({}),
  } as DOMRect
}

const spell = (): CardView => makeCard({ id: SPELL, name: 'Lightning Bolt', cardTypes: ['INSTANT'] })

function entry() {
  return render(
    <RecordedStackEntry id={SPELL} className="stack-card is-top">
      <div className="stack-thumb" />
    </RecordedStackEntry>,
  )
}

function classOf(container: HTMLElement): string {
  return container.querySelector(`[data-card-id="${SPELL}"]`)?.className ?? ''
}

/** The update that puts the spell on the stack, read the way the engine reads it. */
function prime() {
  const me = makePlayer({ playerId: 'p1', name: 'A', controlled: true })
  primeStackArrivals(makeGameView({ players: [me], stack: {} }), makeGameView({ players: [me], stack: { [SPELL]: spell() } }))
}

function fly(): string {
  const id = startCardFlight(spell(), rect(0, 600), rect(900, 200), 400, `[data-card-id="${SPELL}"] .stack-thumb`)
  expect(id).not.toBeNull()
  return id as string
}

describe('FX-14: a spell flying to the stack is handed over where it lands', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    clearFlights()
    clearStackArrivals()
    clearCardPositionRegistry()
  })

  afterEach(() => {
    vi.useRealTimers()
    clearFlights()
    clearStackArrivals()
  })

  it('FX-14: an object the engine is about to fly there keeps its place empty from the first frame', () => {
    prime()
    const { container } = entry()
    expect(classOf(container)).toContain('stack-entry-waiting')
  })

  it('FX-14: it stays off the cascade while its clone is in the air, and is shown the instant it lands', () => {
    prime()
    const { container } = entry()
    let flightId = ''
    act(() => {
      flightId = fly()
    })
    expect(classOf(container)).toContain('stack-entry-arriving')
    expect(classOf(container)).not.toContain('stack-entry-waiting')

    act(() => {
      markFlightLanded(flightId)
    })
    expect(classOf(container)).toBe('stack-card is-top')
  })

  it('FX-14: a flight dropped before it lands never leaves the card hidden', () => {
    prime()
    const { container } = entry()
    act(() => {
      fly()
    })
    expect(classOf(container)).toContain('stack-entry-arriving')
    act(() => {
      clearFlights()
    })
    expect(classOf(container)).toBe('stack-card is-top')
  })

  it('FX-14: an object that is marked but never flown shows itself rather than waiting for ever', () => {
    prime()
    const { container } = entry()
    expect(classOf(container)).toContain('stack-entry-waiting')
    act(() => {
      vi.advanceTimersByTime(200)
    })
    expect(classOf(container)).toBe('stack-card is-top')
  })

  it('FX-14: an object nobody announced is drawn as it always was', () => {
    const { container } = entry()
    expect(classOf(container)).toBe('stack-card is-top')
  })
})
