import type { TranslationSchema } from '../i18n/types'

export interface StepDef {
  key: string
  label: string
  nameKey: keyof TranslationSchema['game']
  group: string
  stopKey?: string
}

export const STEPS: StepDef[] = [
  { key: 'UPKEEP',            label: 'UP',  nameKey: 'step_upkeep',         group: 'b',  stopKey: 'upkeep' },
  { key: 'DRAW',              label: 'DR',  nameKey: 'step_draw',           group: 'b',  stopKey: 'draw' },
  { key: 'PRECOMBAT_MAIN',    label: 'M1',  nameKey: 'step_main1',          group: 'm1', stopKey: 'main1' },
  { key: 'BEGIN_COMBAT',      label: 'BC',  nameKey: 'step_begin_combat',   group: 'c',  stopKey: 'beginCombat' },
  { key: 'DECLARE_ATTACKERS', label: 'AT',  nameKey: 'step_attackers',      group: 'c' },
  { key: 'DECLARE_BLOCKERS',  label: 'BL',  nameKey: 'step_blockers',       group: 'c' },
  { key: 'END_COMBAT',        label: 'EC',  nameKey: 'step_end_combat',     group: 'c',  stopKey: 'endCombat' },
  { key: 'POSTCOMBAT_MAIN',   label: 'M2',  nameKey: 'step_main2',          group: 'm2', stopKey: 'main2' },
  { key: 'END_TURN',          label: 'ET',  nameKey: 'step_end_step',       group: 'e',  stopKey: 'endStep' },
  { key: 'CLEANUP',           label: 'CL',  nameKey: 'step_cleanup',        group: 'e' },
]

export const STEP_GROUPS = ['b', 'm1', 'c', 'm2', 'e']

const DAMAGE_STEPS: ReadonlySet<string> = new Set(['FIRST_COMBAT_DAMAGE', 'COMBAT_DAMAGE'])

export function isDamageStep(step: string | null | undefined): boolean {
  return !!step && DAMAGE_STEPS.has(step)
}

export function activeStepIndex(step: string): number {
  const key = isDamageStep(step) ? 'DECLARE_BLOCKERS' : step
  const idx = STEPS.findIndex((s) => s.key === key)
  return idx >= 0 ? idx : 0
}
