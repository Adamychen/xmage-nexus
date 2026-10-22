import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cardKeywordIds, LIFELINK_TRAVEL_MS, planKeywordStrikes, playKeywordStrikes, survivesLethal, TRAMPLE_TRAVEL_MS } from './keywordStrikeFx'
import { clearCombatSnapshots, combatantRect, playDamageStrikes, planDamageStrikes, snapshotCombatants } from './combatStrikes'
import { detectAndAnimateTransitions } from './gameTransitionEngine'
import { soundManager } from '../audio/soundManager'
import { clearImpacts, getImpacts } from './impactFx'
import { clearFlights } from './flightManager'
import { clearCardPositionRegistry } from './cardPositionRegistry'
import { damageNumbersFor } from './DamageNumber'
import { makeCard, makeGameView, makePermanent, makePlayer } from '../__fixtures__/gameViews'
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
    const trampler = makePermanent({ id: 'a1', name: 'Charger', rules: ['Trample'], power: '5', toughness: '5' })
    const bear = makePermanent({ id: 'b1', name: 'Grizzly Bears', power: '2', toughness: '2' })
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

  it('does not credit trample when the blocker absorbs all the damage and another attacker hurt the defender', () => {
    const trampler = makePermanent({ id: 'a1', name: 'Charger', rules: ['Trample'], power: '2', toughness: '2' })
    const runner = makePermanent({ id: 'a2', name: 'Runner', power: '2', toughness: '2' })
    const bear = makePermanent({ id: 'b1', name: 'Grizzly Bears', power: '2', toughness: '2' })
    const groups: Array<Record<string, unknown>> = [
      { attackers: ['a1'], blockers: ['b1'], defenderId: 'p-opp' },
      { attackers: ['a2'], blockers: [], defenderId: 'p-opp' },
    ]
    const board = (life: number) => [
      makePlayer({ playerId: 'p-opp', name: 'Opp', life, battlefield: { b1: bear } }),
      makePlayer({ playerId: 'p-me', name: 'Me', battlefield: { a1: trampler, a2: runner } }),
    ]
    const prev = game(board(20), { combat: groups as GameView['combat'] })
    const next = game(board(18), { combat: groups as GameView['combat'] })
    expect(planKeywordStrikes(prev, next, [{ attackerId: 'a1', targetId: 'b1' }])).toEqual([])
  })

  it('reports trample damage to the defender when a blocked trampler has no blockers left', () => {
    const trampler = makePermanent({ id: 'a1', name: 'Charger', rules: ['Trample'], power: '3', toughness: '3' })
    const groups: Array<Record<string, unknown>> = [{ attackers: ['a1'], blockers: [], isBlocked: true, defenderId: 'p-opp' }]
    const board = (life: number) => [
      makePlayer({ playerId: 'p-opp', name: 'Opp', life }),
      makePlayer({ playerId: 'p-me', name: 'Me', battlefield: { a1: trampler } }),
    ]
    const prev = game(board(20), { combat: groups as GameView['combat'] })
    const hurt = game(board(17), { combat: groups as GameView['combat'] })
    const untouched = game(board(20), { combat: groups as GameView['combat'] })
    expect(planKeywordStrikes(prev, hurt, [{ attackerId: 'a1', targetId: 'p-opp' }])).toEqual([
      { attackerId: 'a1', targetId: 'p-opp', firstStrike: false, deathtouchKill: false, lifelinkTo: null, trampleTo: 'p-opp' },
    ])
    expect(planKeywordStrikes(prev, untouched, [{ attackerId: 'a1', targetId: 'p-opp' }])).toEqual([])
  })

  it('reads deathtouch as a kill only when the blocker reached a graveyard', () => {
    const viper = makePermanent({ id: 'a1', name: 'Viper', rules: ['Deathtouch'] })
    const bear = makePermanent({ id: 'b1', name: 'Grizzly Bears' })
    const me = makePlayer({ playerId: 'p-me', name: 'Me', battlefield: { a1: viper } })
    const plans = [{ attackerId: 'a1', targetId: 'b1' }]
    const killed = (deathtouchKill: boolean) => [
      { attackerId: 'a1', targetId: 'b1', firstStrike: false, deathtouchKill, lifelinkTo: null, trampleTo: null },
    ]
    const prev = game([makePlayer({ playerId: 'p-opp', name: 'Opp', battlefield: { b1: bear } }), me])
    const bounced = game([makePlayer({ playerId: 'p-opp', name: 'Opp' }), me], { myHand: { b1: makeCard({ id: 'b1', name: 'Grizzly Bears' }) } })
    expect(planKeywordStrikes(prev, bounced, plans)).toEqual([])
    const buried = game([makePlayer({ playerId: 'p-opp', name: 'Opp', graveyard: { b1: bear } }), me])
    expect(planKeywordStrikes(prev, buried, plans)).toEqual(killed(true))
    const token = makePermanent({ id: 'b1', name: 'Goblin', isToken: true })
    const tokenPrev = game([makePlayer({ playerId: 'p-opp', name: 'Opp', battlefield: { b1: token } }), me])
    const tokenGone = game([makePlayer({ playerId: 'p-opp', name: 'Opp' }), me])
    expect(planKeywordStrikes(tokenPrev, tokenGone, plans)).toEqual(killed(true))
  })

  it('counts deathtouch as one lethal damage per blocker', () => {
    const viper = makePermanent({ id: 'a1', name: 'Viper', rules: ['Trample', 'Deathtouch'], power: '2', toughness: '2' })
    const juggernaut = makePermanent({ id: 'b1', name: 'Juggernaut', power: '5', toughness: '5' })
    const groups: Array<Record<string, unknown>> = [{ attackers: ['a1'], blockers: ['b1'], defenderId: 'p-opp' }]
    const prev = game([
      makePlayer({ playerId: 'p-opp', name: 'Opp', life: 20, battlefield: { b1: juggernaut } }),
      makePlayer({ playerId: 'p-me', name: 'Me', battlefield: { a1: viper } }),
    ], { combat: groups as GameView['combat'] })
    const next = game([
      makePlayer({ playerId: 'p-opp', name: 'Opp', life: 19, graveyard: { b1: juggernaut } }),
      makePlayer({ playerId: 'p-me', name: 'Me', battlefield: { a1: viper } }),
    ], { combat: groups as GameView['combat'] })
    expect(planKeywordStrikes(prev, next, [{ attackerId: 'a1', targetId: 'b1' }])).toEqual([
      { attackerId: 'a1', targetId: 'b1', firstStrike: false, deathtouchKill: true, lifelinkTo: null, trampleTo: 'p-opp' },
    ])
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

  describe('blockers', () => {
    const blockedBy = (blocker: ReturnType<typeof makePermanent>, attacker = makePermanent({ id: 'a1', name: 'Grizzly Bears' })) => {
      const groups: Array<Record<string, unknown>> = [{ attackers: ['a1'], blockers: ['b1'], defenderId: 'p-opp' }]
      const board = (step: string, attackerAlive: boolean) => makeGameView({
        phase: 'COMBAT',
        step,
        combat: groups as GameView['combat'],
        players: [
          makePlayer({ playerId: 'p-opp', name: 'Opp', battlefield: { b1: blocker } }),
          makePlayer({
            playerId: 'p-me',
            name: 'Me',
            battlefield: attackerAlive ? { a1: attacker } : {},
            graveyard: attackerAlive ? {} : { a1: attacker },
          }),
        ],
      })
      return { prev: board('DECLARE_BLOCKERS', true), next: board('COMBAT_DAMAGE', false) }
    }
    const blockerLifeGain = (next: GameView) => {
      return makeGameView({ ...next, players: next.players!.map((p) => (p.playerId === 'p-opp' ? { ...p, life: 22 } : p)) })
    }

    it('gives a deathtouch blocker a kill moment on the attacker it blocks', () => {
      const viper = makePermanent({ id: 'b1', name: 'Viper', rules: ['Deathtouch'] })
      const { prev, next } = blockedBy(viper)
      expect(planKeywordStrikes(prev, next, planDamageStrikes(prev, next))).toEqual([
        { attackerId: 'b1', targetId: 'a1', firstStrike: false, deathtouchKill: true, lifelinkTo: null, trampleTo: null, fromBlocker: true },
      ])
    })

    it('gives a first-strike blocker its strike moment on the attacker it blocks', () => {
      const knight = makePermanent({ id: 'b1', name: 'Knight', ...firstStriker })
      const groups: Array<Record<string, unknown>> = [{ attackers: ['a1'], blockers: ['b1'], defenderId: 'p-opp' }]
      const board = makeGameView({
        phase: 'COMBAT',
        step: 'DECLARE_BLOCKERS',
        combat: groups as GameView['combat'],
        players: [
          makePlayer({ playerId: 'p-opp', name: 'Opp', battlefield: { b1: knight } }),
          makePlayer({ playerId: 'p-me', name: 'Me', battlefield: { a1: makePermanent({ id: 'a1', name: 'Grizzly Bears' }) } }),
        ],
      })
      const firstStep = makeGameView({ ...board, step: 'FIRST_COMBAT_DAMAGE' })
      expect(planKeywordStrikes(board, firstStep, planDamageStrikes(board, firstStep))).toEqual([
        { attackerId: 'b1', targetId: 'a1', firstStrike: true, deathtouchKill: false, lifelinkTo: null, trampleTo: null, fromBlocker: true },
      ])
    })

    it('credits a lifelinking blocker to its controller only when that life went up', () => {
      const leech = makePermanent({ id: 'b1', name: 'Leech', rules: ['Lifelink'] })
      const { prev, next } = blockedBy(leech)
      const gained = blockerLifeGain(next)
      expect(planKeywordStrikes(prev, gained, planDamageStrikes(prev, gained))).toEqual([
        { attackerId: 'b1', targetId: 'a1', firstStrike: false, deathtouchKill: false, lifelinkTo: 'p-opp', trampleTo: null, fromBlocker: true },
      ])
      expect(planKeywordStrikes(prev, next, planDamageStrikes(prev, next))).toEqual([])
    })

    it('gives a plain blocker no moment', () => {
      const { prev, next } = blockedBy(makePermanent({ id: 'b1', name: 'Grizzly Bears' }))
      expect(planKeywordStrikes(prev, next, planDamageStrikes(prev, next))).toEqual([])
    })
  })

  it('gives each deathtouch kill of a multi-blocked attacker its own skull', () => {
    const viper = makePermanent({ id: 'a1', name: 'Viper', rules: ['Deathtouch'], power: '3', toughness: '3' })
    const bear = makePermanent({ id: 'b1', name: 'Grizzly Bears', power: '2', toughness: '2' })
    const bear2 = makePermanent({ id: 'b2', name: 'Grizzly Bears', power: '2', toughness: '2' })
    const groups: Array<Record<string, unknown>> = [{ attackers: ['a1'], blockers: ['b1', 'b2'], defenderId: 'p-opp' }]
    const board = (step: string, deadBlockers: string[]) => makeGameView({
      phase: 'COMBAT',
      step,
      combat: groups as GameView['combat'],
      players: [
        makePlayer({
          playerId: 'p-opp',
          name: 'Opp',
          battlefield: { ...(deadBlockers.includes('b1') ? {} : { b1: bear }), ...(deadBlockers.includes('b2') ? {} : { b2: bear2 }) },
          graveyard: { ...(deadBlockers.includes('b1') ? { b1: bear } : {}), ...(deadBlockers.includes('b2') ? { b2: bear2 } : {}) },
        }),
        makePlayer({ playerId: 'p-me', name: 'Me', battlefield: { a1: viper } }),
      ],
    })
    const prev = board('DECLARE_BLOCKERS', [])
    const both = board('COMBAT_DAMAGE', ['b1', 'b2'])
    const kill = (targetId: string) => ({ attackerId: 'a1', targetId, firstStrike: false, deathtouchKill: true, lifelinkTo: null, trampleTo: null })
    expect(planKeywordStrikes(prev, both, planDamageStrikes(prev, both))).toEqual([kill('b1'), kill('b2')])
    const oneLeft = board('COMBAT_DAMAGE', ['b1'])
    expect(planKeywordStrikes(prev, oneLeft, planDamageStrikes(prev, oneLeft))).toEqual([kill('b1')])
  })

  describe('trample over a permanent', () => {
    const groups: Array<Record<string, unknown>> = [{ attackers: ['a1'], blockers: ['b1'], defenderId: 'pw' }]
    const attacker = makePermanent({ id: 'a1', name: 'Charger', rules: ['Trample'], power: '5', toughness: '5' })
    const bear = makePermanent({ id: 'b1', name: 'Grizzly Bears', power: '2', toughness: '2' })
    const walker = (loyalty: string) => makePermanent({ id: 'pw', name: 'Ember Oracle', cardTypes: ['Planeswalker'], loyalty })
    const battle = (defense: string) => makePermanent({ id: 'pw', name: 'Siege Keep', cardTypes: ['Battle'], defense })
    const board = (step: string, defender: ReturnType<typeof makePermanent> | null) => makeGameView({
      phase: 'COMBAT',
      step,
      combat: groups as GameView['combat'],
      players: [
        makePlayer({ playerId: 'p-opp', name: 'Opp', battlefield: { b1: bear, ...(defender ? { pw: defender } : {}) } }),
        makePlayer({ playerId: 'p-me', name: 'Me', battlefield: { a1: attacker } }),
      ],
    })

    it('sends the overflow to a planeswalker whose loyalty went down', () => {
      const prev = board('DECLARE_BLOCKERS', walker('5'))
      const next = board('COMBAT_DAMAGE', walker('1'))
      expect(planKeywordStrikes(prev, next, planDamageStrikes(prev, next))).toEqual([
        { attackerId: 'a1', targetId: 'b1', firstStrike: false, deathtouchKill: false, lifelinkTo: null, trampleTo: 'pw' },
      ])
    })

    it('sends the overflow to a battle whose defense went down', () => {
      const prev = board('DECLARE_BLOCKERS', battle('5'))
      const next = board('COMBAT_DAMAGE', battle('1'))
      expect(planKeywordStrikes(prev, next, planDamageStrikes(prev, next))).toEqual([
        { attackerId: 'a1', targetId: 'b1', firstStrike: false, deathtouchKill: false, lifelinkTo: null, trampleTo: 'pw' },
      ])
    })

    it('counts a planeswalker that the overflow killed as down to zero loyalty', () => {
      const prev = board('DECLARE_BLOCKERS', walker('3'))
      const next = board('COMBAT_DAMAGE', null)
      expect(planKeywordStrikes(prev, next, planDamageStrikes(prev, next))).toEqual([
        { attackerId: 'a1', targetId: 'b1', firstStrike: false, deathtouchKill: false, lifelinkTo: null, trampleTo: 'pw' },
      ])
    })

    it('does not send a wave when the permanent kept its loyalty', () => {
      const prev = board('DECLARE_BLOCKERS', walker('5'))
      const next = board('COMBAT_DAMAGE', walker('5'))
      expect(planKeywordStrikes(prev, next, planDamageStrikes(prev, next))).toEqual([])
    })
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

  it('records no life gain when the controller has no element to draw the lifelink mote on', () => {
    document.querySelector('.player-zone[data-player-id="p-me"]')?.remove()
    const hits = playKeywordStrikes([strike({ lifelinkTo: 'p-me' })], { holdMs: 0, impactAt: new Map([['a1', 100]]) })
    expect(hits.lifeGains.has('p-me')).toBe(false)
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

  it('lands a blocker strike on the blocked attacker\'s impact', () => {
    const schedule = { holdMs: 0, impactAt: new Map([['a1', 100]]) }
    playKeywordStrikes([strike({ attackerId: 'b1', targetId: 'a1', fromBlocker: true, deathtouchKill: true })], schedule)
    vi.advanceTimersByTime(99)
    expect(getImpacts()).toHaveLength(0)
    vi.advanceTimersByTime(1)
    expect(getImpacts().map((f) => f.kind)).toEqual(['deathtouch'])
  })

  it('lands a blocker strike at once when its attacker does not strike in this step', () => {
    playKeywordStrikes([strike({ attackerId: 'b1', targetId: 'a1', fromBlocker: true, firstStrike: true })], { holdMs: 0, impactAt: new Map() })
    vi.advanceTimersByTime(1)
    expect(getImpacts().map((f) => f.kind)).toEqual(['first-strike'])
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
    const goblin = makePermanent({ id: 'a1', name: 'Charger', rules: ['Trample'], power: '5', toughness: '5' })
    const bear = makePermanent({ id: 'b1', name: 'Grizzly Bears', power: '2', toughness: '2' })
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

  it('shows the deathtouch skull on the attacker that a deathtouch blocker kills, when the attacker\'s strike lands', () => {
    const viper = makePermanent({ id: 'b1', name: 'Viper', rules: ['Deathtouch'] })
    const bear = makePermanent({ id: 'a1', name: 'Grizzly Bears' })
    const groups: Array<Record<string, unknown>> = [{ attackers: ['a1'], blockers: ['b1'], defenderId: 'p-opp' }]
    const declare = makeGameView({
      phase: 'COMBAT',
      step: 'DECLARE_BLOCKERS',
      combat: groups as GameView['combat'],
      players: [makePlayer({ playerId: 'p-opp', name: 'Opp', battlefield: { b1: viper } }), makePlayer({ playerId: 'p-me', name: 'Me', battlefield: { a1: bear } })],
    })
    const damage = makeGameView({
      ...declare,
      step: 'COMBAT_DAMAGE',
      players: [makePlayer({ playerId: 'p-opp', name: 'Opp', battlefield: { b1: viper } }), makePlayer({ playerId: 'p-me', name: 'Me', graveyard: { a1: bear } })],
    })
    detectAndAnimateTransitions(declare, damage)
    vi.advanceTimersByTime(STRIKE_LANDS_MS - 1)
    expect(getImpacts().map((f) => f.kind)).not.toContain('deathtouch')
    vi.advanceTimersByTime(1)
    expect(getImpacts().map((f) => f.kind)).toContain('deathtouch')
  })

  it('sends a trample wave to the planeswalker the overflow hit, landing on its card', () => {
    const charger = makePermanent({ id: 'a1', name: 'Charger', rules: ['Trample'], power: '5', toughness: '5' })
    const bear = makePermanent({ id: 'b1', name: 'Grizzly Bears', power: '2', toughness: '2' })
    const oracle = makePermanent({ id: 'pw', name: 'Ember Oracle', cardTypes: ['Planeswalker'], loyalty: '5' })
    const groups: Array<Record<string, unknown>> = [{ attackers: ['a1'], blockers: ['b1'], defenderId: 'pw' }]
    const board = (step: string, loyalty: string) => makeGameView({
      phase: 'COMBAT',
      step,
      combat: groups as GameView['combat'],
      players: [
        makePlayer({ playerId: 'p-opp', name: 'Opp', battlefield: { b1: bear, pw: { ...oracle, loyalty } } }),
        makePlayer({ playerId: 'p-me', name: 'Me', battlefield: { a1: charger } }),
      ],
    })
    const prev = board('DECLARE_BLOCKERS', '5')
    const next = board('COMBAT_DAMAGE', '1')
    const walkerSlot = document.createElement('div')
    walkerSlot.className = 'card-slot'
    walkerSlot.dataset.cardId = 'pw'
    document.querySelector('.opponent-zone .creatures-band')!.appendChild(walkerSlot)
    vi.spyOn(walkerSlot, 'getBoundingClientRect').mockReturnValue(rect(200, 120))

    detectAndAnimateTransitions(prev, next)
    vi.advanceTimersByTime(STRIKE_LANDS_MS)
    const wave = getImpacts().find((f) => f.kind === 'trample')
    expect(wave?.toX).toBe(240)
    expect(wave?.toY).toBe(176)
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

  it('lands the keyword moment of each hit of a double striker crossing both damage steps', () => {
    const blade = makePermanent({ id: 'a1', name: 'Swordsman', rules: ['Double strike'] })
    const groups: Array<Record<string, unknown>> = [{ attackers: ['a1'], blockers: [], defenderId: 'p-opp' }]
    const players = [
      makePlayer({ playerId: 'p-opp', name: 'Opp', life: 20 }),
      makePlayer({ playerId: 'p-me', name: 'Me', battlefield: { a1: blade } }),
    ]
    const prev = game(players, { combat: groups as GameView['combat'] })
    const next = game(players, { step: 'COMBAT_DAMAGE', combat: groups as GameView['combat'] })
    detectAndAnimateTransitions(prev, next)
    vi.advanceTimersByTime(300)
    expect(getImpacts().filter((f) => f.kind === 'first-strike')).toHaveLength(1)
    vi.advanceTimersByTime(240)
    expect(getImpacts().filter((f) => f.kind === 'first-strike')).toHaveLength(2)
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
