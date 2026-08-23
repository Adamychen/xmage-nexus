import { fireEvent, render } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import ResourceBar from './ResourceBar'
import type { PlayerView } from '../net/types'
import { makePlayer } from '../__fixtures__/gameViews'

describe('ResourceBar', () => {
  const basePlayer: PlayerView = makePlayer({
    playerId: 'p-1',
    name: 'Alice',
    controlled: true,
    isHuman: true,
    life: 20,
    libraryCount: 40,
    handCount: 7,
    isActive: true,
    hasPriority: true,
    manaPool: { white: 0, blue: 1, black: 0, red: 2, green: 0, colorless: 0 },
    graveyard: {},
    exile: {},
  })

  it('renders placeholders when graveyard and exile are empty', () => {
    const { container } = render(<ResourceBar player={basePlayer} side="my" />)

    const graveyardBack = container.querySelector('.graveyard-back')
    expect(graveyardBack).toBeTruthy()

    const exileBack = container.querySelector('.exile-back')
    expect(exileBack).toBeTruthy()
  })

  it('renders the top card image for graveyard and exile when cards are present', () => {
    const onCardHover = vi.fn()
    const playerWithPiles: PlayerView = {
      ...basePlayer,
      graveyard: {
        'c-1': { id: 'c-1', name: 'Lightning Bolt', manaValue: 1, cardNumber: '10', expansionSetCode: 'lea' },
        'c-2': { id: 'c-2', name: 'Snapcaster Mage', manaValue: 2, cardNumber: '20', expansionSetCode: 'isd' },
      },
      exile: {
        'c-3': { id: 'c-3', name: 'Force of Will', manaValue: 5, cardNumber: '30', expansionSetCode: 'all' },
      },
    }

    const { container } = render(
      <ResourceBar player={playerWithPiles} side="my" onCardHover={onCardHover} />
    )

    // Graveyard stack should render Snapcaster Mage (top card)
    const gyStack = container.querySelector('.graveyard-stack')
    expect(gyStack?.classList.contains('has-card-img')).toBe(true)
    const gyCardSlot = gyStack?.querySelector('.card-slot')
    expect(gyCardSlot).toBeTruthy()
    expect(gyCardSlot?.getAttribute('data-card-name')).toBe('Snapcaster Mage')

    // Exile stack should render Force of Will (top card)
    const exStack = container.querySelector('.exile-stack')
    expect(exStack?.classList.contains('has-card-img')).toBe(true)
    const exCardSlot = exStack?.querySelector('.card-slot')
    expect(exCardSlot).toBeTruthy()
    expect(exCardSlot?.getAttribute('data-card-name')).toBe('Force of Will')

    // Hover over graveyard stack triggers onCardHover with Snapcaster Mage
    fireEvent.mouseEnter(gyStack!)
    expect(onCardHover).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'Snapcaster Mage' }),
      expect.anything()
    )

    // Mouse leave clears hover
    fireEvent.mouseLeave(gyStack!)
    expect(onCardHover).toHaveBeenCalledWith(null)
  })

  it('renders cross-zone playable card image with mini badge on ray stack', () => {
    const onCardHover = vi.fn()
    const crossZonePlayables = [
      {
        id: 'c-flashback',
        card: { id: 'c-flashback', name: 'Faithless Looting', manaValue: 1 },
        value: 'Cast with Flashback',
        zone: 'graveyard',
      },
    ]

    const { container } = render(
      <ResourceBar
        player={basePlayer}
        side="my"
        crossZonePlayables={crossZonePlayables}
        onCardHover={onCardHover}
      />
    )

    const rayStack = container.querySelector('.ray-stack')
    expect(rayStack?.classList.contains('has-card-img')).toBe(true)
    expect(rayStack?.querySelector('.ray-mini-badge')).toBeTruthy()

    const rayCard = rayStack?.querySelector('.card-slot')
    expect(rayCard?.getAttribute('data-card-name')).toBe('Faithless Looting')
  })
})
