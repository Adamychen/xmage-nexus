import { describe, expect, it } from 'vitest'
import podCombat from '../../fixtures/recorded/pod-combat.json'
import { atEaseIds, combatArrangement, combatOrder } from './combatColumns'
import type { GameView, PermanentView, PlayerView } from '../net/types'

const perm = (name: string): PermanentView => ({ name, manaValue: 0, expansionSetCode: '', cardNumber: '0' } as unknown as PermanentView)

function seat(playerId: string, cards: string[]): PlayerView {
  const battlefield: Record<string, PermanentView> = {}
  for (const id of cards) battlefield[id] = perm(id)
  return { playerId, name: playerId, battlefield } as unknown as PlayerView
}

function game(players: PlayerView[], combat: unknown[]): GameView {
  return { players, combat } as unknown as GameView
}

const group = (attackers: string[], blockers: string[] = [], defenderId?: string) => ({
  attackers: Object.fromEntries(attackers.map((id) => [id, perm(id)])),
  blockers: Object.fromEntries(blockers.map((id) => [id, perm(id)])),
  ...(defenderId ? { defenderId } : null),
})

describe('combat read as columns', () => {
  it('CMB-14: a skirmish is one column, attacker with its blocker in front', () => {
    const view = game(
      [seat('me', ['bear', 'wall']), seat('opp', ['goblin'])],
      [group(['goblin'], ['bear'], 'me')],
    )
    const arrangement = combatArrangement(view)
    expect(arrangement.targets).toHaveLength(1)
    expect(arrangement.targets[0]).toMatchObject({ defenderId: 'me', kind: 'player', unblockedIds: [] })
    expect(arrangement.targets[0].columns).toEqual([{ attackerIds: ['goblin'], blockerIds: ['bear'] }])
    expect(arrangement.engagedIds).toEqual({ me: ['bear'], opp: ['goblin'] })
    expect(atEaseIds(arrangement, view.players![0] as PlayerView)).toEqual(['wall'])
  })

  it('CMB-14: a wide attack with nothing blocking is all beam and no blockers', () => {
    const view = game(
      [seat('me', []), seat('opp', ['a', 'b', 'c'])],
      [group(['a'], [], 'me'), group(['b'], [], 'me'), group(['c'], [], 'me')],
    )
    const arrangement = combatArrangement(view)
    expect(arrangement.targets).toHaveLength(1)
    expect(arrangement.targets[0].columns).toHaveLength(3)
    expect(arrangement.targets[0].unblockedIds).toEqual(['a', 'b', 'c'])
  })

  it('CMB-14: a multiple block is one column with every blocker in it', () => {
    const view = game(
      [seat('me', ['x', 'y', 'z']), seat('opp', ['giant'])],
      [group(['giant'], ['x', 'y', 'z'], 'me')],
    )
    const arrangement = combatArrangement(view)
    expect(arrangement.targets[0].columns).toEqual([{ attackerIds: ['giant'], blockerIds: ['x', 'y', 'z'] }])
    expect(arrangement.targets[0].unblockedIds).toEqual([])
  })

  it('CMB-14: a band attacks as one column, not as one per creature', () => {
    const view = game([seat('me', []), seat('opp', ['one', 'two'])], [group(['one', 'two'], [], 'me')])
    const arrangement = combatArrangement(view)
    expect(arrangement.targets[0].columns).toEqual([{ attackerIds: ['one', 'two'], blockerIds: [] }])
    expect(arrangement.targets[0].unblockedIds).toEqual(['one', 'two'])
  })

  it('CMB-14: a pod keeps one entry per defender, in the order the view lists them', () => {
    const view = game(
      [seat('p1', []), seat('p2', []), seat('p3', []), seat('me', ['a', 'b', 'c'])],
      [group(['a'], [], 'p2'), group(['b'], [], 'p1'), group(['c'], [], 'p2')],
    )
    const arrangement = combatArrangement(view)
    expect(arrangement.targets.map((t) => t.defenderId)).toEqual(['p2', 'p1'])
    expect(arrangement.targets[0].columns).toHaveLength(2)
    expect(arrangement.targets[1].columns).toHaveLength(1)
  })

  it('CMB-14: a group attacking a planeswalker names that permanent, not its controller', () => {
    const view = game(
      [seat('me', ['teferi']), seat('opp', ['raider'])],
      [group(['raider'], [], 'teferi')],
    )
    const arrangement = combatArrangement(view)
    expect(arrangement.targets[0]).toMatchObject({ defenderId: 'teferi', kind: 'permanent' })
  })

  it('CMB-14: a group whose defender the view does not name keeps out of the columns', () => {
    const view = game([seat('me', []), seat('opp', ['ghost'])], [group(['ghost'])])
    const arrangement = combatArrangement(view)
    expect(arrangement.targets).toEqual([])
    expect(arrangement.strays).toEqual([{ attackerIds: ['ghost'], blockerIds: [] }])
  })

  it('CMB-14: no combat at all is no arrangement', () => {
    expect(combatArrangement(null).targets).toEqual([])
    expect(combatArrangement(game([seat('me', ['bear'])], []).valueOf() as GameView).targets).toEqual([])
  })

  it('CMB-14: the recorded pod combat reads as the frame describes it', () => {
    const arrangement = combatArrangement((podCombat as { gameView: unknown }).gameView as GameView)
    expect(arrangement.strays).toEqual([])
    expect(arrangement.targets.length).toBeGreaterThan(0)
    for (const target of arrangement.targets) {
      expect(target.kind).toBe('player')
      expect(target.columns.length).toBeGreaterThan(0)
      for (const column of target.columns) expect(column.attackerIds.length).toBeGreaterThan(0)
    }
    const attackers = arrangement.targets.flatMap((t) => t.columns.flatMap((c) => c.attackerIds))
    const engaged = Object.values(arrangement.engagedIds).flat()
    for (const id of attackers) expect(engaged).toContain(id)
  })
})

describe('the column number a creature carries', () => {
  it('CMB-14: an attacker and the creatures blocking it share a column number', () => {
    const view = game(
      [seat('me', ['x', 'y']), seat('opp', ['giant', 'runner'])],
      [group(['giant'], ['x', 'y'], 'me'), group(['runner'], [], 'me')],
    )
    const order = combatOrder(combatArrangement(view))
    expect(order.get('giant')).toBe(0)
    expect(order.get('x')).toBe(0)
    expect(order.get('y')).toBe(0)
    expect(order.get('runner')).toBe(1)
  })

  it('CMB-14: the numbering follows the defenders, so a pod reads seat by seat', () => {
    const view = game(
      [seat('p1', ['block1']), seat('p2', []), seat('me', ['a', 'b'])],
      [group(['a'], ['block1'], 'p1'), group(['b'], [], 'p2')],
    )
    const order = combatOrder(combatArrangement(view))
    expect([order.get('a'), order.get('block1')]).toEqual([0, 0])
    expect(order.get('b')).toBe(1)
  })
})
