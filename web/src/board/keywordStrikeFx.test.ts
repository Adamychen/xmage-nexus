import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cardKeywordIds, LIFELINK_TRAVEL_MS, planKeywordStrikes, playKeywordStrikes, survivesLethal, TRAMPLE_TRAVEL_MS } from './keywordStrikeFx'
import { clearCombatSnapshots, combatantRect, playDamageStrikes, planDamageStrikes, snapshotCombatants } from './combatStrikes'
import { detectAndAnimateTransitions } from './gameTransitionEngine'
import { soundManager } from '../audio/soundManager'
import { clearImpacts, getImpacts } from './impactFx'
import { clearFlights } from './flightManager'
import { clearCardPositionRegistry } from './cardPositionRegistry'
import { damageNumbersFor } from './DamageNumber'
import { makeGameView, makePermanent, makePlayer } from '../__fixtures__/gameViews'
import type { GameView } from '../net/types'

const rect = (left: number, top: number, width = 80, height = 112): DOMRect =>
  ({ left, top, width, height, right: left + width, bottom: top + height, x: left, y: top, toJSON: () => {} } as DOMRect)

const firstStriker = { cardIcons: [{ cardIconType: 'ABILITY_FIRST_STRIKE' }] }

function game(players: ReturnType<typeof makePlayer>[], extra: Partial<GameView> = {}): GameView {
  return makeGameView({ phase: 'COMBAT', step: 'DECLARE_BLOCKERS', players, ...extra })
}

describe('cardKeywordIds', () => {
  it('reads keyword abilities from the rules text', () => {
    const ids = cardKeywordIds({ rules: ['Flying, lifelink'] })
    expect(ids.has('flying')).toBe(true)
    expect(ids.has('lifelink')).toBe(true)
  })

  it('adds the keywords shown by card icons', () => {
    expect(cardKeywordIds({ cardIcons: [{ cardIconType: 'ABILITY_TRAMPLE' }] }).has('trample')).toBe(true)
  })

  it('is empty for a missing card', () => {
    expect(cardKeywordIds(null).size).toBe(0)
    expect(cardKeywordIds(undefined).size).toBe(0)
  })
})

describe('planKeywordStrikes', () => {
  it('flags a deathtouch attacker whose blocker died in this step', () => {
    const goblin = makePermanent({ id: 'a1', name: 'Viper', rules: ['Deathtouch'] })
    const bear = makePermanent({ id: 'b1', name: 'Grizzly Bears' })
    const me = makePlayer({ playerId: 'p-me', name: 'Me', battlefield: { a1: goblin } })
    const prev = game([makePlayer({ playerId: 'p-opp', name: 'Opp', battlefield: { b1: bear } }), me])
    const dead = game([makePlayer({ playerId: 'p-opp', name: 'Opp', graveyard: { b1: bear } }), me])
    const plans = [{ attackerId: 'a1', targetId: 'b1' }]
    expect(planKeywordStrikes(prev, dead, plans)).toEqual([
      { attackerId: 'a1', targetId: 'b1', firstStrike: false, deathtouchKill: true, lifelinkTo: null, trampleTo: null },
    ])
    const alive = game([makePlayer({ playerId: 'p-opp', name: 'Opp', battlefield: { b1: bear } }), me])
    expect(planKeywordStrikes(prev, alive, plans)).toEqual([])
  })

  it('credits lifelink to the controller only when its life went up', () => {
    const lifer = makePermanent({ id: 'a1', name: 'Lifelinker', rules: ['Lifelink'] })
    const plans = [{ attackerId: 'a1', targetId: 'p-opp' }]
    const prev = game([makePlayer({ playerId: 'p-me', name: 'Me', life: 20, battlefield: { a1: lifer } })])
    const gained = game([makePlayer({ playerId: 'p-me', name: 'Me', life: 22, battlefield: { a1: lifer } })])
    const same = game([makePlayer({ playerId: 'p-me', name: 'Me', life: 20, battlefield: { a1: lifer } })])
    expect(planKeywordStrikes(prev, gained, plans)).toEqual([
      { attackerId: 'a1', targetId: 'p-opp', firstStrike: false, deathtouchKill: false, lifelinkTo: 'p-me', trampleTo: null },
    ])
    expect(planKeywordStrikes(prev, same, plans)).toEqual([])
  })

  it('sends trample overflow to the defender only when a blocked attacker hurt it', () => {
    const trampler = makePermanent({ id: 'a1', name: 'Charger', rules: ['Trample'] })
    const bear = makePermanent({ id: 'b1', name: 'Grizzly Bears' })
    const groups: Array<Record<string, unknown>> = [{ attackers: ['a1'], blockers: ['b1'], defenderId: 'p-opp' }]
    const board = (life: number) => [
      makePlayer({ playerId: 'p-opp', name: 'Opp', life, battlefield: { b1: bear } }),
      makePlayer({ playerId: 'p-me', name: 'Me', battlefield: { a1: trampler } }),
    ]
    const prev = game(board(20), { combat: groups as GameView['combat'] })
    const next = game(board(17), { combat: groups as GameView['combat'] })
    expect(planKeywordStrikes(prev, next, [{ attackerId: 'a1', targetId: 'b1' }])).toEqual([
      { attackerId: 'a1', targetId: 'b1', firstStrike: false, deathtouchKill: false, lifelinkTo: null, trampleTo: 'p-opp' },
    ])
    expect(planKeywordStrikes(prev, next, [{ attackerId: 'a1', targetId: 'p-opp' }])).toEqual([])
  })

  it('flags first strike from the card icon', () => {
    const knight = makePermanent({ id: 'a1', name: 'Knight', ...firstStriker })
    const prev = game([makePlayer({ playerId: 'p-me', name: 'Me', battlefield: { a1: knight } })])
    expect(planKeywordStrikes(prev, prev, [{ attackerId: 'a1', targetId: 'p-opp' }])).toEqual([
      { attackerId: 'a1', targetId: 'p-opp', firstStrike: true, deathtouchKill: false, lifelinkTo: null, trampleTo: null },
    ])
  })

  it('ignores a plain attacker', () => {
    const plain = makePermanent({ id: 'a1', name: 'Bear' })
    const prev = game([makePlayer({ playerId: 'p-me', name: 'Me', battlefield: { a1: plain } })])
    expect(planKeywordStrikes(prev, prev, [{ attackerId: 'a1', targetId: 'p-opp' }])).toEqual([])
  })
})

describe('survivesLethal', () => {
  it('is true for indestructible damage at or over toughness', () => {
    expect(survivesLethal({ cardIcons: [{ cardIconType: 'ABILITY_INDESTRUCTIBLE' }], toughness: '2', damage: 2 })).toBe(true)
    expect(survivesLethal({ rules: ['Indestructible'], toughness: '2', damage: 3 })).toBe(true)
  })

  it('is false below toughness, without indestructible, or with no toughness', () => {
    expect(survivesLethal({ rules: ['Indestructible'], toughness: '2', damage: 1 })).toBe(false)
    expect(survivesLethal({ rules: ['Flying'], toughness: '2', damage: 3 })).toBe(false)
    expect(survivesLethal({ rules: ['Indestructible'], toughness: '0', damage: 3 })).toBe(false)
    expect(survivesLethal(null)).toBe(false)
  })
})

describe('playKeywordStrikes', () => {
  const spy = (sel: string, r: DOMRect) => {
    const el = document.querySelector(sel)
    if (el) vi.spyOn(el, 'getBoundingClientRect').mockReturnValue(r)
  }

  beforeEach(() => {
    vi.useFakeTimers()
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => setTimeout(() => cb(performance.now()), 16))
    clearImpacts()
    clearFlights()
    clearCardPositionRegistry()
    clearCombatSnapshots()
    vi.spyOn(soundManager, 'play').mockImplementation(() => {})
    document.body.innerHTML = `
      <div class="opponent-zone" data-player-id="p-opp" data-player-name="Opp">
        <span data-player-anchor></span>
        <div class="creatures-band"><div class="card-slot" data-card-id="b1"></div></div>
      </div>
      <div class="player-zone" data-player-id="p-me" data-player-name="Me">
        <span data-player-anchor></span>
        <div class="creatures-band"><div class="card-slot" data-card-id="a1"></div></div>
      </div>`
    spy('[data-player-id="p-opp"] [data-player-anchor]', rect(400, 40, 60, 60))
    spy('[data-player-id="p-me"] [data-player-anchor]', rect(60, 700, 60, 60))
    spy('[data-card-id="b1"]', rect(420, 200))
    spy('[data-card-id="a1"]', rect(300, 600))
  })

  afterEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
    vi.useRealTimers()
    document.body.innerHTML = ''
  })

  const strike = (extra: Partial<Parameters<typeof playKeywordStrikes>[0][number]> = {}) => ({
    attackerId: 'a1',
    targetId: 'b1',
    firstStrike: false,
    deathtouchKill: false,
    lifelinkTo: null,
    trampleTo: null,
    ...extra,
  })

  it('maps each player-facing result to its landing time plus travel', () => {
    const schedule = { holdMs: 0, impactAt: new Map([['a1', 100]]) }
    const hits = playKeywordStrikes([strike({ trampleTo: 'p-opp', lifelinkTo: 'p-me' })], schedule)
    expect(hits.playerHits.get('p-opp')).toBe(100 + TRAMPLE_TRAVEL_MS)
    expect(hits.lifeGains.get('p-me')).toBe(100 + LIFELINK_TRAVEL_MS)
  })

  it('keeps the earliest trample arrival and the latest lifelink arrival', () => {
    const schedule = { holdMs: 0, impactAt: new Map([['a1', 100], ['a2', 300]]) }
    const hits = playKeywordStrikes([
      strike({ trampleTo: 'p-opp' }),
      strike({ attackerId: 'a2', trampleTo: 'p-opp' }),
      strike({ lifelinkTo: 'p-me' }),
      strike({ attackerId: 'a2', lifelinkTo: 'p-me' }),
    ], schedule)
    expect(hits.playerHits.get('p-opp')).toBe(100 + TRAMPLE_TRAVEL_MS)
    expect(hits.lifeGains.get('p-me')).toBe(300 + LIFELINK_TRAVEL_MS)
  })

  it('skips strikes whose attacker has no landing time', () => {
    const hits = playKeywordStrikes([strike({ attackerId: 'ghost', trampleTo: 'p-opp' })], { holdMs: 0, impactAt: new Map() })
    expect(hits.playerHits.size).toBe(0)
  })

  it('spawns each keyword moment when its strike lands', () => {
    const schedule = { holdMs: 0, impactAt: new Map([['a1', 100]]) }
    playKeywordStrikes([strike({ firstStrike: true, deathtouchKill: true, lifelinkTo: 'p-me', trampleTo: 'p-opp' })], schedule)
    vi.advanceTimersByTime(99)
    expect(getImpacts()).toHaveLength(0)
    vi.advanceTimersByTime(1)
    const kinds = getImpacts().map((f) => f.kind)
    expect(kinds).toEqual(expect.arrayContaining(['first-strike', 'deathtouch', 'lifelink', 'trample']))
    const lifelink = getImpacts().find((f) => f.kind === 'lifelink')
    expect(lifelink?.toX).toBe(90)
    expect(lifelink?.toY).toBe(730)
    const trample = getImpacts().find((f) => f.kind === 'trample')
    expect(trample?.toX).toBe(430)
    expect(trample?.toY).toBe(70)
  })
})

describe('keyword strike engine integration', () => {
  const STRIKE_LANDS_MS = 280
  beforeEach(() => {
    vi.useFakeTimers()
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => setTimeout(() => cb(performance.now()), 16))
    clearImpacts()
    clearFlights()
    clearCardPositionRegistry()
    clearCombatSnapshots()
    vi.spyOn(soundManager, 'play').mockImplementation(() => {})
    const animate = vi.fn(() => ({ finished: new Promise<void>(() => {}) } as unknown as Animation))
    ;(HTMLElement.prototype as unknown as { animate: typeof animate }).animate = animate
    document.body.innerHTML = `
      <div class="opponent-zone" data-player-id="p-opp" data-player-name="Opp">
        <span data-player-anchor></span>
        <div class="player-info-bar" data-player-id="p-opp"></div>
        <div class="creatures-band"><div class="card-slot" data-card-id="b1"></div></div>
      </div>
      <div class="player-zone" data-player-id="p-me" data-player-name="Me">
        <span data-player-anchor></span>
        <div class="creatures-band">
          <div class="card-slot" data-card-id="a1"></div>
          <div class="card-slot" data-card-id="bear"></div>
        </div>
      </div>`
    const place = (sel: string, r: DOMRect) => {
      const el = document.querySelector(sel)
      if (el) vi.spyOn(el, 'getBoundingClientRect').mockReturnValue(r)
    }
    place('[data-player-id="p-opp"] [data-player-anchor]', rect(400, 40, 60, 60))
    place('[data-player-id="p-me"] [data-player-anchor]', rect(60, 700, 60, 60))
    place('[data-card-id="b1"]', rect(420, 200))
    place('[data-card-id="a1"]', rect(300, 600))
    place('[data-card-id="bear"]', rect(120, 300))
  })

  afterEach(() => {
    delete (HTMLElement.prototype as unknown as { animate?: unknown }).animate
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
    vi.useRealTimers()
    document.body.innerHTML = ''
  })

  it('shows an indestructible creature cracking its shield when lethal damage does not kill it', () => {
    const wall = makePermanent({ id: 'bear', name: 'Iron Wall', rules: ['Indestructible'], toughness: '2', damage: 0 })
    const hurt = makePermanent({ ...wall, damage: 3 })
    const me = (perm: typeof wall) => makePlayer({ playerId: 'p-me', name: 'Me', battlefield: { bear: perm } })
    detectAndAnimateTransitions(game([me(wall)]), game([me(hurt)]))
    vi.advanceTimersByTime(500)
    expect(getImpacts().map((f) => f.kind)).toContain('indestructible')
  })

  it('plays the defender damage number when a trampling attacker overflows its blocker', () => {
    const goblin = makePermanent({ id: 'a1', name: 'Charger', rules: ['Trample'] })
    const bear = makePermanent({ id: 'b1', name: 'Grizzly Bears' })
    const groups: Array<Record<string, unknown>> = [{ attackers: ['a1'], blockers: ['b1'], defenderId: 'p-opp' }]
    const board = (life: number) => [
      makePlayer({ playerId: 'p-opp', name: 'Opp', life, battlefield: { b1: bear } }),
      makePlayer({ playerId: 'p-me', name: 'Me', battlefield: { a1: goblin } }),
    ]
    const prev = makeGameView({ phase: 'COMBAT', step: 'DECLARE_BLOCKERS', players: board(20), combat: groups as GameView['combat'] })
    const next = makeGameView({ phase: 'COMBAT', step: 'COMBAT_DAMAGE', players: board(17), combat: groups as GameView['combat'] })
    expect(planDamageStrikes(prev, next)).toEqual([{ attackerId: 'a1', targetId: 'b1' }])

    detectAndAnimateTransitions(prev, next)
    const landsAt = STRIKE_LANDS_MS + TRAMPLE_TRAVEL_MS
    vi.advanceTimersByTime(STRIKE_LANDS_MS)
    expect(getImpacts().map((f) => f.kind)).toContain('trample')
    vi.advanceTimersByTime(landsAt - STRIKE_LANDS_MS - 1)
    expect(damageNumbersFor('player:p-opp')).toEqual([])
    vi.advanceTimersByTime(1)
    expect(damageNumbersFor('player:p-opp').map((d) => d.amount)).toEqual([3])
  })
})

describe('keyword strikes on a combatant that left its slot', () => {
  const spy = (sel: string, r: DOMRect) => {
    const el = document.querySelector(sel)
    if (el) vi.spyOn(el, 'getBoundingClientRect').mockReturnValue(r)
  }

  const bear = makePermanent({ id: 'b1', name: 'Grizzly Bears' })
  const viper = makePermanent({ id: 'a1', name: 'Viper', rules: ['Deathtouch'] })
  const groups: Array<Record<string, unknown>> = [{ attackers: ['a1'], blockers: ['b1'], defenderId: 'p-opp' }]
  const prev = makeGameView({
    phase: 'COMBAT',
    step: 'DECLARE_BLOCKERS',
    combat: groups as GameView['combat'],
    players: [
      makePlayer({ playerId: 'p-opp', name: 'Opp', battlefield: { b1: bear } }),
      makePlayer({ playerId: 'p-me', name: 'Me', battlefield: { a1: viper } }),
    ],
  })
  const next = makeGameView({
    phase: 'COMBAT',
    step: 'COMBAT_DAMAGE',
    players: [
      makePlayer({ playerId: 'p-opp', name: 'Opp', graveyard: { b1: bear } }),
      makePlayer({ playerId: 'p-me', name: 'Me', battlefield: { a1: viper } }),
    ],
  })

  beforeEach(() => {
    vi.useFakeTimers()
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => setTimeout(() => cb(performance.now()), 16))
    clearImpacts()
    clearFlights()
    clearCardPositionRegistry()
    clearCombatSnapshots()
    vi.spyOn(soundManager, 'play').mockImplementation(() => {})
    const animate = vi.fn(() => ({ finished: new Promise<void>(() => {}) } as unknown as Animation))
    ;(HTMLElement.prototype as unknown as { animate: typeof animate }).animate = animate
    document.body.innerHTML = `
      <div class="opponent-zone" data-player-id="p-opp" data-player-name="Opp">
        <span data-player-anchor></span>
        <div class="creatures-band"><div class="card-slot" data-card-id="b1"></div></div>
      </div>
      <div class="player-zone" data-player-id="p-me" data-player-name="Me">
        <span data-player-anchor></span>
        <div class="creatures-band"><div class="card-slot" data-card-id="a1"></div></div>
      </div>`
    spy('[data-player-id="p-opp"] [data-player-anchor]', rect(400, 40, 60, 60))
    spy('[data-player-id="p-me"] [data-player-anchor]', rect(60, 700, 60, 60))
    spy('[data-card-id="b1"]', rect(420, 200))
    spy('[data-card-id="a1"]', rect(300, 600))
  })

  afterEach(() => {
    delete (HTMLElement.prototype as unknown as { animate?: unknown }).animate
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
    vi.useRealTimers()
    document.body.innerHTML = ''
  })

  it('places the live slot first, then the snapshot once the slot is gone, and is null for an unknown id', () => {
    expect(combatantRect('b1')).toMatchObject({ left: 420, top: 200 })
    snapshotCombatants(prev)
    document.querySelector('[data-card-id="b1"]')!.remove()
    expect(combatantRect('b1')).toMatchObject({ left: 420, top: 200 })
    expect(combatantRect('nobody')).toBeNull()
  })

  it('spawns deathtouch on a blocker that died in the strikes, drawn by its stand-in ghost', () => {
    snapshotCombatants(prev)
    document.querySelector('[data-card-id="b1"]')!.remove()
    const plans = planDamageStrikes(prev, next)
    const schedule = playDamageStrikes(plans, ['a1', 'b1'])
    const ghost = document.querySelector('.combat-strike-ghost') as HTMLElement
    spy('.combat-strike-ghost', rect(420, 200))
    vi.spyOn(ghost.firstElementChild as Element, 'getBoundingClientRect').mockReturnValue(rect(420, 200))
    playKeywordStrikes(planKeywordStrikes(prev, next, plans), schedule)
    vi.advanceTimersByTime(schedule.impactAt.get('a1') ?? 0)
    expect(getImpacts().map((f) => f.kind)).toContain('deathtouch')
  })

  it('keeps the stand-in through the whole transition, so deathtouch still lands after the snapshot is pruned', () => {
    snapshotCombatants(prev)
    document.querySelector('[data-card-id="b1"]')!.remove()
    detectAndAnimateTransitions(prev, next)
    const ghost = document.querySelector('.combat-strike-ghost') as HTMLElement
    vi.spyOn(ghost.firstElementChild as Element, 'getBoundingClientRect').mockReturnValue(rect(420, 200))
    vi.advanceTimersByTime(300)
    expect(getImpacts().map((f) => f.kind)).toContain('deathtouch')
  })
})
