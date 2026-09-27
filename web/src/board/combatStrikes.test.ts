import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  clearCombatSnapshots,
  combatImpactRemaining,
  planDamageStrikes,
  primeCombatHolds,
  playDamageStrikes,
  snapshotCombatants,
  strikeKind,
  strikeTargetElement,
  strikeVector,
} from './combatStrikes'
import { detectAndAnimateTransitions } from './gameTransitionEngine'
import { soundManager } from '../audio/soundManager'
import { clearImpacts, getImpacts } from './impactFx'
import { clearFlights } from './flightManager'
import { clearCardPositionRegistry, recordCardPosition } from './cardPositionRegistry'
import { makeGameView, makePermanent, makePlayer } from '../__fixtures__/gameViews'
import type { GameView } from '../net/types'

const rect = (left: number, top: number, width = 80, height = 112): DOMRect =>
  ({ left, top, width, height, right: left + width, bottom: top + height, x: left, y: top, toJSON: () => {} } as DOMRect)

const view = (step: string, groups: Array<Record<string, unknown>>, extra: Partial<GameView> = {}): GameView =>
  makeGameView({ phase: 'COMBAT', step, combat: groups as GameView['combat'], ...extra })

const firstStriker = { cardIcons: [{ cardIconType: 'ABILITY_FIRST_STRIKE' }] }
const doubleStriker = { rules: ['Flying, double strike'] }

describe('strikeKind', () => {
  it('reads first and double strike from card icons or keyword lines', () => {
    expect(strikeKind(firstStriker)).toBe('first')
    expect(strikeKind(doubleStriker)).toBe('double')
    expect(strikeKind({ rules: ['Creatures you control have first strike as long as you attack.'] })).toBeNull()
    expect(strikeKind(null)).toBeNull()
  })
})

describe('planDamageStrikes', () => {
  it('never strikes while attackers are only being declared', () => {
    const prev = view('DECLARE_ATTACKERS', [])
    const next = view('DECLARE_ATTACKERS', [{ attackers: ['a1'], blockers: [], defenderId: 'p-opp' }])
    expect(planDamageStrikes(prev, next)).toEqual([])
  })

  it('sends unblocked attackers at the defender and blocked ones at their first blocker', () => {
    const prev = view('DECLARE_BLOCKERS', [
      { attackers: { a1: {} }, blockers: {}, defenderId: 'p-opp' },
      { attackers: ['a2'], blockers: ['b1', 'b2'], defenderId: 'p-opp' },
      { attackers: ['a3'], blockers: [], isBlocked: true, defenderId: 'p-opp' },
    ])
    expect(planDamageStrikes(prev, view('COMBAT_DAMAGE', []))).toEqual([
      { attackerId: 'a1', targetId: 'p-opp' },
      { attackerId: 'a2', targetId: 'b1' },
    ])
  })

  it('splits first strike and regular damage between the two damage steps', () => {
    const groups = [{ attackers: { fs: firstStriker, ds: doubleStriker, plain: {} }, blockers: [], defenderId: 'p-opp' }]
    const first = planDamageStrikes(view('DECLARE_BLOCKERS', groups), view('FIRST_COMBAT_DAMAGE', groups))
    expect(first.map((p) => p.attackerId)).toEqual(['fs', 'ds'])
    const regular = planDamageStrikes(view('FIRST_COMBAT_DAMAGE', groups), view('COMBAT_DAMAGE', groups))
    expect(regular.map((p) => p.attackerId)).toEqual(['ds', 'plain'])
  })

  it('strikes when the server jumps from blockers straight past combat damage', () => {
    const groups = [{ attackers: { fs: firstStriker, plain: {} }, blockers: [], defenderId: 'p-opp' }]
    const prev = view('DECLARE_BLOCKERS', groups)
    expect(planDamageStrikes(prev, view('END_COMBAT', groups)).map((p) => p.attackerId)).toEqual(['fs', 'plain'])
    expect(planDamageStrikes(prev, makeGameView({ step: 'POSTCOMBAT_MAIN', combat: [] })).map((p) => p.attackerId)).toEqual(['fs', 'plain'])
    expect(planDamageStrikes(prev, makeGameView({ step: 'UPKEEP', turn: 2, combat: [] }))).toHaveLength(2)
  })

  it('does not strike once combat has already been resolved', () => {
    const groups = [{ attackers: ['a1'], defenderId: 'p-opp' }]
    expect(planDamageStrikes(view('COMBAT_DAMAGE', groups), view('COMBAT_DAMAGE', groups))).toEqual([])
    expect(planDamageStrikes(view('COMBAT_DAMAGE', groups), view('END_COMBAT', groups))).toEqual([])
    expect(planDamageStrikes(view('END_COMBAT', groups), makeGameView({ step: 'POSTCOMBAT_MAIN' }))).toEqual([])
  })
})

describe('strikeVector', () => {
  it('stops short of the target centre along the attack line', () => {
    const { dx, dy } = strikeVector(rect(100, 500), rect(100, 100))
    expect(dx).toBe(0)
    expect(dy).toBeLessThan(0)
    expect(Math.abs(dy)).toBeLessThan(400)
    expect(Math.abs(dy)).toBeGreaterThan(400 * 0.45)
  })

  it('does not move when both rects share a centre', () => {
    expect(strikeVector(rect(10, 10), rect(10, 10))).toEqual({ dx: 0, dy: 0 })
  })
})

describe('strike sequence', () => {
  let animate: ReturnType<typeof vi.fn>

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
    animate = vi.fn(() => ({ finished: new Promise<void>(() => {}) } as unknown as Animation))
    ;(HTMLElement.prototype as unknown as { animate: typeof animate }).animate = animate
    document.body.innerHTML = `
      <div class="opponent-zone" data-player-id="p-opp" data-player-name="Opp">
        <span data-player-anchor></span>
        <div class="creatures-band"><div class="card-slot" data-card-id="b1"></div></div>
        <div class="graveyard-stack"></div>
      </div>
      <div class="player-zone" data-player-id="p-me" data-player-name="Me">
        <div class="creatures-band">
          <div class="card-slot" data-card-id="a1"></div>
          <div class="card-slot" data-card-id="a2"></div>
        </div>
        <div class="graveyard-stack"></div>
      </div>`
    spy('[data-player-anchor]', rect(400, 40, 60, 60))
    spy('[data-card-id="b1"]', rect(420, 200))
    spy('[data-card-id="a1"]', rect(300, 600))
    spy('[data-card-id="a2"]', rect(420, 600))
    spy('.opponent-zone .graveyard-stack', rect(900, 40))
    spy('.player-zone .graveyard-stack', rect(900, 600))
  })

  afterEach(() => {
    delete (HTMLElement.prototype as unknown as { animate?: unknown }).animate
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
    vi.useRealTimers()
    document.body.innerHTML = ''
  })

  const hits = () => (soundManager.play as unknown as ReturnType<typeof vi.fn>).mock.calls.filter(([k]) => k === 'combat_hit').length

  it('resolves a player target to its avatar anchor', () => {
    expect(strikeTargetElement('p-opp')).toBe(document.querySelector('[data-player-anchor]'))
  })

  it('strikes one attacker after another, each landing with the hit sound and sparks', () => {
    const schedule = playDamageStrikes([
      { attackerId: 'a1', targetId: 'p-opp' },
      { attackerId: 'a2', targetId: 'p-opp' },
    ], [])
    expect(schedule.holdMs).toBe(240 + 560)
    expect(schedule.impactAt.get('p-opp')).toBe(280)
    expect(schedule.impactAt.get('a2')).toBe(520)

    vi.advanceTimersByTime(0)
    expect(animate).toHaveBeenCalledTimes(1)
    expect((document.querySelector('[data-card-id="a1"]') as HTMLElement).style.visibility).toBe('hidden')
    vi.advanceTimersByTime(290)
    expect(hits()).toBe(1)
    expect(animate).toHaveBeenCalledTimes(2)
    expect(getImpacts().filter((f) => f.kind === 'sparks')).toHaveLength(1)
    vi.advanceTimersByTime(2000)
    expect(hits()).toBe(2)
    expect(document.querySelectorAll('.combat-strike-ghost')).toHaveLength(0)
    expect((document.querySelector('[data-card-id="a1"]') as HTMLElement).style.visibility).toBe('')
  })

  it('holds each combatant until its own strike lands, before the board re-renders', () => {
    const groups = [
      { attackers: ['a1'], blockers: [], defenderId: 'p-opp' },
      { attackers: ['a2'], blockers: ['b1'], defenderId: 'p-opp' },
    ]
    primeCombatHolds(view('DECLARE_BLOCKERS', groups), view('COMBAT_DAMAGE', groups))
    expect(combatImpactRemaining('p-opp')).toBe(280)
    expect(combatImpactRemaining('b1')).toBe(520)
    expect(combatImpactRemaining('a2')).toBe(520)
    vi.advanceTimersByTime(300)
    expect(combatImpactRemaining('p-opp')).toBe(0)
    expect(combatImpactRemaining('b1')).toBe(220)
    clearCombatSnapshots()
    expect(combatImpactRemaining('b1')).toBe(0)
  })

  it('declaring attackers alone does not animate or sound a hit', () => {
    const me = makePlayer({ playerId: 'p-me', name: 'Me', controlled: true })
    const prev = view('DECLARE_ATTACKERS', [], { players: [me] })
    const next = view('DECLARE_ATTACKERS', [{ attackers: ['a1'], blockers: [], defenderId: 'p-opp' }], { players: [me] })
    detectAndAnimateTransitions(prev, next)
    vi.advanceTimersByTime(2000)
    expect(animate).not.toHaveBeenCalled()
    expect(hits()).toBe(0)
  })

  it('keeps a blocker that dies on screen until the strikes end, then burns it', () => {
    const bear = makePermanent({ id: 'b1', name: 'Grizzly Bears', cardTypes: ['CREATURE'] })
    const goblin = makePermanent({ id: 'a1', name: 'Goblin', cardTypes: ['CREATURE'] })
    const groups = [{ attackers: ['a1'], blockers: ['b1'], defenderId: 'p-opp' }]
    const opp = (battlefield: Record<string, typeof bear>, graveyard: Record<string, typeof bear> = {}) =>
      makePlayer({ playerId: 'p-opp', name: 'Opp', battlefield, graveyard })
    const me = makePlayer({ playerId: 'p-me', name: 'Me', battlefield: { a1: goblin } })
    const prev = view('DECLARE_BLOCKERS', groups, { players: [opp({ b1: bear }), me] })
    const next = view('COMBAT_DAMAGE', [{ attackers: ['a1'], blockers: [], isBlocked: true, defenderId: 'p-opp' }], {
      players: [opp({}, { b1: bear }), me],
    })

    snapshotCombatants(prev)
    recordCardPosition('b1', rect(420, 200), 'opponent-zone')
    document.querySelector('[data-card-id="b1"]')!.remove()
    detectAndAnimateTransitions(prev, next)

    expect(document.querySelectorAll('.combat-strike-ghost')).toHaveLength(1)
    expect(getImpacts().filter((f) => f.kind === 'destroy')).toHaveLength(0)
    vi.advanceTimersByTime(290)
    expect(hits()).toBe(1)
    expect(getImpacts().filter((f) => f.kind === 'destroy')).toHaveLength(0)
    vi.advanceTimersByTime(300)
    expect(getImpacts().map((f) => f.kind)).toContain('destroy')
    vi.advanceTimersByTime(100)
    expect(document.querySelectorAll('.combat-strike-ghost')).toHaveLength(0)
  })

  it('still lands the hit on the target when the attacker is not on screen', () => {
    playDamageStrikes([{ attackerId: 'missing', targetId: 'p-opp' }], [])
    vi.advanceTimersByTime(0)
    expect(hits()).toBe(1)
    expect(document.querySelector('[data-player-anchor]')?.classList.contains('took-damage')).toBe(true)
  })
})
