import { act, cleanup, fireEvent, render } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import ResourceBar from './ResourceBar'
import type { CardView, PlayerView } from '../net/types'
import { makeCard, makeGameView, makePlayer } from '../__fixtures__/gameViews'
import { setState } from '../state/store'
import { TOP_CARD_PEEK_NAME } from './topCardPeek'

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

    expect(container.querySelector('[data-library-count]')?.getAttribute('data-library-count')).toBe('40')
    expect(container.querySelector('[data-graveyard-count]')?.getAttribute('data-graveyard-count')).toBe('0')
    expect(container.querySelector('[data-exile-count]')?.getAttribute('data-exile-count')).toBe('0')
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

  it('MNA-3: shows only the mana actually held inline, without any dropdown', () => {
    const { container } = render(<ResourceBar player={basePlayer} side="my" />)

    expect(container.querySelector('[data-testid="mana-inline"]')).toBeTruthy()
    expect(container.querySelector('.resource-mana')).toBeNull()
    expect(container.querySelector('.mana-breakdown')).toBeNull()
    const counts = Array.from(container.querySelectorAll('.mana-inline-count')).map((el) => el.textContent)
    expect(counts).toEqual(['1', '2'])
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

    // Mana renders as always-visible inline pips in every mode (no popup button)
    const manaInline = container.querySelector('[data-testid="mana-inline"]')
    expect(manaInline).toBeTruthy()
    expect(container.querySelector('.resource-mana')).toBeNull()
    expect(container.querySelector('.mana-breakdown')).toBeNull()
    const pips = container.querySelectorAll('.mana-inline-pip')
    expect(pips.length).toBe(2)
    const counts = Array.from(container.querySelectorAll('.mana-inline-count')).map((el) => el.textContent)
    expect(counts).toEqual(['1', '2'])

    // Does NOT render heavy 68x96 card-sized stacks
    expect(container.querySelector('.resource-stack')).toBeNull()

    // Renders lightweight micro chips
    expect(container.querySelector('.resource-chip.library-chip')).toBeTruthy()
    expect(container.querySelector('.resource-chip.graveyard-chip')).toBeTruthy()
    expect(container.querySelector('.resource-chip.exile-chip')).toBeTruthy()

    // Fidelity data-attrs (server value mirrored for the render checker)
    expect(container.querySelector('.library-chip')?.getAttribute('data-library-count')).toBe('84')
    expect(container.querySelector('.graveyard-chip')?.getAttribute('data-graveyard-count')).toBe('1')
    expect(container.querySelector('.exile-chip')?.getAttribute('data-exile-count')).toBe('1')

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

  it('highlights and auto-opens the graveyard pile when the target lives inside it', () => {
    const playerWithPiles: PlayerView = {
      ...basePlayer,
      graveyard: {
        'g-1': { id: 'g-1', name: 'Grizzly Bears', manaValue: 2, expansionSetCode: 'ima', cardNumber: '165' },
      },
    }

    const { container } = render(
      <ResourceBar
        player={playerWithPiles}
        side="my"
        targetIds={new Set(['g-1'])}
        targetZone="graveyard"
        targetZones={new Set(['graveyard'])}
      />,
    )

    const gyStack = container.querySelector('.graveyard-stack')
    expect(gyStack?.classList.contains('target-zone')).toBe(true)
    expect(container.querySelector('.exile-stack')?.classList.contains('target-zone')).toBe(false)

    // La pila se abre sola y la carta objetivo es clicable dentro.
    const overlay = document.body.querySelector('.pile-overlay')
    expect(overlay).toBeTruthy()
    expect(overlay?.querySelector('.pile-card.targetable')).toBeTruthy()
  })

  it('closes the auto-opened pile once the targeting ends', () => {
    const playerWithPiles: PlayerView = {
      ...basePlayer,
      graveyard: { 'g-1': { id: 'g-1', name: 'Grizzly Bears', manaValue: 2 } },
    }
    const { rerender } = render(
      <ResourceBar
        player={playerWithPiles}
        side="my"
        targetIds={new Set(['g-1'])}
        targetZone="graveyard"
        targetZones={new Set(['graveyard'])}
      />,
    )
    expect(document.body.querySelector('.pile-overlay')).toBeTruthy()

    rerender(<ResourceBar player={playerWithPiles} side="my" targetIds={new Set()} />)
    expect(document.body.querySelector('.pile-overlay')).toBeNull()
  })

  it('falls back to the declared zone only for own non-empty piles, without auto-opening hidden ids', () => {
    const playerWithPiles: PlayerView = {
      ...basePlayer,
      graveyard: { 'g-1': { id: 'g-1', name: 'Lightning Bolt', manaValue: 1 } },
    }
    const { container } = render(
      <ResourceBar
        player={playerWithPiles}
        side="my"
        targetIds={new Set(['hidden-card'])}
        targetZone="graveyard"
        targetZones={new Set()}
      />,
    )
    expect(container.querySelector('.graveyard-stack')?.classList.contains('target-zone')).toBe(true)
    expect(document.body.querySelector('.pile-overlay')).toBeNull()

    cleanup()
    const opp = render(
      <ResourceBar
        player={playerWithPiles}
        side="opp"
        targetIds={new Set(['hidden-card'])}
        targetZone="graveyard"
        targetZones={new Set()}
      />,
    )
    expect(opp.container.querySelector('.graveyard-stack')?.classList.contains('target-zone')).toBe(false)

    cleanup()
    const empty = render(
      <ResourceBar player={basePlayer} side="my" targetIds={new Set(['ghost'])} targetZone="exile" targetZones={new Set()} />,
    )
    expect(empty.container.querySelector('.exile-stack')?.classList.contains('target-zone')).toBe(false)
  })

  it('does not fall back to the own zone when the target resolved somewhere else of that kind', () => {
    const playerWithPiles: PlayerView = {
      ...basePlayer,
      graveyard: { 'g-1': { id: 'g-1', name: 'Lightning Bolt', manaValue: 1 } },
    }
    const { container } = render(
      <ResourceBar
        player={playerWithPiles}
        side="my"
        targetIds={new Set(['g-2'])}
        targetZone="graveyard"
        targetZones={new Set(['graveyard'])}
      />,
    )
    expect(container.querySelector('.graveyard-stack')?.classList.contains('target-zone')).toBe(false)
  })
})

describe('ResourceBar top-card peek', () => {
  const peeked = makeCard({ id: 'top-1', name: 'Island', parentId: 'top-1' })
  const me = (libraryCount: number) => makePlayer({ playerId: 'me', name: 'Alice', controlled: true, libraryCount })
  const showPeek = (libraryCount: number, playableIds: string[] = []) =>
    act(() =>
      setState({
        gameId: 'g-peek',
        playableIds,
        game: makeGameView({
          myPlayerId: 'me',
          players: [me(libraryCount)],
          lookedAt: [{ name: TOP_CARD_PEEK_NAME, cards: { 'top-1': peeked } }],
        }) as never,
      }),
    )

  afterEach(() => {
    act(() => setState({ game: null, gameId: null, playableIds: [] }))
    cleanup()
  })

  it('shows the peeked card next to my library and keeps it when the next view omits it', () => {
    showPeek(40)
    act(() => setState({ game: makeGameView({ myPlayerId: 'me', players: [me(40)], lookedAt: [] }) as never }))
    const { container } = render(<ResourceBar player={me(40)} side="my" />)
    const slot = container.querySelector('[data-testid="library-peek"]')
    expect(slot?.querySelector('[data-card-id="top-1"]')).not.toBeNull()
    expect(slot?.nextElementSibling?.classList.contains('library-stack')).toBe(true)
  })

  it('never shows it on an opponent bar', () => {
    showPeek(40)
    const { container } = render(<ResourceBar player={makePlayer({ playerId: 'opp', name: 'Bob', libraryCount: 40 })} side="opp" />)
    expect(container.querySelector('[data-testid="library-peek"]')).toBeNull()
  })

  it('hides it once the library size changes', () => {
    showPeek(40)
    const { container } = render(<ResourceBar player={me(39)} side="my" />)
    expect(container.querySelector('[data-testid="library-peek"]')).toBeNull()
  })

  it('plays the card from the slot when it is playable', () => {
    showPeek(40, ['top-1'])
    const onPlay = vi.fn()
    const { container } = render(<ResourceBar player={me(40)} side="my" onPlayCrossZone={onPlay} />)
    const card = container.querySelector<HTMLElement>('[data-testid="library-peek"] .card-slot')!
    expect(card.className).toMatch(/playable/)
    fireEvent.click(card)
    expect(onPlay).toHaveBeenCalledWith('top-1')
  })
})

describe('ResourceBar pileCards', () => {
  afterEach(() => {
    cleanup()
  })

  const pilePlayer = (overrides: Partial<PlayerView> = {}): PlayerView =>
    makePlayer({
      playerId: 'p-1',
      name: 'Alice',
      controlled: true,
      isHuman: true,
      libraryCount: 40,
      manaPool: { white: 0, blue: 1, black: 0, red: 2, green: 0, colorless: 0 },
      graveyard: {},
      exile: {},
      ...overrides,
    })

  it('BRD-12: pileCards draws the library face down and the graveyard and exile top cards face up, each with its count', () => {
    const player = pilePlayer({
      graveyard: {
        'c-1': { id: 'c-1', name: 'Lightning Bolt', manaValue: 1, cardNumber: '10', expansionSetCode: 'lea' },
        'c-2': { id: 'c-2', name: 'Snapcaster Mage', manaValue: 2, cardNumber: '20', expansionSetCode: 'isd' },
      },
      exile: {
        'c-3': { id: 'c-3', name: 'Force of Will', manaValue: 5, cardNumber: '30', expansionSetCode: 'all' },
      },
    })
    const { container } = render(<ResourceBar player={player} side="my" pileCards />)

    const library = container.querySelector('[data-testid="pile-card-library"]')!
    expect(library.classList.contains('pile-card--library')).toBe(true)
    expect(library.querySelector('.stack-back-img')).not.toBeNull()
    expect(library.querySelector('.card-slot')).toBeNull()
    expect(library.querySelector('.pile-card-count')?.textContent).toBe('40')
    expect(library.getAttribute('data-count')).toBe('40')

    const graveyard = container.querySelector('[data-testid="pile-card-graveyard"]')!
    expect(graveyard.classList.contains('pile-card--graveyard')).toBe(true)
    expect(graveyard.querySelector('.card-slot')?.getAttribute('data-card-name')).toBe('Snapcaster Mage')
    expect(graveyard.querySelector('.pile-card-count')?.textContent).toBe('2')
    expect(graveyard.getAttribute('data-count')).toBe('2')

    const exile = container.querySelector('[data-testid="pile-card-exile"]')!
    expect(exile.classList.contains('pile-card--exile')).toBe(true)
    expect(exile.querySelector('.card-slot')?.getAttribute('data-card-name')).toBe('Force of Will')
    expect(exile.querySelector('.card-slot')?.textContent).toContain('Force of Will')
    expect(exile.querySelector('.pile-card-count')?.textContent).toBe('1')
    expect(exile.getAttribute('data-count')).toBe('1')
  })

  it('BRD-12: an empty pile is an outlined slot that still opens its viewer', () => {
    const { container } = render(<ResourceBar player={pilePlayer()} side="my" pileCards />)

    const exile = container.querySelector('[data-testid="pile-card-exile"]')!
    expect(exile.tagName).toBe('BUTTON')
    expect(exile.classList.contains('is-empty')).toBe(true)
    expect(exile.querySelector('.pile-card-label')?.textContent).toBeTruthy()
    expect(exile.querySelector('.card-slot')).toBeNull()
    expect(exile.getAttribute('data-count')).toBe('0')

    fireEvent.click(exile)
    expect(document.body.querySelector('.pile-overlay')).toBeTruthy()
  })

  it('BRD-12: clicking a pile card opens the same viewer the chip opens', () => {
    const player = pilePlayer({
      graveyard: { 'c-1': { id: 'c-1', name: 'Lightning Bolt', manaValue: 1 } },
    })
    const chipView = render(<ResourceBar player={player} side="opp" micro={true} />)
    fireEvent.click(chipView.container.querySelector('.resource-chip.graveyard-chip')!)
    const chipTitle = document.body.querySelector('.pile-overlay-header h3')?.textContent
    const chipCardCount = document.body.querySelectorAll('.pile-overlay .pile-card').length
    cleanup()
    expect(document.body.querySelector('.pile-overlay')).toBeNull()

    const { container } = render(<ResourceBar player={player} side="opp" pileCards />)
    expect(document.body.querySelector('.pile-overlay')).toBeNull()
    fireEvent.click(container.querySelector('[data-testid="pile-card-graveyard"]')!)
    expect(document.body.querySelector('.pile-overlay')).toBeTruthy()
    expect(document.body.querySelector('.pile-overlay-header h3')?.textContent).toBe(chipTitle)
    expect(document.body.querySelectorAll('.pile-overlay .pile-card').length).toBe(chipCardCount)
  })

  it('BRD-12: a pile card glows when a card in it can be played', () => {
    const player = pilePlayer({
      graveyard: { 'g-1': { id: 'g-1', name: 'Faithless Looting', manaValue: 1 } },
    })
    const crossZonePlayables = [
      {
        id: 'g-1',
        card: { id: 'g-1', name: 'Faithless Looting', manaValue: 1 },
        value: 'Cast with Flashback',
        zone: 'graveyard',
      },
    ]
    const { container } = render(
      <ResourceBar player={player} side="my" pileCards crossZonePlayables={crossZonePlayables} />,
    )

    expect(container.querySelector('[data-testid="pile-card-graveyard"]')?.classList.contains('has-playable')).toBe(true)
    expect(container.querySelector('[data-testid="pile-card-exile"]')?.classList.contains('has-playable')).toBe(false)
  })

  it('BRD-12: a pile card rings when the prompt can target a card in it', () => {
    const player = pilePlayer({
      exile: { 'x-1': { id: 'x-1', name: 'Swords to Plowshares', manaValue: 1 } },
    })
    const { container } = render(
      <ResourceBar
        player={player}
        side="my"
        pileCards
        targetIds={new Set(['x-1'])}
        targetZone="exile"
        targetZones={new Set(['exile'])}
      />,
    )

    expect(container.querySelector('[data-testid="pile-card-exile"]')?.classList.contains('target-zone')).toBe(true)
    expect(container.querySelector('[data-testid="pile-card-graveyard"]')?.classList.contains('target-zone')).toBe(false)
  })

  it('BRD-12: pileCards leaves out the mana pool and the chips', () => {
    const { container } = render(<ResourceBar player={pilePlayer()} side="my" pileCards />)

    expect(container.querySelector('[data-testid="pile-cards"]')).not.toBeNull()
    expect(container.querySelector('[data-testid="mana-inline"]')).toBeNull()
    expect(container.querySelector('.resource-mana-wrap')).toBeNull()
    expect(container.querySelector('.resource-chip')).toBeNull()
    expect(container.querySelector('.resource-stack')).toBeNull()
    expect(container.querySelector('.stack-count')).toBeNull()
    expect(container.querySelectorAll('[data-testid^="pile-card-"]')).toHaveLength(3)
  })

  it('BRD-12: the library pile card shows the revealed top card face up', () => {
    const top = makeCard({ id: 'top-1', name: 'Ponder', manaValue: 1 } as Partial<CardView> & { name: string })
    const { container } = render(<ResourceBar player={pilePlayer({ topCard: top })} side="my" pileCards />)

    const library = container.querySelector('[data-testid="pile-card-library"]')!
    expect(library.querySelector('.card-slot')?.getAttribute('data-card-name')).toBe('Ponder')
    expect(library.querySelector('.stack-back-img')).toBeNull()
    expect(library.querySelector('.pile-card-count')?.textContent).toBe('40')
  })
})
