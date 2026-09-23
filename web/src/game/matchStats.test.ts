import { beforeEach, describe, expect, it } from 'vitest'
import { getMatchStats, keyCardOf, recordMatchStats, resetMatchStats } from './matchStats'
import { makeCard, makeGameView, makePermanent, makePlayer } from '../__fixtures__/gameViews'

const goblin = makePermanent({ id: 'g1', name: 'Goblin Guide', power: '2', toughness: '2', cardTypes: ['CREATURE'], controllerId: 'me' })
const giant = makePermanent({ id: 'g2', name: 'Hill Giant', power: '3', toughness: '3', cardTypes: ['CREATURE'], controllerId: 'me' })
const elf = makePermanent({ id: 'e1', name: 'Llanowar Elves', cardTypes: ['CREATURE'] })

function view(opts: { myLife?: number; opLife?: number; turn?: number; combat?: string[]; stack?: Record<string, ReturnType<typeof makeCard>>; opBf?: Record<string, typeof elf>; opGrave?: Record<string, typeof elf> }) {
  return makeGameView({
    turn: opts.turn ?? 1,
    players: [
      makePlayer({ playerId: 'me', name: 'Me', controlled: true, life: opts.myLife ?? 20, battlefield: { g1: goblin, g2: giant } }),
      makePlayer({ playerId: 'op', name: 'Op', life: opts.opLife ?? 20, battlefield: opts.opBf ?? { e1: elf }, graveyard: opts.opGrave ?? {} }),
    ],
    combat: (opts.combat ? [{ attackers: opts.combat, blockers: [], defenders: ['op'] }] : []) as never,
    stack: opts.stack ?? {},
  })
}

describe('matchStats', () => {
  beforeEach(() => resetMatchStats(null))

  it('tracks turns, life swings, spells, attacks and kills for the controlled player', () => {
    const g = 'game-1'
    let prev = view({})
    recordMatchStats(null, prev, g)
    const steps = [
      view({ turn: 2, stack: { s1: makeCard({ id: 's1', name: 'Bolt', manaValue: 1, controllerId: 'me' }) } }),
      view({ turn: 2, opLife: 17 }),
      view({ turn: 3, opLife: 17, combat: ['g1', 'g2'] }),
      view({ turn: 3, opLife: 12, myLife: 18 }),
      view({ turn: 5, opLife: 12, myLife: 18, combat: ['g1'] }),
      view({ turn: 5, opLife: 12, myLife: 18, opBf: {}, opGrave: { e1: elf } }),
    ]
    for (const next of steps) {
      recordMatchStats(prev, next, g)
      prev = next
    }
    const s = getMatchStats()
    expect(s).toMatchObject({ gameId: g, turns: 5, lifeTaken: 8, lifeLost: 2, spellsCast: 1, creaturesKilled: 1 })
    expect(s.attacks).toEqual({ g1: 2, g2: 1 })
    expect(keyCardOf(s)?.name).toBe('Goblin Guide')
  })

  it('ignores opponent spells and resets on a new game', () => {
    const prev = view({})
    recordMatchStats(null, prev, 'a')
    recordMatchStats(prev, view({ stack: { s9: makeCard({ id: 's9', name: 'Opt', manaValue: 1, controllerId: 'op' }) } }), 'a')
    expect(getMatchStats().spellsCast).toBe(0)
    recordMatchStats(null, view({ turn: 1 }), 'b')
    expect(getMatchStats()).toMatchObject({ gameId: 'b', turns: 1, lifeTaken: 0 })
  })

  it('falls back to the biggest spell as key card when nothing attacked', () => {
    const prev = view({})
    recordMatchStats(null, prev, 'c')
    recordMatchStats(prev, view({ stack: { s1: makeCard({ id: 's1', name: 'Wrath', manaValue: 4, controllerId: 'me' }) } }), 'c')
    expect(keyCardOf(getMatchStats())?.name).toBe('Wrath')
  })
})
