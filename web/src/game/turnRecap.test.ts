import { beforeEach, describe, expect, it } from 'vitest'
import { observeTurnRecap, resetTurnRecap, type TurnRecap } from './turnRecap'
import { makeCard, makeGameView, makePermanent, makePlayer } from '../__fixtures__/gameViews'
import type { CardView, GameView, PermanentView } from '../net/types'

const bear = makePermanent({ id: 'b1', name: 'Grizzly Bears', power: '2', toughness: '2', cardTypes: ['CREATURE'], controllerId: 'op' })
const knight = makePermanent({ id: 'k1', name: 'Knight', power: '2', toughness: '2', cardTypes: ['CREATURE'], controllerId: 'me' })
const wall = makePermanent({ id: 'w1', name: 'Wall', power: '0', toughness: '4', cardTypes: ['CREATURE'], controllerId: 'me' })
const forest = makePermanent({ id: 'f1', name: 'Forest', cardTypes: ['LAND'], controllerId: 'op' })
const elves = makePermanent({ id: 'e1', name: 'Llanowar Elves', power: '1', toughness: '1', cardTypes: ['CREATURE'], controllerId: 'op' })

interface ViewOpts {
  active: 'me' | 'op'
  turn: number
  myLife?: number
  myBf?: Record<string, PermanentView>
  opBf?: Record<string, PermanentView>
  myGrave?: Record<string, CardView>
  myExile?: Record<string, CardView>
  stack?: Record<string, CardView>
  combat?: string[]
}

function view(o: ViewOpts): GameView {
  return makeGameView({
    turn: o.turn,
    activePlayerId: o.active,
    players: [
      makePlayer({ playerId: 'me', name: 'Me', controlled: true, isActive: o.active === 'me', life: o.myLife ?? 20, battlefield: o.myBf ?? { k1: knight, w1: wall }, graveyard: o.myGrave ?? {}, exile: o.myExile ?? {} }),
      makePlayer({ playerId: 'op', name: 'Ana', isActive: o.active === 'op', life: 20, battlefield: o.opBf ?? { b1: bear } }),
    ],
    combat: (o.combat ? [{ attackers: o.combat, blockers: [], defenders: ['me'] }] : []) as never,
    stack: o.stack ?? {},
  })
}

function run(views: GameView[], gameId = 'g'): TurnRecap | null {
  let prev: GameView | null = null
  let recap: TurnRecap | null = null
  for (const next of views) {
    recap = observeTurnRecap(prev, next, gameId) ?? recap
    prev = next
  }
  return recap
}

describe('turnRecap', () => {
  beforeEach(() => resetTurnRecap(null))

  it('summarises spells, lands, attacks, life loss and deaths of the opponent turn', () => {
    const bigKnight = { ...knight, power: '3', toughness: '3', counters: [{ name: 'P1P1', count: 1 }] }
    const recap = run([
      view({ active: 'me', turn: 1 }),
      view({ active: 'op', turn: 2 }),
      view({ active: 'op', turn: 2, opBf: { b1: bear, f1: forest } }),
      view({ active: 'op', turn: 2, opBf: { b1: bear, f1: forest }, stack: { s1: makeCard({ id: 's1', name: 'Llanowar Elves', controllerId: 'op' }) } }),
      view({ active: 'op', turn: 2, opBf: { b1: bear, f1: forest, e1: elves } }),
      view({ active: 'op', turn: 2, opBf: { b1: bear, f1: forest, e1: elves }, combat: ['b1'] }),
      view({ active: 'op', turn: 2, opBf: { b1: bear, f1: forest, e1: elves }, myLife: 18, myBf: { k1: knight }, myGrave: { w1: wall } }),
      view({ active: 'me', turn: 3, opBf: { b1: bear, f1: forest, e1: elves }, myLife: 18, myBf: { k1: bigKnight }, myGrave: { w1: wall } }),
    ])
    expect(recap).not.toBeNull()
    expect(recap!.turnsOf).toEqual(['Ana'])
    expect(recap!.actors).toEqual([{ playerId: 'op', name: 'Ana', played: ['Forest', 'Llanowar Elves'], attackedWith: ['Grizzly Bears'] }])
    expect(recap!.life).toEqual([{ playerId: 'me', name: 'Me', mine: true, delta: -2 }])
    expect(recap!.departures.map((d) => [d.id, d.dest, d.mine])).toEqual([['w1', 'graveyard', true]])
    expect(recap!.marks).toEqual({ f1: 'new', e1: 'new', k1: 'changed' })
  })

  it('only emits once my turn starts and not for my own turns', () => {
    const views = [view({ active: 'me', turn: 1 }), view({ active: 'me', turn: 1, myLife: 19 })]
    expect(run(views)).toBeNull()
    let prev: GameView | null = null
    const results: Array<TurnRecap | null> = []
    for (const next of [view({ active: 'op', turn: 2 }), view({ active: 'op', turn: 2, myLife: 17 }), view({ active: 'me', turn: 3, myLife: 17 }), view({ active: 'me', turn: 3, myLife: 16 })]) {
      results.push(observeTurnRecap(prev, next, 'x'))
      prev = next
    }
    expect(results.map((r) => r != null)).toEqual([false, false, true, false])
  })

  it('reports exile, bounce and a token that came and went during the window', () => {
    const token = makePermanent({ id: 't1', name: 'Goblin', cardTypes: ['CREATURE'], isToken: true, controllerId: 'op' })
    const recap = run([
      view({ active: 'op', turn: 2 }),
      view({ active: 'op', turn: 2, opBf: { b1: bear, t1: token } }),
      view({ active: 'op', turn: 2, opBf: { b1: bear }, myBf: { w1: wall }, myExile: { k1: knight } }),
      { ...view({ active: 'op', turn: 2, opBf: { b1: bear }, myBf: {}, myExile: { k1: knight } }), myHand: { w1: wall } },
      view({ active: 'me', turn: 3, opBf: { b1: bear }, myBf: {}, myExile: { k1: knight } }),
    ])
    expect(recap!.departures.map((d) => [d.id, d.dest])).toEqual([
      ['k1', 'exile'],
      ['t1', 'graveyard'],
      ['w1', 'hand'],
    ])
  })

  it('returns null when nothing happened and ignores spectators', () => {
    expect(run([view({ active: 'op', turn: 2 }), view({ active: 'me', turn: 3 })])).toBeNull()
    const spectator = makeGameView({ turn: 2, activePlayerId: 'op', players: [makePlayer({ playerId: 'op', name: 'Ana' })] })
    expect(observeTurnRecap(null, spectator, 's')).toBeNull()
  })

  it('names every opponent in a multiplayer window', () => {
    const base = (active: string, turn: number, stack: Record<string, CardView> = {}) =>
      makeGameView({
        turn,
        activePlayerId: active,
        players: [
          makePlayer({ playerId: 'me', name: 'Me', controlled: true, battlefield: {} }),
          makePlayer({ playerId: 'a', name: 'Ana', battlefield: {} }),
          makePlayer({ playerId: 'b', name: 'Bo', battlefield: {} }),
        ],
        stack,
      })
    const recap = run([
      base('a', 2),
      base('a', 2, { s1: makeCard({ id: 's1', name: 'Opt', controllerId: 'a' }) }),
      base('b', 3),
      base('b', 3, { s2: makeCard({ id: 's2', name: 'Shock', controllerId: 'b' }) }),
      base('me', 4),
    ])
    expect(recap!.turnsOf).toEqual(['Ana', 'Bo'])
    expect(recap!.actors.map((a) => [a.name, a.played])).toEqual([['Ana', ['Opt']], ['Bo', ['Shock']]])
  })
})
