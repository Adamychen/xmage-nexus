// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import DeckTrackerPanel from './DeckTrackerPanel'
import { setState } from '../state/store'
import type { Deck } from '../lobby/decks'
import type { GameView, PlayerView, CardView } from '../net/types'

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

function makePlayer(overrides: Partial<PlayerView> = {}): PlayerView {
  return {
    playerId: 'p1',
    name: 'Alice',
    controlled: true,
    isHuman: true,
    life: 20,
    counters: [],
    wins: 0,
    winsNeeded: 2,
    libraryCount: 22,
    handCount: 2,
    isActive: true,
    hasPriority: true,
    timerActive: false,
    hasLeft: false,
    manaPool: {} as any,
    graveyard: {},
    exile: {},
    sideboard: {},
    helperCards: {},
    battlefield: {},
    topCard: null,
    commandList: [],
    attachments: [],
    statesSavedSize: 0,
    priorityTimeSavedTimeMs: 0,
    priorityTimeLeftSecs: 1200,
    bufferTimeLeft: 0,
    passedTurn: false,
    passedUntilEndOfTurn: false,
    passedUntilNextMain: false,
    passedUntilStackResolved: false,
    passedAllTurns: false,
    passedUntilEndStepBeforeMyTurn: false,
    monarch: false,
    initiative: false,
    designationNames: [],
    ...overrides,
  }
}

function makeGame(player: PlayerView, overrides: Partial<GameView> = {}): GameView {
  return {
    priorityTime: 1200,
    bufferTime: 0,
    players: [player],
    myPlayerId: player.playerId,
    myHand: {},
    myHelperEmblems: {},
    opponentHands: {},
    watchedHands: {},
    stack: {},
    exiles: [],
    revealed: [],
    lookedAt: [],
    companion: [],
    combat: [],
    phase: 'PRECOMBAT_MAIN',
    step: 'PRECOMBAT_MAIN',
    activePlayerId: player.playerId,
    activePlayerName: player.name,
    priorityPlayerName: player.name,
    turn: 1,
    special: false,
    rollbackTurnsAllowed: false,
    totalErrorsCount: 0,
    totalEffectsCount: 0,
    gameCycle: 1,
    ...overrides,
  }
}

describe('DeckTrackerPanel', () => {
  beforeEach(() => {
    setState({
      myDeck: null,
      game: null,
    })
  })

  afterEach(() => {
    cleanup()
  })

  it('renders empty message when no deck is present', () => {
    render(<DeckTrackerPanel />)
    expect(screen.getByText(/Sin baraja registrada/i)).toBeTruthy()
  })

  it('renders deck title, remaining counts, and odds bar when deck is loaded', () => {
    const player = makePlayer({ libraryCount: 24 })
    const game = makeGame(player)
    setState({
      myDeck: sampleDeck,
      game,
    })

    render(<DeckTrackerPanel />)
    expect(screen.getByText('Lightning Red')).toBeTruthy()
    expect(screen.getByText('24 / 24')).toBeTruthy()
    // Odds chips
    expect(screen.getByTitle('Tierras')).toBeTruthy()
    expect(screen.getByTitle('Hechizos')).toBeTruthy()
  })

  it('updates remaining count when cards are seen in hand', () => {
    const boltInHand: CardView = {
      id: 'b1',
      name: 'Lightning Bolt',
      manaValue: 1,
      cardTypes: ['Instant'],
    }
    const player = makePlayer({ libraryCount: 23 })
    const game = makeGame(player, {
      myHand: { b1: boltInHand },
    })
    setState({
      myDeck: sampleDeck,
      game,
    })

    render(<DeckTrackerPanel />)
    // Bolt: 3 / 4 remaining
    expect(screen.getByText('3 / 4')).toBeTruthy()
    // Mountain: 20 / 20 remaining
    expect(screen.getByText('20 / 20')).toBeTruthy()
  })

  it('filters cards by search input', () => {
    const player = makePlayer({ libraryCount: 24 })
    const game = makeGame(player)
    setState({
      myDeck: sampleDeck,
      game,
    })

    render(<DeckTrackerPanel />)
    expect(screen.getByText('Lightning Bolt')).toBeTruthy()
    expect(screen.getByText('Mountain')).toBeTruthy()

    const searchInput = screen.getByPlaceholderText(/Filtrar por nombre/i)
    fireEvent.change(searchInput, { target: { value: 'Bolt' } })

    expect(screen.getByText('Lightning Bolt')).toBeTruthy()
    expect(screen.queryByText('Mountain')).not.toBeTruthy()
  })

  it('toggles cards with zero remaining using hide empty', () => {
    // 4 bolts in hand, so 0 remaining
    const hand: Record<string, CardView> = {
      b1: { id: 'b1', name: 'Lightning Bolt', manaValue: 1, cardTypes: ['Instant'] },
      b2: { id: 'b2', name: 'Lightning Bolt', manaValue: 1, cardTypes: ['Instant'] },
      b3: { id: 'b3', name: 'Lightning Bolt', manaValue: 1, cardTypes: ['Instant'] },
      b4: { id: 'b4', name: 'Lightning Bolt', manaValue: 1, cardTypes: ['Instant'] },
    }
    const player = makePlayer({ libraryCount: 20 })
    const game = makeGame(player, { myHand: hand })
    setState({
      myDeck: sampleDeck,
      game,
    })

    render(<DeckTrackerPanel />)
    expect(screen.getByText('0 / 4')).toBeTruthy()

    // Click "Ocultar 0"
    const hideBtn = screen.getByText('Ocultar 0')
    fireEvent.click(hideBtn)

    expect(screen.queryByText('Lightning Bolt')).not.toBeTruthy()
    expect(screen.getByText('Mountain')).toBeTruthy()

    // Click again to show all
    const showBtn = screen.getByText('Mostrar todas')
    fireEvent.click(showBtn)
    expect(screen.getByText('Lightning Bolt')).toBeTruthy()
  })

  it('shows eye icon if card is revealed on top of library', () => {
    const topBolt: CardView = {
      id: 'top1',
      name: 'Lightning Bolt',
      manaValue: 1,
      cardTypes: ['Instant'],
    }
    const player = makePlayer({ libraryCount: 24, topCard: topBolt })
    const game = makeGame(player)
    setState({
      myDeck: sampleDeck,
      game,
    })

    render(<DeckTrackerPanel />)
    expect(screen.getByTitle(/En la parte superior de tu biblioteca/i)).toBeTruthy()
  })
})
