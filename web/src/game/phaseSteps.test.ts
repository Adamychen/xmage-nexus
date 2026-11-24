import { describe, expect, it } from 'vitest'
import { STEPS, STEP_GROUPS, activeStepIndex, isDamageStep } from './phaseSteps'

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
})
