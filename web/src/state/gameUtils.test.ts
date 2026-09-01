import { describe, expect, it } from 'vitest'
import { combatActorsFrom, combatChosenFrom } from './gameUtils'
import type { GameView } from '../net/types'

function gameWithCombat(combat: unknown[]): GameView {
  return {
    combat,
    players: [
      { playerId: 'p-me', name: 'Me', controlled: true, battlefield: {} },
      { playerId: 'p-opp', name: 'Foe', controlled: false, battlefield: {} },
    ],
  } as unknown as GameView
}

describe('combatActorsFrom', () => {
  it('returns empty when there is no combat', () => {
    expect(combatActorsFrom(null)).toEqual({ attackingIds: [], blockingIds: [] })
    expect(combatActorsFrom({} as GameView)).toEqual({ attackingIds: [], blockingIds: [] })
    expect(combatActorsFrom(gameWithCombat([]))).toEqual({ attackingIds: [], blockingIds: [] })
  })

  it('collects attackers and blockers from combat groups (object form)', () => {
    const game = gameWithCombat([
      { attackers: { 'a-1': {}, 'a-2': {} }, blockers: { 'b-1': {} } },
      { attackers: { 'a-3': {} }, blockers: {} },
    ])
    const actors = combatActorsFrom(game)
    expect(actors.attackingIds.sort()).toEqual(['a-1', 'a-2', 'a-3'])
    expect(actors.blockingIds).toEqual(['b-1'])
  })

  it('collects attackers and blockers from combat groups (array form)', () => {
    const game = gameWithCombat([{ attackers: ['a-1', 'a-2'], blockers: ['b-9'] }])
    const actors = combatActorsFrom(game)
    expect(actors.attackingIds.sort()).toEqual(['a-1', 'a-2'])
    expect(actors.blockingIds).toEqual(['b-9'])
  })

  it('works for spectator-style views without controlled player', () => {
    const game = gameWithCombat([{ attackers: { 'x-1': {} }, defenders: ['p-2'] }])
    expect(combatActorsFrom(game).attackingIds).toEqual(['x-1'])
  })
})

describe('combatChosenFrom', () => {
  it('filters by mode', () => {
    const game = gameWithCombat([{ attackers: { 'a-1': {} }, blockers: { 'b-1': {} } }])
    expect(combatChosenFrom(game, 'attack')).toEqual(['a-1'])
    expect(combatChosenFrom(game, 'block')).toEqual(['b-1'])
    expect(combatChosenFrom(game).sort()).toEqual(['a-1', 'b-1'])
    expect(combatChosenFrom(null, 'attack')).toEqual([])
  })
})
