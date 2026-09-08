import { describe, it, expect } from 'vitest'
import {
  computeDeckTracker,
  matchCardName,
  normalizeCardName,
  getVisibleCards,
} from './deckTracker'
import type { GameView, PlayerView, CardView, PermanentView } from '../net/types'
import type { Deck } from '../lobby/decks'

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
    libraryCount: 40,
    handCount: 7,
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

describe('deckTracker', () => {
  describe('name matching and normalization', () => {
    it('normalizes names and matches case-insensitively', () => {
      expect(matchCardName('Lightning Bolt', 'lightning bolt')).toBe(true)
      expect(matchCardName('  Mountain  ', 'mountain')).toBe(true)
      expect(matchCardName('Counterspell', 'Lightning Bolt')).toBe(false)
    })

    it('matches MDFCs and split cards by front face', () => {
      expect(matchCardName('Delver of Secrets // Insectile Aberration', 'Delver of Secrets')).toBe(true)
      expect(matchCardName('Fire // Ice', 'Fire')).toBe(true)
    })

    it('matches translated basic lands to canonical English names', () => {
      expect(matchCardName('Montaña', 'Mountain')).toBe(true)
      expect(matchCardName('Isla', 'Island')).toBe(true)
      expect(matchCardName('Bosque', 'Forest')).toBe(true)
    })

    it('normalizes card names', () => {
      expect(normalizeCardName('  Lightning Bolt  ')).toBe('lightning bolt')
      expect(normalizeCardName('')).toBe('')
    })

    it('extracts visible cards from hand and battlefield', () => {
      const p = makePlayer({
        battlefield: {
          b1: { id: 'b1', name: 'Goblin Guide', manaValue: 1, cardTypes: ['Creature'] } as PermanentView,
        },
      })
      const g = makeGame(p, {
        myHand: {
          h1: { id: 'h1', name: 'Mountain', manaValue: 0, cardTypes: ['Land'] } as CardView,
        },
      })
      const visible = getVisibleCards(g)
      expect(visible.map((c) => c.name)).toEqual(['Mountain', 'Goblin Guide'])
    })
  })

  describe('computeDeckTracker', () => {
    const testDeck: Deck = {
      name: 'Burn Deck',
      cards: [
        { cardName: 'Lightning Bolt', amount: 4, setCode: 'M10', cardNumber: '146' },
        { cardName: 'Goblin Guide', amount: 4, setCode: 'ZEN', cardNumber: '126' },
        { cardName: 'Mountain', amount: 10, setCode: 'LEA', cardNumber: '292' },
        { cardName: 'Mountain', amount: 10, setCode: 'M10', cardNumber: '249' }, // 2nd printing
      ],
      sideboard: [],
    }

    it('returns empty stats when deck is null or empty', () => {
      const stats = computeDeckTracker(null, null)
      expect(stats.initialTotal).toBe(0)
      expect(stats.cards).toEqual([])
    })

    it('aggregates identical card names across different printings', () => {
      const player = makePlayer({ libraryCount: 28 })
      const game = makeGame(player)
      const stats = computeDeckTracker(testDeck, game)

      // Mountain has 10 + 10 = 20 total
      const mountain = stats.cards.find((c) => c.name === 'Mountain')
      expect(mountain).toBeDefined()
      expect(mountain?.initialAmount).toBe(20)
      expect(mountain?.remainingCount).toBe(20)
      expect(stats.initialTotal).toBe(28)
    })

    it('deducts cards in hand, battlefield, graveyard, exile, and stack', () => {
      const boltInHand: CardView = {
        id: 'c1',
        name: 'Lightning Bolt',
        manaValue: 1,
        manaCostLeftStr: ['{R}'],
        cardTypes: ['Instant'],
      }
      const goblinOnField: PermanentView = {
        id: 'c2',
        name: 'Goblin Guide',
        manaValue: 1,
        manaCostLeftStr: ['{R}'],
        cardTypes: ['Creature'],
        controllerId: 'p1',
      }
      const boltInGrave: CardView = {
        id: 'c3',
        name: 'Lightning Bolt',
        manaValue: 1,
        cardTypes: ['Instant'],
      }
      const mountainInPlay: PermanentView = {
        id: 'c4',
        name: 'Mountain',
        manaValue: 0,
        cardTypes: ['Land', 'Basic'],
        controllerId: 'p1',
      }
      const goblinOnStack: CardView = {
        id: 'c5',
        name: 'Goblin Guide',
        manaValue: 1,
        cardTypes: ['Creature'],
        controllerId: 'p1',
      }

      const player = makePlayer({
        libraryCount: 23,
        battlefield: { c2: goblinOnField, c4: mountainInPlay },
        graveyard: { c3: boltInGrave },
      })
      const game = makeGame(player, {
        myHand: { c1: boltInHand },
        stack: { c5: goblinOnStack },
      })

      const stats = computeDeckTracker(testDeck, game)

      // Lightning Bolt: 4 initial - 1 (hand) - 1 (grave) = 2 remaining
      const bolt = stats.cards.find((c) => c.name === 'Lightning Bolt')
      expect(bolt?.seenCount).toBe(2)
      expect(bolt?.remainingCount).toBe(2)

      // Goblin Guide: 4 initial - 1 (field) - 1 (stack) = 2 remaining
      const goblin = stats.cards.find((c) => c.name === 'Goblin Guide')
      expect(goblin?.seenCount).toBe(2)
      expect(goblin?.remainingCount).toBe(2)

      // Mountain: 20 initial - 1 (field) = 19 remaining
      const mountain = stats.cards.find((c) => c.name === 'Mountain')
      expect(mountain?.seenCount).toBe(1)
      expect(mountain?.remainingCount).toBe(19)

      // Total remaining = 2 + 2 + 19 = 23 (matches library count!)
      expect(stats.remainingTotal).toBe(23)
      expect(stats.visibleTotal).toBe(5)
    })

    it('ignores tokens on battlefield and graveyard', () => {
      const tokenOnField: PermanentView = {
        id: 'tok1',
        name: 'Goblin',
        isToken: true,
        manaValue: 0,
        cardTypes: ['Creature'],
        controllerId: 'p1',
      }
      const boltCopyToken: PermanentView = {
        id: 'tok2',
        name: 'Lightning Bolt',
        isToken: true,
        manaValue: 1,
        cardTypes: ['Instant'],
        controllerId: 'p1',
      }
      const player = makePlayer({
        libraryCount: 28,
        battlefield: { tok1: tokenOnField, tok2: boltCopyToken },
      })
      const game = makeGame(player)

      const stats = computeDeckTracker(testDeck, game)
      const bolt = stats.cards.find((c) => c.name === 'Lightning Bolt')
      // Bolt token copy is NOT counted as a real deck card
      expect(bolt?.seenCount).toBe(0)
      expect(bolt?.remainingCount).toBe(4)
    })

    it('calculates correct next-draw odds by category', () => {
      const player = makePlayer({ libraryCount: 20 })
      const game = makeGame(player)
      const stats = computeDeckTracker(testDeck, game)

      // Mountain: 20 lands / 20 in lib = 100%
      expect(stats.oddsNextDraw.land).toBe(100)
      // Individual card odds
      const bolt = stats.cards.find((c) => c.name === 'Lightning Bolt')
      // 4 bolts / 20 lib = 20%
      expect(bolt?.drawProbability).toBe(20)
    })

    it('detects when topCard of library matches a tracked card', () => {
      const topBolt: CardView = {
        id: 'top1',
        name: 'Lightning Bolt',
        manaValue: 1,
        cardTypes: ['Instant'],
      }
      const player = makePlayer({
        libraryCount: 28,
        topCard: topBolt,
      })
      const game = makeGame(player)
      const stats = computeDeckTracker(testDeck, game)

      const bolt = stats.cards.find((c) => c.name === 'Lightning Bolt')
      expect(bolt?.isTopCard).toBe(true)

      // Top card is still in library, so remainingCount is NOT decremented!
      expect(bolt?.remainingCount).toBe(4)
    })

    it('counts face-down exile cards', () => {
      const faceDownExile: CardView = {
        id: 'fd1',
        name: 'Face Down Card',
        faceDown: true,
        manaValue: 0,
      }
      const player = makePlayer({
        libraryCount: 27,
        exile: { fd1: faceDownExile },
      })
      const game = makeGame(player)
      const stats = computeDeckTracker(testDeck, game)

      expect(stats.faceDownExileCount).toBe(1)
    })
  })
})
