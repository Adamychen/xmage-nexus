import * as cmds from '../net/commands'
import { createLibraryPlan, nextPlanAnswer } from '../game/feedback/libraryPlan'
import type { LibraryArrangement } from '../game/feedback/libraryPlan'
import type { FeedbackPrompt } from '../game/feedback'
import { getState, setState } from './state'

export const LIBRARY_PLAN_IDLE_MS = 5000

let idleTimer: ReturnType<typeof setTimeout> | null = null

function clearIdleTimer(): void {
  if (idleTimer !== null) clearTimeout(idleTimer)
  idleTimer = null
}

function restartIdleTimer(): void {
  clearIdleTimer()
  idleTimer = setTimeout(() => {
    idleTimer = null
    endLibraryPlan()
  }, LIBRARY_PLAN_IDLE_MS)
}

export function endLibraryPlan(): void {
  clearIdleTimer()
  const s = getState()
  if (s.libraryPlan !== null || s.libraryPrompt !== null) setState({ libraryPlan: null, libraryPrompt: null })
}

export function answerFromLibraryPlan(feedback: FeedbackPrompt): boolean {
  const plan = getState().libraryPlan
  const step = plan ? nextPlanAnswer(plan, feedback) : null
  if (!step) {
    endLibraryPlan()
    return false
  }
  setState({ libraryPlan: step.plan, feedback: null })
  if (step.answer.kind === 'uuid') void cmds.sendPlayerUUID(step.answer.value, step.plan.gameId)
  else void cmds.sendPlayerBoolean(step.answer.value, step.plan.gameId)
  if (step.plan.settled) endLibraryPlan()
  else restartIdleTimer()
  return true
}

export function startLibraryPlan(prompt: FeedbackPrompt, arrangement: LibraryArrangement): void {
  const cardIds = (prompt.cards ?? []).map((card) => card.id)
  setState({ libraryPlan: createLibraryPlan(prompt.gameId, cardIds, arrangement), libraryPrompt: prompt, feedback: null })
  if (!answerFromLibraryPlan(prompt)) setState({ feedback: prompt })
}
