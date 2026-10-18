import { useCallback } from 'react'
import type { MouseEvent } from 'react'
import * as cmds from '../net/commands'
import { useStore } from '../state/store'
import { getState, setState } from '../state/state'
import type { TranslationSchema } from '../i18n/types'
import { serverPhaseStops } from './phaseStops'

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

export interface DialPhase {
  key: string
  label: string
  nameKey: keyof TranslationSchema['game']
  steps: string[]
  stopKeys: string[]
}

export const DIAL_PHASES: DialPhase[] = [
  { key: 'UPKEEP',         label: 'UPK', nameKey: 'step_upkeep',  steps: ['UPKEEP'],         stopKeys: ['upkeep'] },
  { key: 'DRAW',           label: 'DRW', nameKey: 'step_draw',    steps: ['DRAW'],           stopKeys: ['draw'] },
  { key: 'PRECOMBAT_MAIN', label: 'M1',  nameKey: 'step_main1',   steps: ['PRECOMBAT_MAIN'], stopKeys: ['main1'] },
  {
    key: 'COMBAT',
    label: 'CMB',
    nameKey: 'phase_combat',
    steps: ['BEGIN_COMBAT', 'DECLARE_ATTACKERS', 'DECLARE_BLOCKERS', 'FIRST_COMBAT_DAMAGE', 'COMBAT_DAMAGE', 'END_COMBAT'],
    stopKeys: ['beginCombat', 'endCombat'],
  },
  { key: 'POSTCOMBAT_MAIN', label: 'M2',  nameKey: 'step_main2',  steps: ['POSTCOMBAT_MAIN'], stopKeys: ['main2'] },
  { key: 'END_TURN',        label: 'END', nameKey: 'step_end_step', steps: ['END_TURN', 'CLEANUP'], stopKeys: ['endStep'] },
]

export function activeDialIndex(step: string): number {
  const idx = DIAL_PHASES.findIndex((p) => p.steps.includes(step))
  return idx >= 0 ? idx : 0
}

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

export function usePhaseStopToggles() {
  const phaseStops = useStore((s) => s.phaseStops)

  const toggleStop = useCallback((stopKey?: string | string[], e?: MouseEvent) => {
    const keys = Array.isArray(stopKey) ? stopKey : stopKey ? [stopKey] : []
    if (keys.length === 0 || !phaseStops) return
    e?.preventDefault()
    e?.stopPropagation()

    const currentYour = keys.some((k) => !!phaseStops.yourTurn?.[k])
    const currentOpp = keys.some((k) => !!phaseStops.opponentTurn?.[k])

    const nextYour = e?.shiftKey ? currentYour : !currentYour
    const nextOpp = e?.shiftKey ? !currentOpp : currentOpp

    const yourTurn = { ...(phaseStops.yourTurn ?? {}) }
    const opponentTurn = { ...(phaseStops.opponentTurn ?? {}) }
    for (const k of keys) {
      yourTurn[k] = nextYour
      opponentTurn[k] = nextOpp
    }
    const next = { yourTurn, opponentTurn }
    setState({ phaseStops: next })
    void cmds.updatePreferences(serverPhaseStops(getState().settings.smartStops, next))
  }, [phaseStops])

  const toggleOpponentStop = useCallback((stopKey?: string | string[]) => {
    const keys = Array.isArray(stopKey) ? stopKey : stopKey ? [stopKey] : []
    if (keys.length === 0 || !phaseStops) return
    const cur = keys.some((k) => !!phaseStops.opponentTurn?.[k])
    const opponentTurn = { ...(phaseStops.opponentTurn ?? {}) }
    for (const k of keys) opponentTurn[k] = !cur
    const next = { ...phaseStops, opponentTurn }
    setState({ phaseStops: next })
    void cmds.updatePreferences(serverPhaseStops(getState().settings.smartStops, next))
  }, [phaseStops])

  return { phaseStops, toggleStop, toggleOpponentStop }
}
