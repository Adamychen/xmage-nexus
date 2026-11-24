import { describe, expect, it } from 'vitest'
import { LADDER, ladderIndex, shownTurn } from './ladderSteps'
import { PHASES } from './phaseStops'
import { makeGameView, makePlayer } from '../__fixtures__/gameViews'

const me = makePlayer({ playerId: 'me', name: 'Alice', controlled: true })
const opp1 = makePlayer({ playerId: 'o1', name: 'Bob' })
const opp2 = makePlayer({ playerId: 'o2', name: 'Carol' })

describe('phase ladder model', () => {
  it('BRD-62: a step that is not on the ladder lights nothing', () => {
    expect(ladderIndex('UNTAP')).toBe(-1)
    expect(ladderIndex('')).toBe(-1)
    expect(ladderIndex(undefined)).toBe(-1)
    expect(ladderIndex('PRECOMBAT_MAIN')).toBe(2)
  })

  it('BRD-62: both combat damage steps light the damage icon', () => {
    const damage = LADDER.findIndex((s) => s.glyph === 'damage')
    expect(damage).toBeGreaterThan(-1)
    expect(ladderIndex('FIRST_COMBAT_DAMAGE')).toBe(damage)
    expect(ladderIndex('COMBAT_DAMAGE')).toBe(damage)
  })

  it('BRD-62: the ladder carries exactly the seven stoppable steps, in order', () => {
    expect(LADDER.filter((s) => s.stopKey).map((s) => s.stopKey)).toEqual(PHASES.map((p) => p.key))
  })

  it('BRD-62: cleanup lights the end step icon', () => {
    expect(ladderIndex('CLEANUP')).toBe(ladderIndex('END_TURN'))
    expect(LADDER.some((s) => s.key === 'CLEANUP')).toBe(false)
  })

  it('BRD-62: the five combat steps fold into the combat group', () => {
    expect(LADDER.filter((s) => s.group === 'combat').map((s) => s.key)).toEqual([
      'BEGIN_COMBAT', 'DECLARE_ATTACKERS', 'DECLARE_BLOCKERS', 'COMBAT_DAMAGE', 'END_COMBAT',
    ])
  })

  it('BRD-62: only the two main phases are big icons', () => {
    expect(LADDER.filter((s) => s.big).map((s) => s.key)).toEqual(['PRECOMBAT_MAIN', 'POSTCOMBAT_MAIN'])
  })

  it('BRD-62: the row shows the stops of the turn being played', () => {
    expect(shownTurn(makeGameView({ players: [me, opp1], activePlayerId: 'me' }))).toBe('yourTurn')
    expect(shownTurn(makeGameView({ players: [me, opp1, opp2], activePlayerId: 'o2' }))).toBe('opponentTurn')
  })

  it('BRD-62: a spectator has no turn to edit', () => {
    expect(shownTurn(makeGameView({ players: [opp1, opp2], activePlayerId: 'o1' }))).toBeNull()
    expect(shownTurn(null)).toBeNull()
  })
})
