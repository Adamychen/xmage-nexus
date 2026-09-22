import { describe, it, expect } from 'vitest'
import {
  computeMulliganEvaluation,
  evaluateMulliganHand,
  hypergeometricAtLeast,
} from './mulliganEvaluator'
import type { GameView, PlayerView, CardView } from '../net/types'
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
    libraryCount: 33,
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

const burnDeck: Deck = {
  name: 'Burn Deck',
  cards: [
    { cardName: 'Lightning Bolt', amount: 4, setCode: 'M10', cardNumber: '146' },
    { cardName: 'Goblin Guide', amount: 4, setCode: 'ZEN', cardNumber: '126' },
    { cardName: 'Mountain', amount: 16, setCode: 'M10', cardNumber: '249' },
  ],
  sideboard: [],
}

describe('hypergeometricAtLeast', () => {
  it('returns 1 when no successes are needed', () => {
    expect(hypergeometricAtLeast(40, 17, 2, 0)).toBe(1)
  })

  it('returns 0 when there are no successes in the population', () => {
    expect(hypergeometricAtLeast(40, 0, 2, 1)).toBe(0)
  })

  it('matches the classic 40-card / 17-land probability of drawing >=1 land in 1 draw', () => {
    // 17/40 chance in a single draw is exactly 42.5%.
    expect(hypergeometricAtLeast(40, 17, 1, 1)).toBeCloseTo(0.425, 5)
  })

  it('increases with more draws', () => {
    const oneDraw = hypergeometricAtLeast(33, 13, 1, 1)
    const twoDraws = hypergeometricAtLeast(33, 13, 2, 1)
    expect(twoDraws).toBeGreaterThan(oneDraw)
  })
})

describe('evaluateMulliganHand', () => {
  function land(name: string, id: string): CardView {
    return { id, name, manaValue: 0, cardTypes: ['Land'], rules: [`{T}: Add {${name === 'Mountain' ? 'R' : 'G'}}.`] } as CardView
  }
  function spell(name: string, id: string, manaValue = 2): CardView {
    return { id, name, manaValue, cardTypes: ['Instant'] } as CardView
  }

  it('counts lands and spells and reports no probability without deck stats', () => {
    const hand = [land('Mountain', 'h1'), land('Mountain', 'h2'), spell('Lightning Bolt', 'h3')]
    const evaluation = evaluateMulliganHand(hand, null)
    expect(evaluation.cardCount).toBe(3)
    expect(evaluation.landCount).toBe(2)
    expect(evaluation.spellCount).toBe(1)
    expect(evaluation.colorCodes).toEqual(['R'])
    expect(evaluation.thirdLandMissing).toBe(1)
    expect(evaluation.thirdLandProbability).toBeNull()
  })

  it('reports null probability once the hand already has 3+ lands', () => {
    const hand = [land('Mountain', 'h1'), land('Mountain', 'h2'), land('Mountain', 'h3')]
    const evaluation = evaluateMulliganHand(hand, {
      initialTotal: 40,
      visibleTotal: 3,
      remainingTotal: 37,
      libraryCountServer: 37,
      faceDownExileCount: 0,
      oddsNextDraw: { land: 0, creature: 0, instantOrSorcery: 0, other: 0 },
      countsRemaining: { land: 14, creature: 0, instantOrSorcery: 0, other: 0 },
      cards: [],
    })
    expect(evaluation.thirdLandMissing).toBe(0)
    expect(evaluation.thirdLandProbability).toBeNull()
  })

  it('falls back to the basic-land color map when rules text is absent', () => {
    const hand = [{ id: 'h1', name: 'Forest', manaValue: 0, cardTypes: ['Land'] } as CardView]
    const evaluation = evaluateMulliganHand(hand, null)
    expect(evaluation.colorCodes).toEqual(['G'])
  })

  it('recognizes basic lands by name even without cardTypes (thin fixtures)', () => {
    const hand = [{ id: 'h1', name: 'Island' } as CardView]
    const evaluation = evaluateMulliganHand(hand, null)
    expect(evaluation.landCount).toBe(1)
    expect(evaluation.colorCodes).toEqual(['U'])
  })
})

describe('computeMulliganEvaluation', () => {
  it('derives land odds for a 2-land opening hand from the loaded deck', () => {
    const player = makePlayer({ libraryCount: 33 })
    const hand: Record<string, CardView> = {
      h1: { id: 'h1', name: 'Mountain', manaValue: 0, cardTypes: ['Land'], rules: ['{T}: Add {R}.'] } as CardView,
      h2: { id: 'h2', name: 'Mountain', manaValue: 0, cardTypes: ['Land'], rules: ['{T}: Add {R}.'] } as CardView,
      h3: { id: 'h3', name: 'Lightning Bolt', manaValue: 1, cardTypes: ['Instant'] } as CardView,
      h4: { id: 'h4', name: 'Goblin Guide', manaValue: 1, cardTypes: ['Creature'] } as CardView,
      h5: { id: 'h5', name: 'Goblin Guide', manaValue: 1, cardTypes: ['Creature'] } as CardView,
      h6: { id: 'h6', name: 'Goblin Guide', manaValue: 1, cardTypes: ['Creature'] } as CardView,
      h7: { id: 'h7', name: 'Lightning Bolt', manaValue: 1, cardTypes: ['Instant'] } as CardView,
    }
    const game = makeGame(player, { myHand: hand })

    const evaluation = computeMulliganEvaluation(Object.values(hand), burnDeck, game, 'p1')

    expect(evaluation.landCount).toBe(2)
    expect(evaluation.thirdLandMissing).toBe(1)
    expect(evaluation.thirdLandProbability).not.toBeNull()
    expect(evaluation.thirdLandProbability!).toBeGreaterThan(0)
    expect(evaluation.thirdLandProbability!).toBeLessThanOrEqual(100)
  })

  it('returns null probability when no deck is loaded (e.g. spectator)', () => {
    const player = makePlayer()
    const hand: Record<string, CardView> = {
      h1: { id: 'h1', name: 'Mountain', manaValue: 0, cardTypes: ['Land'] } as CardView,
    }
    const game = makeGame(player, { myHand: hand })
    const evaluation = computeMulliganEvaluation(Object.values(hand), null, game, 'p1')
    expect(evaluation.thirdLandProbability).toBeNull()
  })
})
