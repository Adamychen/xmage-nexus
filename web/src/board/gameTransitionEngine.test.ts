import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { detectAndAnimateTransitions } from './gameTransitionEngine'
import { getActiveFlights, startCardFlight, clearFlights, CAST_FLIGHT_MS } from './flightManager'
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

  it('measures the draw destination at rest while the draw slide is still moving the slot', () => {
    const realGetComputedStyle = window.getComputedStyle.bind(window)
    const slot = document.querySelector('[data-card-id="h-new"]') as HTMLElement
    vi.spyOn(slot, 'getBoundingClientRect').mockReturnValue(mockRect(100, 120))
    vi.spyOn(window, 'getComputedStyle').mockImplementation((el: Element) =>
      el === slot ? ({ translate: '-400px -500px' } as CSSStyleDeclaration) : realGetComputedStyle(el)
    )

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
    expect(flights.find((f) => f.card.name === 'Lightning Bolt')?.trail).toBe('gold')
  })

  it('a cast spell is lifted to the middle of the screen before it flies to the stack', () => {
    const bolt = makeCard({
      id: 'spell-bolt',
      name: 'Lightning Bolt',
      controllerId: 'p-alice',
      sourceCard: makeCard({ id: 'hand-bolt', name: 'Lightning Bolt' }),
    })
    const alice = makePlayer({ playerId: 'p-alice', name: 'Alice' })
    recordCardPosition('hand-bolt', mockRect(400, 600), 'hand-zone')

    detectAndAnimateTransitions(makeGameView({ players: [alice], stack: {} }), makeGameView({ players: [alice], stack: { 'spell-bolt': bolt } }))
    vi.advanceTimersByTime(200)

    const flight = getActiveFlights().find((f) => f.card.name === 'Lightning Bolt')
    expect(flight?.lift).toBe(true)
    expect(flight?.duration).toBe(CAST_FLIGHT_MS)
    expect(flight?.toSelector).toBe('[data-card-id="spell-bolt"] .stack-thumb')
  })

  it('a cast spell from an opponent is lifted from its player zone', () => {
    const bolt = makeCard({
      id: 'spell-bob-bolt',
      name: 'Lightning Bolt',
      controllerId: 'p-bob',
      sourceCard: makeCard({ id: 'hand-bob-bolt', name: 'Lightning Bolt' }),
    })
    const alice = makePlayer({ playerId: 'p-alice', name: 'Alice' })
    const bob = makePlayer({ playerId: 'p-bob', name: 'Bob' })
    const bobZone = document.createElement('div')
    bobZone.setAttribute('data-player-id', 'p-bob')
    bobZone.innerHTML = '<div class="hand-zone"></div>'
    document.body.appendChild(bobZone)
    vi.spyOn(bobZone.querySelector('.hand-zone') as HTMLElement, 'getBoundingClientRect').mockReturnValue(mockRect(100, 700, 300, 112))

    detectAndAnimateTransitions(
      makeGameView({ players: [alice, bob], stack: {} }),
      makeGameView({ players: [alice, bob], stack: { 'spell-bob-bolt': bolt } }),
    )
    vi.advanceTimersByTime(200)

    const flight = getActiveFlights().find((f) => f.card.name === 'Lightning Bolt')
    expect(flight?.lift).toBe(true)
    expect(flight?.toRect.left).toBe(800)
    bobZone.remove()
  })

  it('a cast spell with no source rect is skipped and starts no flight', () => {
    const bolt = makeCard({ id: 'spell-ghost', name: 'Lightning Bolt', controllerId: 'p-nobody' })
    const alice = makePlayer({ playerId: 'p-alice', name: 'Alice' })

    detectAndAnimateTransitions(
      makeGameView({ players: [alice], stack: {} }),
      makeGameView({ players: [alice], stack: { 'spell-ghost': bolt } }),
    )
    vi.advanceTimersByTime(200)

    expect(getActiveFlights()).toHaveLength(0)
  })

  it('an ability on the stack does not lift its source card', () => {
    const ability = makeCard({
      id: 'ab-lift',
      name: 'Ability',
      mageObjectType: 'TRIGGERED_ABILITY',
      controllerId: 'p-alice',
      sourceCard: makeCard({ id: 'perm-grizzly', name: 'Grizzly Bears' }),
    })
    const alice = makePlayer({ playerId: 'p-alice', name: 'Alice' })
    recordCardPosition('perm-grizzly', mockRect(450, 400), 'creatures-band')

    detectAndAnimateTransitions(makeGameView({ players: [alice], stack: {} }), makeGameView({ players: [alice], stack: { 'ab-lift': ability } }))
    vi.advanceTimersByTime(200)

    const flight = getActiveFlights().find((f) => f.card.name === 'Ability')
    expect(flight).toBeDefined()
    expect(flight?.lift).toBeFalsy()
    expect(flight?.duration).toBe(380)
  })

  it('a cast spell starts no flight under reduced motion', () => {
    const original = window.matchMedia
    window.matchMedia = vi.fn().mockReturnValue({ matches: true }) as unknown as typeof window.matchMedia
    try {
      const bolt = makeCard({ id: 'spell-bolt', name: 'Lightning Bolt', controllerId: 'p-alice', sourceCard: makeCard({ id: 'hand-bolt', name: 'Lightning Bolt' }) })
      const alice = makePlayer({ playerId: 'p-alice', name: 'Alice' })
      recordCardPosition('hand-bolt', mockRect(400, 600), 'hand-zone')

      detectAndAnimateTransitions(makeGameView({ players: [alice], stack: {} }), makeGameView({ players: [alice], stack: { 'spell-bolt': bolt } }))
      vi.advanceTimersByTime(200)

      expect(getActiveFlights()).toHaveLength(0)
    } finally {
      window.matchMedia = original
    }
  })

  it('a cast spell starts no flight when effects are disabled', async () => {
    const { setState, getState } = await import('../state/state')
    const prev = getState().settings
    setState({ settings: { ...prev, effects: false } } as never)
    try {
      const bolt = makeCard({ id: 'spell-bolt', name: 'Lightning Bolt', controllerId: 'p-alice', sourceCard: makeCard({ id: 'hand-bolt', name: 'Lightning Bolt' }) })
      const alice = makePlayer({ playerId: 'p-alice', name: 'Alice' })
      recordCardPosition('hand-bolt', mockRect(400, 600), 'hand-zone')

      detectAndAnimateTransitions(makeGameView({ players: [alice], stack: {} }), makeGameView({ players: [alice], stack: { 'spell-bolt': bolt } }))
      vi.advanceTimersByTime(200)

      expect(getActiveFlights()).toHaveLength(0)
    } finally {
      setState({ settings: prev } as never)
    }
  })

  it('a land entering the battlefield from hand flies with the land variant', () => {
    const forest = makePermanent({ id: 'perm-forest', name: 'Forest', cardTypes: ['Land'] })
    const alice1 = makePlayer({ playerId: 'p-alice', name: 'Alice' })
    const alice2 = makePlayer({ playerId: 'p-alice', name: 'Alice', battlefield: { 'perm-forest': forest } })

    recordCardPosition('perm-forest', mockRect(400, 600), 'hand-zone')
    const band = document.querySelector('.creatures-band') as HTMLElement
    vi.spyOn(band, 'getBoundingClientRect').mockReturnValue(mockRect(100, 100, 500, 112))

    detectAndAnimateTransitions(makeGameView({ players: [alice1] }), makeGameView({ players: [alice2] }))
    vi.advanceTimersByTime(200)

    expect(getActiveFlights().find((f) => f.card.name === 'Forest')?.variant).toBe('land')
  })

  it('an opponent spell with no drawn hand flies from the opponent zone, not from its own stack entry', () => {
    const bob = makePlayer({ playerId: 'p-bob', name: 'Bob' })
    const bolt = makeCard({ id: 'spell-bolt', name: 'Lightning Bolt', controllerId: 'p-bob' })
    const zone = document.createElement('div')
    zone.setAttribute('data-player-id', 'p-bob')
    document.body.appendChild(zone)
    vi.spyOn(zone, 'getBoundingClientRect').mockReturnValue(mockRect(300, 40, 860, 336))

    try {
      detectAndAnimateTransitions(
        makeGameView({ players: [bob], stack: {} }),
        makeGameView({ players: [bob], stack: { 'spell-bolt': bolt } }),
      )
      vi.advanceTimersByTime(200)

      const flight = getActiveFlights().find((f) => f.card.name === 'Lightning Bolt')
      expect(flight).toBeTruthy()
      expect(flight!.fromRect.left + flight!.fromRect.width / 2).toBeCloseTo(730, 0)
    } finally {
      zone.remove()
    }
  })

  it('flies a cast spell to the StackDeck when the stack is shown as a deck', () => {
    document.querySelector('.stack-zone')?.remove()
    const deck = document.createElement('section')
    deck.className = 'stack-deck'
    document.body.appendChild(deck)
    vi.spyOn(deck, 'getBoundingClientRect').mockReturnValue(mockRect(800, 300, 250, 400))
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

    const flight = getActiveFlights().find((f) => f.card.name === 'Lightning Bolt')
    expect(flight).toBeDefined()
    expect(flight?.toRect.left).toBe(800)
    deck.remove()
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

    const alice2 = makePlayer({
      playerId: 'p-alice',
      name: 'Alice',
      battlefield: {},
      graveyard: { 'perm-grizzly': grizzly },
    })
    const nextGame = makeGameView({ players: [alice2] })

    detectAndAnimateTransitions(prevGame, nextGame)
    vi.advanceTimersByTime(200)

    const flights = getActiveFlights()
    expect(flights.some((f) => f.card.name === 'Grizzly Bears')).toBe(true)
  })

  it('does not fly a ghost to the graveyard when a token vanishes without arrival', () => {
    const token = makePermanent({ id: 'perm-token', name: 'Goblin Token' })
    const alice1 = makePlayer({
      playerId: 'p-alice',
      name: 'Alice',
      battlefield: { 'perm-token': token },
    })
    const prevGame = makeGameView({ players: [alice1] })

    const alice2 = makePlayer({ playerId: 'p-alice', name: 'Alice', battlefield: {} })
    const nextGame = makeGameView({ players: [alice2] })

    detectAndAnimateTransitions(prevGame, nextGame)
    vi.advanceTimersByTime(200)

    expect(getActiveFlights().some((f) => f.card.name === 'Goblin Token')).toBe(false)
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

    const alice2 = makePlayer({
      playerId: 'p-alice',
      name: 'Alice',
      battlefield: {},
      graveyard: { 'perm-gone': grizzly },
    })
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

    const alice2 = makePlayer({ playerId: 'p-alice', name: 'Alice', battlefield: {}, graveyard: { 'perm-grizzly': grizzly } })
    const nextGame = makeGameView({ players: [alice2] })

    const preexistingId = startCardFlight(grizzly, mockRect(450, 400), mockRect(900, 100, 80, 112), 340)
    expect(preexistingId).not.toBeNull()

    detectAndAnimateTransitions(prevGame, nextGame)
    vi.advanceTimersByTime(200)

    const flights = getActiveFlights()
    expect(flights.length).toBe(1)
    expect(flights[0].flightId).toBe(preexistingId)
    // La ráfaga encadena: el mismo fantasma se redirige al destino real
    // (cementerio) en vez de duplicarse.
    expect(flights[0].toRect.left).toBe(200)
  })

  it('pulses the source permanent when its ability goes on the stack, not for spells', () => {
    document.querySelector('[data-card-id="perm-grizzly"]')?.classList.add('card-slot')
    const alice = makePlayer({ playerId: 'p-alice', name: 'Alice' })
    const trigger = makeCard({
      id: 'ab-1',
      name: 'Ability',
      mageObjectType: 'TRIGGERED_ABILITY',
      controllerId: 'p-alice',
      sourceCard: makeCard({ id: 'perm-grizzly', name: 'Grizzly Bears' }),
    })

    detectAndAnimateTransitions(
      makeGameView({ players: [alice], stack: {} }),
      makeGameView({ players: [alice], stack: { 'ab-1': trigger } }),
    )
    const source = document.querySelector('[data-card-id="perm-grizzly"]')
    expect(source?.classList.contains('stack-source-pulse')).toBe(true)

    vi.advanceTimersByTime(700)
    expect(source?.classList.contains('stack-source-pulse')).toBe(false)

    const spell = makeCard({
      id: 'spell-2',
      name: 'Shock',
      controllerId: 'p-alice',
      sourceCard: makeCard({ id: 'perm-grizzly', name: 'Grizzly Bears' }),
    })
    detectAndAnimateTransitions(
      makeGameView({ players: [alice], stack: {} }),
      makeGameView({ players: [alice], stack: { 'spell-2': spell } }),
    )
    expect(source?.classList.contains('stack-source-pulse')).toBe(false)
  })

  it('does not pulse the source when effects are disabled', async () => {
    const { setState, getState } = await import('../state/state')
    const prev = getState().settings
    setState({ settings: { ...prev, effects: false } } as never)
    try {
      document.querySelector('[data-card-id="perm-grizzly"]')?.classList.add('card-slot')
      const alice = makePlayer({ playerId: 'p-alice', name: 'Alice' })
      const trigger = makeCard({
        id: 'ab-1',
        name: 'Ability',
        mageObjectType: 'TRIGGERED_ABILITY',
        controllerId: 'p-alice',
        sourceCard: makeCard({ id: 'perm-grizzly', name: 'Grizzly Bears' }),
      })
      detectAndAnimateTransitions(
        makeGameView({ players: [alice], stack: {} }),
        makeGameView({ players: [alice], stack: { 'ab-1': trigger } }),
      )
      expect(document.querySelector('[data-card-id="perm-grizzly"]')?.classList.contains('stack-source-pulse')).toBe(false)
    } finally {
      setState({ settings: prev } as never)
    }
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

  it('shakes the player info bar when life drops to a resolved damage spell', () => {
    const bolt = makeCard({ id: 'bolt-hit', name: 'Lightning Bolt', rules: ['Lightning Bolt deals 3 damage to any target.'] })
    const alice1 = makePlayer({ playerId: 'p-alice', name: 'Alice', life: 20 })
    const prevGame = makeGameView({ players: [alice1], stack: { 'bolt-hit': bolt } })
    const alice2 = makePlayer({ playerId: 'p-alice', name: 'Alice', life: 17 })
    const nextGame = makeGameView({ players: [alice2], stack: {} })

    const zoneRoot = document.querySelector('[data-player-id="p-alice"]') as HTMLElement
    const infoBar = document.createElement('div')
    infoBar.setAttribute('data-player-id', 'p-alice')
    zoneRoot.appendChild(infoBar)

    detectAndAnimateTransitions(prevGame, nextGame)

    expect(infoBar.classList.contains('took-damage')).toBe(true)
    expect(zoneRoot.classList.contains('took-damage')).toBe(false)
  })

  it('does not shake the player info bar when life is lost to an effect', () => {
    const alice1 = makePlayer({ playerId: 'p-alice', name: 'Alice', life: 20 })
    const prevGame = makeGameView({ players: [alice1] })
    const alice2 = makePlayer({ playerId: 'p-alice', name: 'Alice', life: 18 })
    const nextGame = makeGameView({ players: [alice2] })

    const zoneRoot = document.querySelector('[data-player-id="p-alice"]') as HTMLElement
    const infoBar = document.createElement('div')
    infoBar.setAttribute('data-player-id', 'p-alice')
    zoneRoot.appendChild(infoBar)

    detectAndAnimateTransitions(prevGame, nextGame)

    expect(infoBar.classList.contains('took-damage')).toBe(false)
  })
  describe('equipment changing host', () => {
    const sword = () => makePermanent({ name: 'Sword', cardTypes: ['Artifact'] })
    const board = (swordOn: string) => {
      const bear = makePermanent({ name: 'Bear', attachments: swordOn === 'bear' ? ['sword'] : [] })
      const wolf = makePermanent({ name: 'Wolf', attachments: swordOn === 'wolf' ? ['sword'] : [] })
      return makeGameView({
        players: [makePlayer({ playerId: 'p-alice', name: 'Alice', battlefield: { bear, wolf, sword: sword() } })],
      })
    }

    beforeEach(() => {
      const el = document.createElement('div')
      el.setAttribute('data-card-id', 'sword')
      el.style.width = '80px'
      el.style.height = '112px'
      document.querySelector('.creatures-band')!.appendChild(el)
      vi.spyOn(el, 'getBoundingClientRect').mockReturnValue(mockRect(600, 400))
      recordCardPosition('sword', mockRect(300, 400))
    })

    it('flies from the previous slot to the new one when the host changes', () => {
      detectAndAnimateTransitions(board('bear'), board('wolf'))
      vi.advanceTimersByTime(200)
      const flight = getActiveFlights().find((f) => f.card.name === 'Sword')
      expect(flight).toBeDefined()
      expect(flight?.fromRect.left).toBe(300)
      expect(flight?.toRect.left).toBe(600)
    })

    it('does not fly when the host stays the same', () => {
      detectAndAnimateTransitions(board('bear'), board('bear'))
      vi.advanceTimersByTime(200)
      expect(getActiveFlights().find((f) => f.card.name === 'Sword')).toBeUndefined()
    })
  })
  describe('cards arriving in the graveyard', () => {
    const grave = (id: string) => ({ [id]: makeCard({ name: 'Milled' }) })

    it('a milled card flies from the library', () => {
      const prev = makeGameView({ players: [makePlayer({ playerId: 'p-alice', name: 'Alice', controlled: true, handCount: 2 })] })
      const next = makeGameView({ players: [makePlayer({ playerId: 'p-alice', name: 'Alice', controlled: true, handCount: 2, graveyard: grave('milled') })] })
      detectAndAnimateTransitions(prev, next)
      vi.advanceTimersByTime(200)
      const flight = getActiveFlights().find((f) => f.card.name === 'Milled')
      expect(flight?.fromRect.left).toBe(100)
      expect(flight?.fromRect.top).toBe(100)
    })

    it('a discarded card flies from the hand', () => {
      const prev = makeGameView({
        players: [makePlayer({ playerId: 'p-alice', name: 'Alice', controlled: true, handCount: 2 })],
        myHand: { discarded: makeCard({ name: 'Milled' }) },
      })
      const next = makeGameView({ players: [makePlayer({ playerId: 'p-alice', name: 'Alice', controlled: true, handCount: 1, graveyard: grave('discarded') })] })
      detectAndAnimateTransitions(prev, next)
      vi.advanceTimersByTime(200)
      const flight = getActiveFlights().find((f) => f.card.name === 'Milled')
      expect(flight).toBeDefined()
      expect(flight?.fromRect.left).not.toBe(100)
    })

    it('an opponent card that leaves the graveyard-bound hand count unchanged is a mill', () => {
      const prev = makeGameView({ players: [makePlayer({ playerId: 'p-alice', name: 'Alice', handCount: 3 })] })
      const next = makeGameView({ players: [makePlayer({ playerId: 'p-alice', name: 'Alice', handCount: 3, graveyard: grave('milled') })] })
      detectAndAnimateTransitions(prev, next)
      vi.advanceTimersByTime(200)
      expect(getActiveFlights().find((f) => f.card.name === 'Milled')?.fromRect.left).toBe(100)
    })
  })
})
