import { describe, it, expect } from 'vitest'
import {
  computeDeckTracker,
  matchCardName,
  normalizeCardName,
  getVisibleCards,
} from './deckTracker'
import type { GameView, PlayerView, CardView, PermanentView } from '../net/types'
import type { Deck } from '../lobby/decks'
import type { DeckCardMetaMap } from './deckTracker'
import { makeGameView, makePlayer as basePlayer } from '../__fixtures__/gameViews'

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

describe('deckTracker card metadata', () => {
  const bearsDeck: Deck = {
    name: 'Bears',
    cards: [
      { cardName: 'Grizzly Bears', amount: 4, setCode: 'M10', cardNumber: '200' },
      { cardName: 'Lightning Bolt', amount: 4, setCode: 'M10', cardNumber: '146' },
      { cardName: 'Mystery Card', amount: 3, setCode: 'XXX', cardNumber: '1' },
      { cardName: 'Mountain', amount: 20, setCode: 'LEA', cardNumber: '292' },
    ],
    sideboard: [],
  }
  const meta: DeckCardMetaMap = new Map([
    ['grizzly bears', { manaCost: '{1}{G}', manaValue: 2, cardTypes: ['CREATURE'], colors: ['G'] }],
    ['lightning bolt', { manaCost: '{R}', manaValue: 1, cardTypes: ['INSTANT'], colors: ['R'] }],
  ])

  it('PNL-5: an unseen creature with meta counts as a creature and keeps its cost', () => {
    const game = makeGame(makePlayer({ libraryCount: 27 }))
    const stats = computeDeckTracker(bearsDeck, game, null, meta)
    const bears = stats.cards.find((c) => c.name === 'Grizzly Bears')
    expect(bears?.hasData).toBe(true)
    expect(bears?.isCreature).toBe(true)
    expect(bears?.manaCost).toBe('{1}{G}')
    expect(bears?.manaValue).toBe(2)
    expect(bears?.colors).toEqual(['G'])
    expect(stats.countsRemaining.creature).toBe(4)
    expect(stats.oddsNextDraw.creature).toBe(Number(((4 / 27) * 100).toFixed(1)))
    expect(stats.countsRemaining.other).toBe(0)
  })

  it('PNL-5: an unseen card with neither sample nor meta is in no type and counted as unknown', () => {
    const game = makeGame(makePlayer({ libraryCount: 27 }))
    const stats = computeDeckTracker(bearsDeck, game, null, meta)
    const mystery = stats.cards.find((c) => c.name === 'Mystery Card')
    expect(mystery?.hasData).toBe(false)
    expect(mystery?.isLand).toBe(false)
    expect(mystery?.isCreature).toBe(false)
    expect(mystery?.isInstantOrSorcery).toBe(false)
    expect(stats.unknownRemaining).toBe(3)
    expect(stats.countsRemaining.other).toBe(0)
    expect(stats.oddsNextDraw.other).toBe(0)
  })

  it('PNL-5: the type odds stay over the whole library, so the unknown share is in no type', () => {
    const game = makeGame(makePlayer({ libraryCount: 23 }))
    const stats = computeDeckTracker(
      { ...bearsDeck, cards: [{ cardName: 'Mystery Card', amount: 3, setCode: '', cardNumber: '0' }, { cardName: 'Mountain', amount: 20, setCode: '', cardNumber: '0' }] },
      game,
      null,
      meta,
    )
    expect(stats.unknownRemaining).toBe(3)
    expect(stats.countsRemaining.land).toBe(20)
    expect(stats.oddsNextDraw.land).toBe(87)
    expect(stats.remainingTotal).toBe(23)
  })

  it('PNL-5: a seen card keeps its own cost and types over the meta', () => {
    const goblin: PermanentView = {
      id: 'g1',
      name: 'Grizzly Bears',
      manaValue: 2,
      manaCostLeftStr: ['{1}{G}'],
      cardTypes: ['Creature'],
      controllerId: 'p1',
    }
    const conflicting: DeckCardMetaMap = new Map([
      ['grizzly bears', { manaCost: '{2}{R}', manaValue: 3, cardTypes: ['INSTANT'], colors: ['R'] }],
    ])
    const game = makeGame(makePlayer({ libraryCount: 27, battlefield: { g1: goblin } }))
    const stats = computeDeckTracker(bearsDeck, game, null, conflicting)
    const bears = stats.cards.find((c) => c.name === 'Grizzly Bears')
    expect(bears?.seenCount).toBe(1)
    expect(bears?.manaCost).toBe('{1}{G}')
    expect(bears?.manaValue).toBe(2)
    expect(bears?.isCreature).toBe(true)
    expect(bears?.isInstantOrSorcery).toBe(false)
  })

  it('PNL-5: a basic land with no sample and no meta is a land with data', () => {
    const game = makeGame(makePlayer({ libraryCount: 27 }))
    const stats = computeDeckTracker(bearsDeck, game, null)
    const mountain = stats.cards.find((c) => c.name === 'Mountain')
    expect(mountain?.hasData).toBe(true)
    expect(mountain?.isLand).toBe(true)
    expect(mountain?.manaCost).toBeUndefined()
    expect(stats.unknownRemaining).toBe(3 + 4 + 4)
  })

  it('PNL-5: without meta a seen card is still counted by its sample, unseen non-basics are unknown', () => {
    const bolt: CardView = { id: 'b1', name: 'Lightning Bolt', manaValue: 1, manaCostLeftStr: ['{R}'], cardTypes: ['Instant'] }
    const game = makeGame(makePlayer({ libraryCount: 26 }), { myHand: { b1: bolt } })
    const stats = computeDeckTracker(bearsDeck, game, null)
    const boltRow = stats.cards.find((c) => c.name === 'Lightning Bolt')
    expect(boltRow?.hasData).toBe(true)
    expect(boltRow?.isInstantOrSorcery).toBe(true)
    expect(boltRow?.remainingCount).toBe(3)
    expect(stats.unknownRemaining).toBe(3 + 4)
  })
})
