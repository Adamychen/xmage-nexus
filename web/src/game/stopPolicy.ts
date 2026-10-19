import type { GameView } from '../net/types'
import type { PhaseStops } from '../net/commands'
import { meaningfulPlayables } from './smartStops'
import { stopKeyForStep } from './phaseStops'

export type StopReason = 'playable' | 'user-stop' | 'nothing-to-do'

export interface StopDecision {
  action: 'stop' | 'pass'
  reason: StopReason
}

export function decideStop(game: GameView, phaseStops: PhaseStops): StopDecision {
  if (meaningfulPlayables(game).length > 0) return { action: 'stop', reason: 'playable' }
  const me = game.players?.find((p) => p.controlled)
  const key = stopKeyForStep(game.step)
  const row = me?.isActive ? phaseStops.yourTurn : phaseStops.opponentTurn
  if (key && row?.[key]) return { action: 'stop', reason: 'user-stop' }
  return { action: 'pass', reason: 'nothing-to-do' }
}
