import { describe, expect, it } from 'vitest'
import { DEFAULT_PHASE_STOPS, PHASES, clonePhaseStops, mergePhaseStops, togglePhaseStop } from './phaseStops'

describe('phaseStops', () => {
  it('defaults every stop on for your turn and opponent turn', () => {
    expect(PHASES).toHaveLength(7)
    for (const turn of ['yourTurn', 'opponentTurn'] as const) {
      for (const p of PHASES) {
        expect(DEFAULT_PHASE_STOPS[turn][p.key]).toBe(true)
      }
    }
  })

  it('toggles a single stop without touching the rest', () => {
    const next = togglePhaseStop(DEFAULT_PHASE_STOPS, 'yourTurn', 'main1')
    expect(next.yourTurn.main1).toBe(false)
    expect(next.opponentTurn.main1).toBe(true)
    expect(DEFAULT_PHASE_STOPS.yourTurn.main1).toBe(true)
  })

  it('clones independently', () => {
    const copy = clonePhaseStops(DEFAULT_PHASE_STOPS)
    copy.opponentTurn.upkeep = false
    expect(DEFAULT_PHASE_STOPS.opponentTurn.upkeep).toBe(true)
  })

  it('merges stored values over the all-true default', () => {
    const merged = mergePhaseStops({ yourTurn: { main1: false }, opponentTurn: { upkeep: false, bogus: true } })
    expect(merged.yourTurn.main1).toBe(false)
    expect(merged.yourTurn.upkeep).toBe(true)
    expect(merged.opponentTurn.upkeep).toBe(false)
    expect(merged.opponentTurn.main1).toBe(true)
    expect((merged.opponentTurn as Record<string, boolean>).bogus).toBeUndefined()
  })

  it('falls back to defaults for null, garbage and corrupt shapes', () => {
    for (const bad of [null, undefined, 42, 'x', [], { yourTurn: null }, { yourTurn: { upkeep: 'yes' } }]) {
      const merged = mergePhaseStops(bad)
      for (const p of PHASES) {
        expect(merged.yourTurn[p.key]).toBe(true)
        expect(merged.opponentTurn[p.key]).toBe(true)
      }
    }
  })
})
