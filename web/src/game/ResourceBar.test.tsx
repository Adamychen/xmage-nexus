import { cleanup, fireEvent, render } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import ResourceBar from './ResourceBar'
import type { PlayerView } from '../net/types'
import { makePlayer } from '../__fixtures__/gameViews'

describe('ResourceBar', () => {
  afterEach(() => {
    cleanup()
  })
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

  it('renders compact micro chips when micro={true}', () => {
    const playerWithPiles: PlayerView = {
      ...basePlayer,
      libraryCount: 84,
      graveyard: {
        'c-1': { id: 'c-1', name: 'Lightning Bolt', manaValue: 1 },
      },
      exile: {
        'c-2': { id: 'c-2', name: 'Force of Will', manaValue: 5 },
      },
    }

    const { container, getByText } = render(
      <ResourceBar player={playerWithPiles} side="opp" micro={true} />
    )

    // Resource bar has micro class
    expect(container.querySelector('.resource-bar.micro')).toBeTruthy()

    // Mana renders as always-visible inline pips (no popup button)
    const manaInline = container.querySelector('[data-testid="mana-inline"]')
    expect(manaInline).toBeTruthy()
    expect(container.querySelector('.resource-mana')).toBeNull()
    expect(container.querySelector('.mana-breakdown')).toBeNull()
    const pips = container.querySelectorAll('.mana-inline-pip')
    expect(pips.length).toBe(6)
    const counts = Array.from(container.querySelectorAll('.mana-inline-count')).map((el) => el.textContent)
    expect(counts).toEqual(['0', '1', '0', '2', '0', '0'])
    expect(container.querySelectorAll('.mana-inline-pip.is-zero').length).toBe(4)

    // Does NOT render heavy 68x96 card-sized stacks
    expect(container.querySelector('.resource-stack')).toBeNull()

    // Renders lightweight micro chips
    expect(container.querySelector('.resource-chip.library-chip')).toBeTruthy()
    expect(container.querySelector('.resource-chip.graveyard-chip')).toBeTruthy()
    expect(container.querySelector('.resource-chip.exile-chip')).toBeTruthy()

    // Displays counts in the chips
    expect(getByText('84')).toBeTruthy()
    const chipCounts = container.querySelectorAll('.chip-count')
    expect(Array.from(chipCounts).map((el) => el.textContent)).toContain('84')
    expect(Array.from(chipCounts).map((el) => el.textContent)).toContain('1')
  })

  it('always shows the ray chip in micro for my side (even at 0)', () => {
    const { container } = render(
      <ResourceBar player={basePlayer} side="my" micro={true} crossZonePlayables={[]} />
    )
    const rayChip = container.querySelector('.resource-chip.ray-chip')
    expect(rayChip).toBeTruthy()
    expect(rayChip?.classList.contains('has-playable')).toBe(false)
    expect(rayChip?.querySelector('.chip-playable-dot')).toBeNull()
    expect(rayChip?.querySelector('.chip-count')?.textContent).toBe('0')
  })

  it('hides the ray chip in micro for opponents', () => {
    const { container } = render(
      <ResourceBar player={basePlayer} side="opp" micro={true} crossZonePlayables={[]} />
    )
    expect(container.querySelector('.resource-chip.ray-chip')).toBeNull()
  })

  it('opens pile overlay when micro chip is clicked', () => {
    const playerWithPiles: PlayerView = {
      ...basePlayer,
      graveyard: {
        'c-1': { id: 'c-1', name: 'Lightning Bolt', manaValue: 1 },
      },
    }

    const { container } = render(
      <ResourceBar player={playerWithPiles} side="opp" micro={true} />
    )

    const gyChip = container.querySelector('.resource-chip.graveyard-chip')
    expect(gyChip).toBeTruthy()

    fireEvent.click(gyChip!)

    // Pile overlay opens in portal (document.body)
    expect(document.body.querySelector('.pile-overlay')).toBeTruthy()
  })
})
