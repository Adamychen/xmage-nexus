import { describe, expect, it } from 'vitest'
import { chooseSeat, effectiveFocus, liveOpponentIds, type SeatChoice } from './seatFocus'
import { makePlayer } from '../__fixtures__/gameViews'

const LIVE = ['p2', 'p3', 'p4']

function focus(chosen: SeatChoice | null, overrides: Partial<{ liveOppIds: string[]; activePlayerId: string | null; inCombat: boolean; turn: number }> = {}) {
  return effectiveFocus({ chosen, liveOppIds: LIVE, activePlayerId: 'p3', inCombat: false, turn: 4, ...overrides })
}

describe('seatFocus', () => {
  it('BRD-3: no focus until a seat is chosen, and none with fewer than two live opponents', () => {
    expect(focus(null)).toBeNull()
    expect(focus({ playerId: 'p2', combatTurn: null }, { liveOppIds: ['p2'] })).toBeNull()
  })

  it('BRD-3: focus drops when the chosen player is out (left or lost)', () => {
    expect(focus({ playerId: 'p3', combatTurn: null }, { liveOppIds: ['p2', 'p4'] })).toBeNull()
  })

  it('BRD-5: combat moves focus to a shrunk attacker and returns to the chosen seat when combat empties', () => {
    const chosen = { playerId: 'p2', combatTurn: null }
    expect(focus(chosen, { inCombat: true })).toBe('p3')
    expect(focus(chosen, { inCombat: false })).toBe('p2')
  })

  it('BRD-5: a seat chosen during this combat wins over the attacker', () => {
    const chosen = { playerId: 'p4', combatTurn: 4 }
    expect(focus(chosen, { inCombat: true, turn: 4 })).toBe('p4')
    expect(focus(chosen, { inCombat: false, turn: 4 })).toBe('p4')
  })

  it('BRD-5: the next turn\'s combat moves focus to the attacker again', () => {
    const chosen = { playerId: 'p4', combatTurn: 4 }
    expect(focus(chosen, { inCombat: true, turn: 5 })).toBe('p3')
    expect(focus(chosen, { inCombat: false, turn: 5 })).toBe('p4')
  })

  it('BRD-5: combat does not move focus when the active player is me or not a live opponent', () => {
    const chosen = { playerId: 'p2', combatTurn: null }
    expect(focus(chosen, { inCombat: true, activePlayerId: 'p1' })).toBe('p2')
    expect(focus(chosen, { inCombat: true, activePlayerId: 'p9' })).toBe('p2')
  })

  it('BRD-5: without a chosen seat, combat does not focus anyone', () => {
    expect(focus(null, { inCombat: true })).toBeNull()
  })

  it('BRD-5: a focused attacker out of combat keeps the chosen focus unchanged', () => {
    expect(focus({ playerId: 'p3', combatTurn: null }, { inCombat: true })).toBe('p3')
  })

  it('BRD-3: clicking the chosen seat clears the choice, even when combat shows another board', () => {
    expect(chooseSeat({ playerId: 'p2', combatTurn: null }, 'p2', false, 4)).toBeNull()
    expect(chooseSeat({ playerId: 'p2', combatTurn: 4 }, 'p2', true, 4)).toBeNull()
  })

  it('BRD-3: clicking the attacker shown by combat, which is not the chosen seat, makes it the chosen one', () => {
    const chosen = { playerId: 'p2', combatTurn: null }
    const next = chooseSeat(chosen, 'p3', true, 4)
    expect(next).toEqual({ playerId: 'p3', combatTurn: 4 })
    expect(focus(next, { inCombat: true, turn: 4 })).toBe('p3')
    expect(focus(next, { inCombat: false, turn: 4 })).toBe('p3')
  })

  it('BRD-3: live opponents exclude me, out players and empty seats', () => {
    const players = [
      makePlayer({ playerId: 'p1', name: 'Alice', controlled: true }),
      makePlayer({ playerId: 'p2', name: 'Bob' }),
      makePlayer({ playerId: 'p3', name: 'Carol', hasLeft: true, life: 0 }),
      undefined,
      makePlayer({ playerId: 'p4', name: 'Dave' }),
    ]
    expect(liveOpponentIds(players)).toEqual(['p2', 'p4'])
  })
})
