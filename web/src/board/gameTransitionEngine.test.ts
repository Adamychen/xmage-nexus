import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { detectAndAnimateTransitions } from './gameTransitionEngine'
import { getActiveFlights, startCardFlight, clearFlights } from './flightManager'
import { recordCardPosition, clearCardPositionRegistry } from './cardPositionRegistry'
import { makeGameView, makePlayer, makePermanent, makeCard } from '../__fixtures__/gameViews'

const mockRect = (left: number, top: number, width = 80, height = 112): DOMRect =>
  ({
    left,
    top,
    width,
    height,
    right: left + width,
    bottom: top + height,
    x: left,
    y: top,
    toJSON: () => {},
  } as DOMRect)

describe('gameTransitionEngine', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    // rAF determinista sobre fake timers (doble rAF ≈ 32ms)
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) =>
      setTimeout(() => cb(performance.now()), 16)
    )
    clearCardPositionRegistry()
    clearFlights()
    document.body.innerHTML = `
      <div class="game-board">
        <div class="player-zone" data-player-id="p-alice" data-player-name="Alice">
          <div class="library-stack" style="width: 80px; height: 112px;"></div>
          <div class="hand-zone" style="width: 300px; height: 112px;">
            <div class="hand-card-slot" style="width: 80px; height: 112px;">
              <div data-card-id="h-new" style="width: 80px; height: 112px;"></div>
            </div>
          </div>
          <div class="creatures-band" style="width: 500px; height: 112px;">
            <div data-card-id="perm-grizzly" style="width: 80px; height: 112px;"></div>
          </div>
          <div class="graveyard-stack" style="width: 80px; height: 112px;"></div>
        </div>
        <div class="stack-zone" style="width: 250px; height: 400px;">
          <div data-card-id="spell-bolt" class="stack-tl-entry">
            <div class="stack-tl-card">
              <div class="stack-thumb" style="width: 40px; height: 56px;"></div>
            </div>
          </div>
        </div>
      </div>
    `

    const lib = document.querySelector('.library-stack')
    if (lib) vi.spyOn(lib, 'getBoundingClientRect').mockReturnValue(mockRect(100, 100))

    const hand = document.querySelector('.hand-zone')
    if (hand) vi.spyOn(hand, 'getBoundingClientRect').mockReturnValue(mockRect(400, 600, 300, 112))

    const handSlot = document.querySelector('[data-card-id="h-new"]')
    if (handSlot) vi.spyOn(handSlot, 'getBoundingClientRect').mockReturnValue(mockRect(500, 620))

    const handSlotWrap = document.querySelector('.hand-card-slot')
    if (handSlotWrap) vi.spyOn(handSlotWrap, 'getBoundingClientRect').mockReturnValue(mockRect(500, 620))

    const stack = document.querySelector('.stack-zone')
    if (stack) vi.spyOn(stack, 'getBoundingClientRect').mockReturnValue(mockRect(800, 300, 250, 400))

    const stackThumb = document.querySelector('[data-card-id="spell-bolt"] .stack-thumb')
    if (stackThumb) vi.spyOn(stackThumb, 'getBoundingClientRect').mockReturnValue(mockRect(810, 320, 40, 56))

    const stackEntry = document.querySelector('[data-card-id="spell-bolt"]')
    if (stackEntry) vi.spyOn(stackEntry, 'getBoundingClientRect').mockReturnValue(mockRect(800, 300, 250, 80))

    const grave = document.querySelector('.graveyard-stack')
    if (grave) vi.spyOn(grave, 'getBoundingClientRect').mockReturnValue(mockRect(200, 100))

    const grizzly = document.querySelector('[data-card-id="perm-grizzly"]')
    if (grizzly) vi.spyOn(grizzly, 'getBoundingClientRect').mockReturnValue(mockRect(450, 400))
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    clearCardPositionRegistry()
  })

  it('detects card draws from library to hand (opponent, uses handCount)', () => {
    const alice1 = makePlayer({ playerId: 'p-alice', name: 'Alice', handCount: 3 })
    const prevGame = makeGameView({ players: [alice1] })

    const alice2 = makePlayer({ playerId: 'p-alice', name: 'Alice', handCount: 4 })
    const nextGame = makeGameView({ players: [alice2] })

    detectAndAnimateTransitions(prevGame, nextGame)
    vi.advanceTimersByTime(200)

    const flights = getActiveFlights()
    expect(flights.length).toBeGreaterThan(0)
  })

  it('lands opponent draws on the last hand slot, not the hand zone center', () => {
    const alice1 = makePlayer({ playerId: 'p-alice', name: 'Alice', handCount: 3 })
    const prevGame = makeGameView({ players: [alice1] })
    const alice2 = makePlayer({ playerId: 'p-alice', name: 'Alice', handCount: 4 })
    const nextGame = makeGameView({ players: [alice2] })

    detectAndAnimateTransitions(prevGame, nextGame)
    vi.advanceTimersByTime(200)

    const flights = getActiveFlights()
    expect(flights.length).toBeGreaterThan(0)
    expect(flights[0].toRect.left).toBe(500)
    expect(flights[0].toRect.top).toBe(620)
    expect(flights[0].toSelector).toContain('hand-card-slot')
  })

  it('detects card draws for controlled player using real myHand IDs', () => {
    const alice1 = makePlayer({ playerId: 'p-alice', name: 'Alice', controlled: true, handCount: 1 })
    const prevGame = makeGameView({
      players: [alice1],
      myHand: { 'h-old': makeCard({ id: 'h-old', name: 'Forest' }) },
    })

    const alice2 = makePlayer({ playerId: 'p-alice', name: 'Alice', controlled: true, handCount: 2 })
    const nextGame = makeGameView({
      players: [alice2],
      myHand: {
        'h-old': makeCard({ id: 'h-old', name: 'Forest' }),
        'h-new': makeCard({ id: 'h-new', name: 'Lightning Bolt' }),
      },
    })

    detectAndAnimateTransitions(prevGame, nextGame)
    vi.advanceTimersByTime(200)

    const flights = getActiveFlights()
    expect(flights.some((f) => f.card.name === 'Lightning Bolt')).toBe(true)
  })

  it('lands a controlled draw on the exact hand card slot via data-card-id', () => {
    const alice1 = makePlayer({ playerId: 'p-alice', name: 'Alice', controlled: true, handCount: 1 })
    const prevGame = makeGameView({
      players: [alice1],
      myHand: { 'h-old': makeCard({ id: 'h-old', name: 'Forest' }) },
    })
    const alice2 = makePlayer({ playerId: 'p-alice', name: 'Alice', controlled: true, handCount: 2 })
    const nextGame = makeGameView({
      players: [alice2],
      myHand: {
        'h-old': makeCard({ id: 'h-old', name: 'Forest' }),
        'h-new': makeCard({ id: 'h-new', name: 'Lightning Bolt' }),
      },
    })

    detectAndAnimateTransitions(prevGame, nextGame)
    vi.advanceTimersByTime(200)

    const flight = getActiveFlights().find((f) => f.card.name === 'Lightning Bolt')
    expect(flight).toBeDefined()
    expect(flight?.toRect.left).toBe(500)
    expect(flight?.toRect.top).toBe(620)
    expect(flight?.toSelector).toBe('[data-card-id="h-new"]')
  })

  it('lands a controlled draw on the dedicated hand bar (my hand lives outside the player zone)', () => {
    document.querySelector('.player-zone .hand-zone')?.remove()
    document.querySelector('[data-card-id="h-new"]')?.remove()
    const bar = document.createElement('div')
    bar.className = 'hand-bar'
    bar.innerHTML = '<div class="hand-card-slot"><div data-card-id="h-new" style="width:80px;height:112px;"></div></div>'
    document.querySelector('.game-board')!.appendChild(bar)
    vi.spyOn(bar, 'getBoundingClientRect').mockReturnValue(mockRect(100, 700, 1200, 174))
    const barSlot = bar.querySelector('[data-card-id="h-new"]') as HTMLElement
    vi.spyOn(barSlot, 'getBoundingClientRect').mockReturnValue(mockRect(500, 710))

    const alice1 = makePlayer({ playerId: 'p-alice', name: 'Alice', controlled: true, handCount: 1 })
    const prevGame = makeGameView({
      players: [alice1],
      myHand: { 'h-old': makeCard({ id: 'h-old', name: 'Forest' }) },
    })
    const alice2 = makePlayer({ playerId: 'p-alice', name: 'Alice', controlled: true, handCount: 2 })
    const nextGame = makeGameView({
      players: [alice2],
      myHand: {
        'h-old': makeCard({ id: 'h-old', name: 'Forest' }),
        'h-new': makeCard({ id: 'h-new', name: 'Lightning Bolt' }),
      },
    })

    detectAndAnimateTransitions(prevGame, nextGame)
    vi.advanceTimersByTime(200)

    const flight = getActiveFlights().find((f) => f.card.name === 'Lightning Bolt')
    expect(flight).toBeDefined()
    expect(flight?.toRect.left).toBe(500)
    expect(flight?.toRect.top).toBe(710)
  })

  it('detects spells cast to the stack', () => {
    const bolt = makeCard({
      id: 'spell-bolt',
      name: 'Lightning Bolt',
      controllerId: 'p-alice',
      sourceCard: makeCard({ id: 'hand-bolt', name: 'Lightning Bolt' }),
    })
    const alice = makePlayer({ playerId: 'p-alice', name: 'Alice' })

    recordCardPosition('hand-bolt', mockRect(400, 600), 'hand-zone')

    const prevGame = makeGameView({ players: [alice], stack: {} })
    const nextGame = makeGameView({ players: [alice], stack: { 'spell-bolt': bolt } })

    detectAndAnimateTransitions(prevGame, nextGame)
    vi.advanceTimersByTime(200)

    const flights = getActiveFlights()
    expect(flights.some((f) => f.card.name === 'Lightning Bolt')).toBe(true)
  })

  it('skips the flight when the only source available is the stack entry itself', () => {
    const bolt = makeCard({ id: 'spell-bolt', name: 'Lightning Bolt', controllerId: 'p-alice' })
    const alice = makePlayer({ playerId: 'p-alice', name: 'Alice' })

    const prevGame = makeGameView({ players: [alice], stack: {} })
    const nextGame = makeGameView({ players: [alice], stack: { 'spell-bolt': bolt } })

    detectAndAnimateTransitions(prevGame, nextGame)
    vi.advanceTimersByTime(200)

    expect(getActiveFlights()).toHaveLength(0)
  })

  it('lands a new stack spell on the stack entry (thumb), not the zone center', () => {
    const bolt = makeCard({ id: 'spell-bolt', name: 'Lightning Bolt', controllerId: 'p-alice' })
    const alice = makePlayer({ playerId: 'p-alice', name: 'Alice' })

    recordCardPosition('spell-bolt', mockRect(400, 600), 'hand-zone')

    const prevGame = makeGameView({ players: [alice], stack: {} })
    const nextGame = makeGameView({ players: [alice], stack: { 'spell-bolt': bolt } })

    detectAndAnimateTransitions(prevGame, nextGame)
    vi.advanceTimersByTime(200)

    const flight = getActiveFlights().find((f) => f.card.name === 'Lightning Bolt')
    expect(flight).toBeDefined()
    expect(flight?.toRect.left).toBe(810)
    expect(flight?.toRect.top).toBe(320)
    expect(flight?.toSelector).toBe('[data-card-id="spell-bolt"] .stack-thumb')
  })

  it('detects creatures dying via DOM when slot is still present', () => {
    const grizzly = makePermanent({ id: 'perm-grizzly', name: 'Grizzly Bears' })
    const alice1 = makePlayer({
      playerId: 'p-alice',
      name: 'Alice',
      battlefield: { 'perm-grizzly': grizzly },
    })
    const prevGame = makeGameView({ players: [alice1] })

    const alice2 = makePlayer({ playerId: 'p-alice', name: 'Alice', battlefield: {} })
    const nextGame = makeGameView({ players: [alice2] })

    detectAndAnimateTransitions(prevGame, nextGame)
    vi.advanceTimersByTime(200)

    const flights = getActiveFlights()
    expect(flights.some((f) => f.card.name === 'Grizzly Bears')).toBe(true)
  })

  it('detects creatures dying via cardPositionRegistry when DOM slot is already unmounted', () => {
    const grizzly = makePermanent({ id: 'perm-gone', name: 'Goblin Guide' })

    // Simulate the card having been recorded before unmounting (CardSlot cleanup)
    recordCardPosition('perm-gone', mockRect(500, 400), 'player-zone')

    const alice1 = makePlayer({
      playerId: 'p-alice',
      name: 'Alice',
      battlefield: { 'perm-gone': grizzly },
    })
    const prevGame = makeGameView({ players: [alice1] })

    const alice2 = makePlayer({ playerId: 'p-alice', name: 'Alice', battlefield: {} })
    const nextGame = makeGameView({ players: [alice2] })

    detectAndAnimateTransitions(prevGame, nextGame)
    vi.advanceTimersByTime(200)

    const flights = getActiveFlights()
    expect(flights.some((f) => f.card.name === 'Goblin Guide')).toBe(true)
  })

  it('does not duplicate a flight when a CardSlot already started one for the card', () => {
    const grizzly = makePermanent({ id: 'perm-grizzly', name: 'Grizzly Bears' })
    const alice1 = makePlayer({
      playerId: 'p-alice',
      name: 'Alice',
      battlefield: { 'perm-grizzly': grizzly },
    })
    const prevGame = makeGameView({ players: [alice1] })

    const alice2 = makePlayer({ playerId: 'p-alice', name: 'Alice', battlefield: {} })
    const nextGame = makeGameView({ players: [alice2] })

    const preexistingId = startCardFlight(grizzly, mockRect(450, 400), mockRect(900, 100, 80, 112), 340)
    expect(preexistingId).not.toBeNull()

    detectAndAnimateTransitions(prevGame, nextGame)
    vi.advanceTimersByTime(200)

    const flights = getActiveFlights()
    expect(flights.length).toBe(1)
    expect(flights[0].flightId).toBe(preexistingId)
    expect(flights[0].toRect.left).toBe(900)
  })

  it('shakes creatures whose damage increased', () => {
    const wounded = makePermanent({ id: 'perm-grizzly', name: 'Grizzly Bears' })
    ;(wounded as unknown as { damage: number }).damage = 2
    const alice1 = makePlayer({
      playerId: 'p-alice',
      name: 'Alice',
      battlefield: { 'perm-grizzly': makePermanent({ id: 'perm-grizzly', name: 'Grizzly Bears' }) },
    })
    const prevGame = makeGameView({ players: [alice1] })

    const alice2 = makePlayer({
      playerId: 'p-alice',
      name: 'Alice',
      battlefield: { 'perm-grizzly': wounded },
    })
    const nextGame = makeGameView({ players: [alice2] })

    detectAndAnimateTransitions(prevGame, nextGame)

    const grizzlyEl = document.querySelector('[data-card-id="perm-grizzly"]')
    expect(grizzlyEl?.classList.contains('took-damage')).toBe(true)
  })

  it('shakes the player info bar when life drops', () => {
    const alice1 = makePlayer({ playerId: 'p-alice', name: 'Alice', life: 20 })
    const prevGame = makeGameView({ players: [alice1] })
    const alice2 = makePlayer({ playerId: 'p-alice', name: 'Alice', life: 17 })
    const nextGame = makeGameView({ players: [alice2] })

    const zoneRoot = document.querySelector('[data-player-id="p-alice"]') as HTMLElement
    const infoBar = document.createElement('div')
    infoBar.setAttribute('data-player-id', 'p-alice')
    zoneRoot.appendChild(infoBar)

    detectAndAnimateTransitions(prevGame, nextGame)

    expect(infoBar.classList.contains('took-damage')).toBe(true)
    expect(zoneRoot.classList.contains('took-damage')).toBe(false)
  })
})
