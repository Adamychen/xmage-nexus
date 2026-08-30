import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, cleanup } from '@testing-library/react'
import FlyingCardOverlay from './FlyingCardOverlay'
import { startCardFlight } from './flightManager'
import type { CardView } from '../net/types'

describe('FlyingCardOverlay', () => {
  const dummyCard: CardView = {
    id: 'card-bolt',
    name: 'Lightning Bolt',
    manaValue: 1,
    expansionSetCode: 'LEA',
    cardNumber: '161',
  }

  const fromRect = {
    left: 50,
    top: 600,
    right: 150,
    bottom: 740,
    width: 100,
    height: 140,
    x: 50,
    y: 600,
    toJSON: () => {},
  } as DOMRect

  const toRect = {
    left: 500,
    top: 250,
    right: 600,
    bottom: 390,
    width: 100,
    height: 140,
    x: 500,
    y: 250,
    toJSON: () => {},
  } as DOMRect

  beforeEach(() => {
    vi.clearAllTimers()
  })

  afterEach(() => {
    cleanup()
  })

  it('renders nothing when there are no active flights', () => {
    const { container } = render(<FlyingCardOverlay />)
    expect(container.firstChild).toBeNull()
  })

  it('renders flying card overlay when a flight is triggered', () => {
    startCardFlight(dummyCard, fromRect, toRect, 300)

    const { getAllByText } = render(<FlyingCardOverlay />)
    expect(getAllByText(/Lightning Bolt/i).length).toBeGreaterThan(0)
  })
})
