import type { PhaseStops } from '../net/commands'

export type PhaseTurn = 'yourTurn' | 'opponentTurn'

export const PHASE_TURNS: PhaseTurn[] = ['yourTurn', 'opponentTurn']

export interface PhaseDef {
  key: string
  labelKey: string
  short: string
}

export const PHASES: PhaseDef[] = [
  { key: 'upkeep', labelKey: 'step_upkeep', short: 'UP' },
  { key: 'draw', labelKey: 'step_draw', short: 'DR' },
  { key: 'main1', labelKey: 'step_main1', short: 'M1' },
  { key: 'beginCombat', labelKey: 'step_begin_combat', short: 'BC' },
  { key: 'endCombat', labelKey: 'step_end_combat', short: 'EC' },
  { key: 'main2', labelKey: 'step_main2', short: 'M2' },
  { key: 'endStep', labelKey: 'step_end_step', short: 'ET' },
]

function allTrue(): Record<string, boolean> {
  const out: Record<string, boolean> = {}
  for (const p of PHASES) out[p.key] = true
  return out
}

export const DEFAULT_PHASE_STOPS: PhaseStops = {
  yourTurn: allTrue(),
  opponentTurn: allTrue(),
}

export function clonePhaseStops(stops: PhaseStops): PhaseStops {
  return { yourTurn: { ...stops.yourTurn }, opponentTurn: { ...stops.opponentTurn } }
}

export function togglePhaseStop(stops: PhaseStops, turn: PhaseTurn, key: string): PhaseStops {
  const next = clonePhaseStops(stops)
  next[turn][key] = !next[turn][key]
  return next
}

/** Mapa de `GameView.step` (wire real del servidor) al `stopKey` configurable de PhaseBar/PhaseStopSelector. */
const STEP_STOP_KEY: Record<string, string> = {
  UPKEEP: 'upkeep',
  DRAW: 'draw',
  PRECOMBAT_MAIN: 'main1',
  BEGIN_COMBAT: 'beginCombat',
  END_COMBAT: 'endCombat',
  POSTCOMBAT_MAIN: 'main2',
  END_TURN: 'endStep',
}

/**
 * DECLARE_ATTACKERS/DECLARE_BLOCKERS/COMBAT_DAMAGE/CLEANUP no tienen stopKey:
 * no son configurables (el motor siempre pregunta cuando hay algo que decidir
 * en esos pasos, igual que el cliente oficial), así que no hay nada que mirar
 * aquí para ellos.
 */
export function stopKeyForStep(step: string | null | undefined): string | undefined {
  return step ? STEP_STOP_KEY[step] : undefined
}

export function mergePhaseStops(stored: unknown): PhaseStops {
  const base = clonePhaseStops(DEFAULT_PHASE_STOPS)
  if (!stored || typeof stored !== 'object') return base
  const rec = stored as Record<string, unknown>
  for (const turn of PHASE_TURNS) {
    const t = rec[turn]
    if (!t || typeof t !== 'object') continue
    const row = t as Record<string, unknown>
    for (const p of PHASES) {
      if (typeof row[p.key] === 'boolean') base[turn][p.key] = row[p.key] as boolean
    }
  }
  return base
}
