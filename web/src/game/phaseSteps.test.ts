import { describe, expect, it } from 'vitest'
import { DIAL_PHASES, STEPS, STEP_GROUPS, activeDialIndex, activeStepIndex, isDamageStep } from './phaseSteps'
import { dialPipPoint } from './PhaseDial'

describe('phaseSteps', () => {
  it('lists every step once, grouped into the five phases', () => {
    expect(new Set(STEPS.map((s) => s.key)).size).toBe(STEPS.length)
    for (const step of STEPS) expect(STEP_GROUPS).toContain(step.group)
  })

  it('finds the active step and falls back to the first one for an unknown step', () => {
    expect(activeStepIndex('PRECOMBAT_MAIN')).toBe(2)
    expect(activeStepIndex('END_TURN')).toBe(8)
    expect(activeStepIndex('SOMETHING_ELSE')).toBe(0)
  })

  it('keeps the dial on the blockers pip during the combat damage steps', () => {
    expect(isDamageStep('COMBAT_DAMAGE')).toBe(true)
    expect(isDamageStep('FIRST_COMBAT_DAMAGE')).toBe(true)
    expect(isDamageStep('END_COMBAT')).toBe(false)
    expect(activeStepIndex('COMBAT_DAMAGE')).toBe(activeStepIndex('DECLARE_BLOCKERS'))
    expect(activeStepIndex('FIRST_COMBAT_DAMAGE')).toBe(activeStepIndex('DECLARE_BLOCKERS'))
  })

  it('folds the ten steps into the six dial phases and keeps combat as one pip', () => {
    expect(DIAL_PHASES.map((p) => p.label)).toEqual(['UPK', 'DRW', 'M1', 'CMB', 'M2', 'END'])
    for (const step of STEPS) expect(DIAL_PHASES.some((p) => p.steps.includes(step.key))).toBe(true)
    const cmb = DIAL_PHASES.findIndex((p) => p.key === 'COMBAT')
    for (const step of ['BEGIN_COMBAT', 'DECLARE_ATTACKERS', 'DECLARE_BLOCKERS', 'FIRST_COMBAT_DAMAGE', 'COMBAT_DAMAGE', 'END_COMBAT']) {
      expect(activeDialIndex(step)).toBe(cmb)
    }
    expect(activeDialIndex('CLEANUP')).toBe(activeDialIndex('END_TURN'))
    expect(activeDialIndex('SOMETHING_ELSE')).toBe(0)
  })

  it('lays the dial pips left to right on an arc with no overlap', () => {
    const points = DIAL_PHASES.map((_, i) => dialPipPoint(i, DIAL_PHASES.length))
    for (let i = 1; i < points.length; i++) {
      expect(points[i].x).toBeGreaterThan(points[i - 1].x)
      expect(Math.hypot(points[i].x - points[i - 1].x, points[i].y - points[i - 1].y)).toBeGreaterThan(38)
    }
  })
})
