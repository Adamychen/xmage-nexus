import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { detectAndAnimateTransitions } from './gameTransitionEngine'
import { clearCardPositionRegistry, recordCardPosition } from './cardPositionRegistry'
import { clearFlights, getActiveFlights, hasFlightFor } from './flightManager'
import { clearFeedbackFx, getFeedbackFxState } from './feedbackFx'
import { clearStackHold } from './stackHold'
import { damageNumbersFor } from './DamageNumber'
import type { CardView, GameView, PlayerView } from '../net/types'

function domRect(left = 100, top = 200): DOMRect {
  return {
    left,
    top,
    right: left + 100,
    bottom: top + 140,
    width: 100,
    height: 140,
    x: left,
    y: top,
    toJSON: () => {},
  } as DOMRect
}

function player(overrides: Partial<PlayerView>): PlayerView {
  return {
    playerId: 'p1',
    name: 'Alice',
    controlled: false,
    isHuman: true,
    life: 20,
    counters: [],
    wins: 0,
    winsNeeded: 1,
    libraryCount: 40,
    handCount: 5,
    isActive: true,
    hasPriority: false,
    timerActive: false,
    hasLeft: false,
    manaPool: {},
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
    priorityTimeLeftSecs: 0,
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
  } as PlayerView
}

function baseGame(overrides: Partial<GameView>): GameView {
  return {
    priorityTime: 0,
    bufferTime: 0,
    players: [player({})],
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
    phase: 'MAIN',
    step: 'PRECOMBAT_MAIN',
    activePlayerId: 'p1',
    activePlayerName: 'Alice',
    priorityPlayerName: 'Alice',
    turn: 1,
    special: false,
    rollbackTurnsAllowed: false,
    totalErrorsCount: 0,
    totalEffectsCount: 0,
    gameCycle: 1,
    ...overrides,
  } as GameView
}

const bolt: CardView = {
  id: 'bolt-1',
  name: 'Lightning Bolt',
  manaValue: 1,
  expansionSetCode: 'LEA',
  cardNumber: '161',
}

function afterLayout(): Promise<void> {
  return new Promise((resolve) => {
    if (typeof requestAnimationFrame === 'function') {
      requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
    } else {
      setTimeout(resolve, 60)
    }
  })
}

describe('gameTransitionEngine — stack resolution and feedback', () => {
  let rectCounter = 0

  beforeEach(() => {
    rectCounter = 0
    clearFlights()
    clearCardPositionRegistry()
    clearFeedbackFx()
    clearStackHold()
    document.body.innerHTML = ''
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(() => {
      const rect = domRect(200 * (rectCounter++ % 20), 300)
      rectCounter = rectCounter % 20
      return rect
    })
  })

  afterEach(() => {
    vi.restoreAllMocks()
    document.body.innerHTML = ''
  })

  it('flies a resolved spell to the graveyard pile', async () => {
    document.body.innerHTML = '<div data-player-id="p1" data-player-name="Alice"><div class="graveyard-stack"></div></div>'
    const prev = baseGame({ stack: { 'bolt-1': bolt } })
    const next = baseGame({ stack: {}, players: [player({ graveyard: { 'bolt-1': bolt } })] })
    recordCardPosition('bolt-1', domRect(1000, 500), 'stack-zone')

    detectAndAnimateTransitions(prev, next)
    await afterLayout()

    expect(hasFlightFor('bolt-1')).toBe(true)
    expect(getActiveFlights()[0]?.toSelector).toContain('.graveyard-stack')
  })

  it('flies a resolved spell to the exile pile', async () => {
    document.body.innerHTML = '<div data-player-id="p1" data-player-name="Alice"><div class="exile-stack"></div></div>'
    const prev = baseGame({ stack: { 'bolt-1': bolt } })
    const next = baseGame({ stack: {}, players: [player({ exile: { 'bolt-1': bolt } })] })
    recordCardPosition('bolt-1', domRect(1000, 500), 'stack-zone')

    detectAndAnimateTransitions(prev, next)
    await afterLayout()

    expect(hasFlightFor('bolt-1')).toBe(true)
    expect(getActiveFlights()[0]?.toSelector).toContain('.exile-stack')
  })

  it('plays a static resolve flash when the spell has no visible destination', () => {
    const prev = baseGame({ stack: { 'bolt-1': bolt } })
    const next = baseGame({ stack: {} })
    recordCardPosition('bolt-1', domRect(1000, 500), 'stack-zone')

    detectAndAnimateTransitions(prev, next)

    expect(hasFlightFor('bolt-1')).toBe(true)
    const flight = getActiveFlights()[0]
    expect(flight?.fromRect.left).toBe(flight?.toRect.left)
    expect(flight?.fromRect.top).toBe(flight?.toRect.top)
  })

  it('does not duplicate the flight when the spell entered the battlefield', () => {
    const prev = baseGame({ stack: { 'bolt-1': bolt } })
    const next = baseGame({ stack: {}, players: [player({ battlefield: { 'bolt-1': bolt as never } })] })
    recordCardPosition('bolt-1', domRect(1000, 500), 'stack-zone')

    detectAndAnimateTransitions(prev, next)

    expect(hasFlightFor('bolt-1')).toBe(false)
  })

  it('records a damage number on creature damage', () => {
    const damaged = { id: 'c1', name: 'Grizzly Bears', cardTypes: ['Creature'], damage: 3 }
    const intact = { id: 'c1', name: 'Grizzly Bears', cardTypes: ['Creature'], damage: 0 }
    document.body.innerHTML = '<div data-player-id="p1"><div class="card-slot" data-card-id="c1"></div></div>'
    const prev = baseGame({ players: [player({ battlefield: { c1: intact as never } })] })
    const next = baseGame({ players: [player({ battlefield: { c1: damaged as never } })] })

    detectAndAnimateTransitions(prev, next)

    expect(damageNumbersFor('card:c1').map((n) => n.amount)).toEqual([3])
    expect(getFeedbackFxState().floaters.some((f) => f.text === '-3')).toBe(false)
  })

  it('shows a creature hit only when the spell projectile lands', async () => {
    const damaged = { id: 'c9', name: 'Grizzly Bears', cardTypes: ['Creature'], damage: 3 }
    const intact = { id: 'c9', name: 'Grizzly Bears', cardTypes: ['Creature'], damage: 0 }
    document.body.innerHTML = '<div data-player-id="p1"><div class="card-slot" data-card-id="c9"></div></div>'
    const targetedBolt = { ...bolt, targets: ['c9'] } as unknown as CardView
    const prev = baseGame({ players: [player({ battlefield: { c9: intact as never } })], stack: { 'bolt-1': targetedBolt } })
    const next = baseGame({ players: [player({ battlefield: { c9: damaged as never } })], stack: {} })
    recordCardPosition('bolt-1', domRect(1000, 500), 'stack-zone')

    detectAndAnimateTransitions(prev, next)
    await afterLayout()
    expect(damageNumbersFor('card:c9')).toHaveLength(0)

    await new Promise((resolve) => setTimeout(resolve, 700))
    expect(damageNumbersFor('card:c9').map((n) => n.amount)).toEqual([3])
  })

  it('records a damage number for life lost to a resolved damage spell, not for life lost to an effect', () => {
    document.body.innerHTML = '<div class="player-info-bar" data-player-id="p1" data-player-name="Alice"></div>'
    const before = damageNumbersFor('player:p1').length
    const prev = baseGame({ players: [player({ life: 20 })] })
    detectAndAnimateTransitions(prev, baseGame({ players: [player({ life: 17 })] }))
    expect(damageNumbersFor('player:p1')).toHaveLength(before)

    const bolt = { id: 'bolt-dmg', name: 'Lightning Bolt', rules: ['Lightning Bolt deals 3 damage to any target.'] }
    const withBolt = baseGame({ players: [player({ life: 20 })], stack: { 'bolt-dmg': bolt as never } })
    detectAndAnimateTransitions(withBolt, baseGame({ players: [player({ life: 17 })], stack: {} }))
    expect(damageNumbersFor('player:p1').map((n) => n.amount)).toContain(3)
  })

  it('spawns a life-gain floater for players', () => {
    document.body.innerHTML = '<div class="player-info-bar" data-player-id="p1" data-player-name="Alice"></div>'
    clearFeedbackFx()
    detectAndAnimateTransitions(baseGame({ players: [player({ life: 17 })] }), baseGame({ players: [player({ life: 19 })] }))
    expect(getFeedbackFxState().floaters.some((f) => f.text === '+2' && f.tone === 'good')).toBe(true)
  })

  it('announces a banner on turn change only', () => {
    detectAndAnimateTransitions(baseGame({ turn: 1 }), baseGame({ turn: 1 }))
    expect(getFeedbackFxState().banner).toBeNull()

    detectAndAnimateTransitions(baseGame({ turn: 1 }), baseGame({ turn: 2 }))
    expect(getFeedbackFxState().banner).not.toBeNull()
    expect(getFeedbackFxState().banner?.text).toContain('2')
    expect(getFeedbackFxState().banner?.text).toContain('Alice')
  })
})
