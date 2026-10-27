// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup, within } from '@testing-library/react'
import DeckTrackerPanel from './DeckTrackerPanel'
import { DrawerHeadSlotContext } from './drawerHeadSlot'
import { setState } from '../state/store'
import type { Deck } from '../lobby/decks'
import type { GameView, PlayerView, CardView } from '../net/types'
import type { DeckCardMeta } from './deckTracker'
import { makeGameView, makePlayer as basePlayer } from '../__fixtures__/gameViews'

const metaState = vi.hoisted(() => ({
  current: { meta: new Map<string, unknown>(), loading: false, missing: 0 },
}))

vi.mock('./useDeckCardMeta', () => ({
  useDeckCardMeta: () => metaState.current,
}))

vi.mock('../board/FloatingCardPreview', () => ({
  default: ({ card }: { card: any }) => (card ? <div data-testid="floating-preview">{card.name}</div> : null),
}))

const sampleDeck: Deck = {
  name: 'Lightning Red',
  cards: [
    { cardName: 'Lightning Bolt', amount: 4, setCode: 'M10', cardNumber: '146' },
    { cardName: 'Mountain', amount: 20, setCode: 'LEA', cardNumber: '292' },
  ],
  sideboard: [],
}

const BEARS: DeckCardMeta = { manaCost: '{1}{G}', manaValue: 2, cardTypes: ['CREATURE'], colors: ['G'] }
const BOLT: DeckCardMeta = { manaCost: '{R}', manaValue: 1, cardTypes: ['INSTANT'], colors: ['R'] }
const SOL_RING: DeckCardMeta = { manaCost: '{1}', manaValue: 1, cardTypes: ['ARTIFACT'], colors: [] }
const ZOMBIE: DeckCardMeta = { manaCost: '{B}', manaValue: 1, cardTypes: ['CREATURE'], colors: ['B'] }
const ALPHA: DeckCardMeta = { manaCost: '{2}{B}', manaValue: 3, cardTypes: ['CREATURE'], colors: ['B'] }

function setMeta(entries: Record<string, DeckCardMeta>, loading = false) {
  metaState.current = { meta: new Map(Object.entries(entries)), loading, missing: 0 }
}

function makePlayer(overrides: Partial<PlayerView> = {}): PlayerView {
  return basePlayer({ playerId: 'p1', name: 'Alice', controlled: true, ...overrides })
}

function makeGame(player: PlayerView, overrides: Partial<GameView> = {}): GameView {
  return makeGameView({
    players: [player],
    myPlayerId: player.playerId,
    activePlayerId: player.playerId,
    activePlayerName: player.name,
    priorityPlayerName: player.name,
    ...overrides,
  })
}

function bolts(count: number): Record<string, CardView> {
  const hand: Record<string, CardView> = {}
  for (let i = 0; i < count; i++) {
    hand[`b${i}`] = { id: `b${i}`, name: 'Lightning Bolt', manaValue: 1, cardTypes: ['Instant'] }
  }
  return hand
}

function rowNames(container: HTMLElement, selector: string): string[] {
  return Array.from(container.querySelectorAll(`${selector} .tracker-card-row`)).map(
    (row) => row.getAttribute('data-card-name') ?? '',
  )
}

describe('DeckTrackerPanel', () => {
  beforeEach(() => {
    setState({ myDeck: null, game: null })
    setMeta({})
  })

  afterEach(() => {
    cleanup()
  })

  it('renders empty message when no deck is present', () => {
    render(<DeckTrackerPanel />)
    expect(screen.getByText(/Sin baraja registrada/i)).toBeTruthy()
  })

  it('renders the deck name and the cards left to draw when a deck is loaded', () => {
    const game = makeGame(makePlayer({ libraryCount: 24 }))
    setState({ myDeck: sampleDeck, game })

    render(<DeckTrackerPanel />)
    expect(screen.getByText('Lightning Red')).toBeTruthy()
    expect(screen.getByTestId('tracker-left-number').textContent).toBe('24')
  })

  it('updates the remaining copies when cards are seen in hand', () => {
    const game = makeGame(makePlayer({ libraryCount: 23 }), { myHand: bolts(1) })
    setState({ myDeck: sampleDeck, game })

    render(<DeckTrackerPanel />)
    expect(screen.getByTitle('3 / 4')).toBeTruthy()
    expect(screen.getByTitle('20 / 20')).toBeTruthy()
  })

  it('filters cards by search input', () => {
    setMeta({ 'lightning bolt': BOLT })
    const game = makeGame(makePlayer({ libraryCount: 24 }))
    setState({ myDeck: sampleDeck, game })

    const { container } = render(<DeckTrackerPanel />)
    expect(rowNames(container, '[data-group]')).toEqual(['Lightning Bolt', 'Mountain'])

    const searchInput = screen.getByPlaceholderText(/Filtrar por nombre/i)
    fireEvent.change(searchInput, { target: { value: 'Bolt' } })

    expect(rowNames(container, '[data-group]')).toEqual(['Lightning Bolt'])
    expect(screen.queryByText('Mountain')).toBeNull()
  })

  it('shows the revealed top card with its badge', () => {
    const topBolt: CardView = { id: 'top1', name: 'Lightning Bolt', manaValue: 1, cardTypes: ['Instant'] }
    const game = makeGame(makePlayer({ libraryCount: 24, topCard: topBolt }))
    setState({ myDeck: sampleDeck, game })

    render(<DeckTrackerPanel />)
    expect(screen.getByTitle(/En la parte superior de tu biblioteca/i)).toBeTruthy()
  })

  it('PNL-5: while the card data loads the odds and the legend say so instead of showing numbers', () => {
    setMeta({}, true)
    const deck: Deck = {
      name: 'Mix',
      cards: [
        { cardName: 'Grizzly Bears', amount: 4, setCode: 'M10', cardNumber: '200' },
        { cardName: 'Mountain', amount: 10, setCode: 'LEA', cardNumber: '292' },
      ],
      sideboard: [],
    }
    setState({ myDeck: deck, game: makeGame(makePlayer({ libraryCount: 14 })) })

    const { container } = render(<DeckTrackerPanel />)
    expect(screen.getByText('Cargando datos de las cartas…')).toBeTruthy()
    expect(container.querySelector('.tracker-legend')).toBeNull()
    expect(container.querySelector('.tracker-dist-bar')).toBeNull()
    expect(screen.getByTestId('tracker-left-number').textContent).toBe('14')
    expect(screen.getByText('Grizzly Bears')).toBeTruthy()
  })

  it('PNL-5: a card without data is named in the summary and counted in no type', () => {
    setMeta({ 'grizzly bears': BEARS, 'lightning bolt': BOLT })
    const deck: Deck = {
      name: 'Mix',
      cards: [
        { cardName: 'Grizzly Bears', amount: 4, setCode: 'M10', cardNumber: '200' },
        { cardName: 'Lightning Bolt', amount: 4, setCode: 'M10', cardNumber: '146' },
        { cardName: 'Mystery Card', amount: 2, setCode: 'XXX', cardNumber: '1' },
        { cardName: 'Mountain', amount: 10, setCode: 'LEA', cardNumber: '292' },
      ],
      sideboard: [],
    }
    setState({ myDeck: deck, game: makeGame(makePlayer({ libraryCount: 20 })) })

    const { container } = render(<DeckTrackerPanel />)
    expect(screen.getByText('2 sin datos')).toBeTruthy()
    const percentages = Array.from(container.querySelectorAll('.tracker-legend-pct')).map((el) => el.textContent)
    const counts = Array.from(container.querySelectorAll('.tracker-legend-count')).map((el) => el.textContent)
    expect(percentages).toEqual(['50%', '20%', '20%', '0%'])
    expect(counts).toEqual(['(10)', '(4)', '(4)', '(0)'])
    expect(screen.getByRole('img', { name: /Tierras 50%.*2 sin datos/ })).toBeTruthy()
    const noData = container.querySelector('[data-group="unknown"]')
    expect(within(noData as HTMLElement).getByText('Mystery Card')).toBeTruthy()
  })

  it('PNL-6: the summary labels the cards left, the list and the library count', () => {
    const deck: Deck = {
      name: 'Mix',
      cards: [
        { cardName: 'Grizzly Bears', amount: 10, setCode: 'M10', cardNumber: '200' },
        { cardName: 'Mountain', amount: 10, setCode: 'LEA', cardNumber: '292' },
      ],
      sideboard: [],
    }
    const hand: Record<string, CardView> = {
      g1: { id: 'g1', name: 'Grizzly Bears', manaValue: 2, cardTypes: ['Creature'] },
      g2: { id: 'g2', name: 'Grizzly Bears', manaValue: 2, cardTypes: ['Creature'] },
    }
    setState({ myDeck: deck, game: makeGame(makePlayer({ libraryCount: 18 }), { myHand: hand }) })

    render(<DeckTrackerPanel />)
    expect(screen.getByTestId('tracker-left-number').textContent).toBe('18')
    expect(screen.getByText('por robar')).toBeTruthy()
    expect(screen.getByText('de 20 en tu lista · biblioteca 18')).toBeTruthy()
    expect(screen.getByText('Próxima robada')).toBeTruthy()
  })

  it('PNL-6: the groups are creatures, spells, others and lands, in that order, with their counts', () => {
    setMeta({ 'grizzly bears': BEARS, 'lightning bolt': BOLT, 'sol ring': SOL_RING })
    const deck: Deck = {
      name: 'Mix',
      cards: [
        { cardName: 'Mountain', amount: 10, setCode: 'LEA', cardNumber: '292' },
        { cardName: 'Sol Ring', amount: 2, setCode: 'C21', cardNumber: '263' },
        { cardName: 'Lightning Bolt', amount: 4, setCode: 'M10', cardNumber: '146' },
        { cardName: 'Grizzly Bears', amount: 4, setCode: 'M10', cardNumber: '200' },
      ],
      sideboard: [],
    }
    setState({ myDeck: deck, game: makeGame(makePlayer({ libraryCount: 20 })) })

    const { container } = render(<DeckTrackerPanel />)
    const groups = Array.from(container.querySelectorAll('.tracker-group'))
    expect(groups.map((g) => g.getAttribute('data-group'))).toEqual(['creature', 'spell', 'other', 'land'])
    expect(groups.map((g) => g.querySelector('.tracker-group-label')?.textContent)).toEqual([
      'Criaturas',
      'Hechizos',
      'Otros',
      'Tierras',
    ])
    expect(groups.map((g) => g.querySelector('.tracker-group-count')?.textContent)).toEqual(['4', '4', '2', '10'])
  })

  it('PNL-6: the copies column shows x N only where more than one copy is left, with the counts in its tooltip', () => {
    setMeta({ 'grizzly bears': BEARS, 'lightning bolt': BOLT, 'sol ring': SOL_RING })
    const deck: Deck = {
      name: 'Mix',
      cards: [
        { cardName: 'Grizzly Bears', amount: 4, setCode: 'M10', cardNumber: '200' },
        { cardName: 'Lightning Bolt', amount: 4, setCode: 'M10', cardNumber: '146' },
        { cardName: 'Sol Ring', amount: 1, setCode: 'C21', cardNumber: '263' },
      ],
      sideboard: [],
    }
    setState({ myDeck: deck, game: makeGame(makePlayer({ libraryCount: 9 }), { myHand: bolts(1) }) })

    const { container } = render(<DeckTrackerPanel />)
    expect(screen.getByTitle('4 / 4').textContent).toBe('×4')
    expect(screen.getByTitle('3 / 4').textContent).toBe('×3')
    expect(container.querySelector('[data-card-name="Sol Ring"] .tracker-row-copies')).toBeNull()
    expect(screen.queryByText('×1')).toBeNull()
  })

  it('PNL-6: the order is a segmented control that changes the order inside each group', () => {
    setMeta({ 'zombie lord': ZOMBIE, 'alpha bear': ALPHA })
    const deck: Deck = {
      name: 'Mix',
      cards: [
        { cardName: 'Zombie Lord', amount: 1, setCode: 'M10', cardNumber: '1' },
        { cardName: 'Alpha Bear', amount: 4, setCode: 'M10', cardNumber: '2' },
      ],
      sideboard: [],
    }
    setState({ myDeck: deck, game: makeGame(makePlayer({ libraryCount: 5 })) })

    const { container } = render(<DeckTrackerPanel />)
    const pressed = () => screen.getAllByRole('button').filter((b) => b.getAttribute('aria-pressed') === 'true').map((b) => b.textContent)
    expect(pressed()).toEqual(['Coste (CMC)'])
    expect(rowNames(container, '[data-group="creature"]')).toEqual(['Zombie Lord', 'Alpha Bear'])

    fireEvent.click(screen.getByRole('button', { name: 'Nombre' }))
    expect(pressed()).toEqual(['Nombre'])
    expect(rowNames(container, '[data-group="creature"]')).toEqual(['Alpha Bear', 'Zombie Lord'])

    fireEvent.click(screen.getByRole('button', { name: '% Robo' }))
    expect(pressed()).toEqual(['% Robo'])
    expect(rowNames(container, '[data-group="creature"]')).toEqual(['Alpha Bear', 'Zombie Lord'])
  })

  it('PNL-6: the drawn cards are folded into a section that starts closed, with their count', () => {
    setMeta({ 'grizzly bears': BEARS, 'lightning bolt': BOLT })
    const deck: Deck = {
      name: 'Mix',
      cards: [
        { cardName: 'Lightning Bolt', amount: 4, setCode: 'M10', cardNumber: '146' },
        { cardName: 'Grizzly Bears', amount: 4, setCode: 'M10', cardNumber: '200' },
        { cardName: 'Mountain', amount: 10, setCode: 'LEA', cardNumber: '292' },
      ],
      sideboard: [],
    }
    setState({ myDeck: deck, game: makeGame(makePlayer({ libraryCount: 14 }), { myHand: bolts(4) }) })

    const { container } = render(<DeckTrackerPanel />)
    const section = screen.getByTestId('tracker-drawn')
    const toggle = within(section).getByRole('button')
    expect(toggle.getAttribute('aria-expanded')).toBe('false')
    expect(toggle.textContent).toContain('Ya robadas · 1')
    expect(within(toggle).getByText('Lightning Bolt')).toBeTruthy()
    expect(container.querySelector('[data-card-name="Lightning Bolt"]')).toBeNull()

    fireEvent.click(toggle)
    expect(toggle.getAttribute('aria-expanded')).toBe('true')
    const drawnRow = container.querySelector('[data-card-name="Lightning Bolt"]')
    expect(drawnRow?.classList.contains('is-drawn')).toBe(true)
    expect(drawnRow?.textContent).not.toContain('×')
  })

  it('PNL-6: there is no hide-empty toggle any more', () => {
    setState({ myDeck: sampleDeck, game: makeGame(makePlayer({ libraryCount: 24 }), { myHand: bolts(4) }) })

    render(<DeckTrackerPanel />)
    expect(screen.queryByText(/Ocultar/)).toBeNull()
    expect(screen.queryByText(/Mostrar todas/)).toBeNull()
  })

  it('PNL-6: the deck name moves into the panel head slot when there is one', () => {
    setState({ myDeck: sampleDeck, game: makeGame(makePlayer({ libraryCount: 24 })) })
    const slot = document.createElement('div')
    document.body.appendChild(slot)

    const { container } = render(
      <DrawerHeadSlotContext.Provider value={slot}>
        <DeckTrackerPanel />
      </DrawerHeadSlotContext.Provider>,
    )
    expect(slot.textContent).toContain('Lightning Red')
    expect(container.querySelector('.tracker-title-row')).toBeNull()
    slot.remove()
  })
})
