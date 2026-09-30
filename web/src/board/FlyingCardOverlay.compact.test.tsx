import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act } from 'react'
import { cleanup, render } from '@testing-library/react'
import FlyingCardOverlay from './FlyingCardOverlay'
import { clearFlights, getActiveFlights, startCardFlight } from './flightManager'
import type { CardView } from '../net/types'

vi.mock('../cards/cardImages', async (importOriginal) => {
  const mod = await importOriginal<typeof import('../cards/cardImages')>()
  return { ...mod, awaitImageUrl: vi.fn(async () => 'https://cards.scryfall.io/normal/front/a/b/ab.jpg?1') }
})

const card: CardView = {
  id: 'tezzeret',
  name: 'Tezzeret, Cruel Captain',
  manaValue: 4,
  expansionSetCode: 'EOE',
  cardNumber: '2',
}

const rect = (left: number, top: number, width: number, height: number) =>
  ({ left, top, width, height, right: left + width, bottom: top + height, x: left, y: top, toJSON: () => {} }) as DOMRect

async function renderOverlay() {
  const view = render(<FlyingCardOverlay />)
  await act(async () => {})
  return view
}

describe('FlyingCardOverlay with compact art-crop tiles', () => {
  beforeEach(() => clearFlights())
  afterEach(() => cleanup())

  it('leaves a compact tile as its landscape art crop, not the centre of the full card', async () => {
    startCardFlight(card, rect(1400, 500, 120, 90), rect(1300, 300, 60, 84), 300, undefined, {
      sourceSize: { w: 120, h: 90, compact: true },
    })
    const flight = getActiveFlights()[0]
    expect(flight.fromCompact).toBe(true)
    expect(flight.rotated90).toBeUndefined()
    expect(flight.fromRect.width).toBe(120)
    expect(flight.fromRect.height).toBe(90)

    const { container } = await renderOverlay()
    const crop = container.querySelector<HTMLImageElement>('.flying-card-crop')
    expect(crop?.getAttribute('src')).toBe('https://cards.scryfall.io/art_crop/front/a/b/ab.jpg?1')
    expect(crop?.style.opacity).toBe('1')
  })

  it('lands on a compact tile as a landscape art crop instead of a portrait card', async () => {
    startCardFlight(card, rect(200, 800, 100, 140), rect(900, 400, 120, 90), 300, undefined, { toCompact: true })
    const flight = getActiveFlights()[0]
    expect(flight.toCompact).toBe(true)
    expect(flight.toRect.width).toBe(120)
    expect(flight.toRect.height).toBe(90)

    const { container } = await renderOverlay()
    const crop = container.querySelector<HTMLImageElement>('.flying-card-crop')
    expect(crop).not.toBeNull()
    expect(crop?.style.opacity).toBe('0')
  })

  it('renders no art crop between two printed cards', async () => {
    startCardFlight(card, rect(200, 800, 100, 140), rect(900, 400, 100, 140), 300)
    const { container } = await renderOverlay()
    expect(container.querySelector('.flying-card-crop')).toBeNull()
    expect(container.querySelector('.flying-card-img')).not.toBeNull()
  })
})
