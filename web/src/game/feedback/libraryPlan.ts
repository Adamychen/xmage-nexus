import type { FeedbackPrompt } from './types'

export type LibraryPlanMode = 'surveil' | 'scry' | 'top-order' | 'bottom-order' | 'grave-order' | 'pick'

export interface LibraryArrangement {
  mode: LibraryPlanMode
  top: string[]
  away: string[]
}

export interface LibraryPlan extends LibraryArrangement {
  gameId: string
  cardIds: string[]
  settled: boolean
  /** Done answers sent by a `pick` plan: a library search asks for Done twice. */
  dones?: number
}

export type PlanAnswer = { kind: 'uuid'; value: string } | { kind: 'boolean'; value: boolean }

export function createLibraryPlan(gameId: string, cardIds: string[], arrangement: LibraryArrangement): LibraryPlan {
  return {
    mode: arrangement.mode,
    top: [...arrangement.top],
    away: [...arrangement.away],
    gameId,
    cardIds: [...cardIds],
    settled: false,
  }
}

type Step = { answer: PlanAnswer; plan: LibraryPlan }

function settle(plan: LibraryPlan, answer: PlanAnswer, settled: boolean): Step {
  return { answer, plan: { ...plan, settled: plan.settled || settled } }
}

function sameCards(plan: LibraryPlan, prompt: FeedbackPrompt): boolean {
  const ids = new Set((prompt.cards ?? []).map((card) => card.id))
  return ids.size === plan.cardIds.length && plan.cardIds.every((id) => ids.has(id))
}

function pickStep(plan: LibraryPlan, prompt: FeedbackPrompt): Step | null {
  if (!sameCards(plan, prompt)) return null
  const chosen = prompt.chosenTargets ?? []
  if (chosen.some((id) => !plan.away.includes(id))) return null
  const lastOfChain = plan.top.length < 2 && (plan.mode === 'surveil' || plan.away.length < 2)
  const next = plan.away.find((id) => !chosen.includes(id))
  if (next === undefined) return settle(plan, { kind: 'boolean', value: false }, lastOfChain)
  if (!prompt.options.some((option) => option.id === next)) return null
  const completes = prompt.max > 0 && chosen.length + 1 >= prompt.max
  return settle(plan, { kind: 'uuid', value: next }, lastOfChain && completes)
}

function orderStep(plan: LibraryPlan, prompt: FeedbackPrompt, order: string[], settlesLast: boolean): Step | null {
  const ids = prompt.options.map((option) => option.id)
  if (ids.length === 0 || ids.some((id) => !order.includes(id))) return null
  const next = order.find((id) => ids.includes(id))
  if (next === undefined) return null
  return settle(plan, { kind: 'uuid', value: next }, settlesLast && ids.length <= 2)
}

/** PRM-6: a multi-card target pick (a tutor for two cards) answered from the cards the player
 *  chose on one screen, one card per re-ask, then Done when fewer than the most were chosen. A
 *  library search (`TargetCardInLibrary.choose`) wraps the pick in a loop of its own that asks
 *  once more after a Done that added cards, so Done is answered up to twice. */
function gridPickStep(plan: LibraryPlan, prompt: FeedbackPrompt): Step | null {
  if (prompt.method !== 'GAME_TARGET' || prompt.libraryStep) return null
  if (!sameCards(plan, prompt)) return null
  const chosen = prompt.chosenTargets ?? []
  if (chosen.some((id) => !plan.away.includes(id))) return null
  const next = plan.away.find((id) => !chosen.includes(id))
  if (next === undefined) {
    const dones = (plan.dones ?? 0) + 1
    if (dones > 2) return null
    return settle({ ...plan, dones }, { kind: 'boolean', value: false }, dones === 2)
  }
  if (!prompt.options.some((option) => option.id === next)) return null
  const max = prompt.progress?.max ?? prompt.max
  return settle(plan, { kind: 'uuid', value: next }, max > 0 && chosen.length + 1 >= max)
}

export function nextPlanAnswer(plan: LibraryPlan, prompt: FeedbackPrompt): Step | null {
  if (prompt.gameId !== plan.gameId) return null
  switch (plan.mode) {
    case 'pick':
      return gridPickStep(plan, prompt)
    case 'top-order':
      return prompt.libraryStep === 'top-order'
        ? orderStep(plan, prompt, [...plan.top].reverse(), true)
        : null
    case 'bottom-order':
      return prompt.libraryStep === 'bottom-order'
        ? orderStep(plan, prompt, plan.away, true)
        : null
    case 'grave-order':
      return prompt.libraryStep === 'grave-order'
        ? orderStep(plan, prompt, plan.away, true)
        : null
  }
  const surveil = plan.mode === 'surveil'
  switch (prompt.libraryStep) {
    case 'surveil-pick':
      return surveil ? pickStep(plan, prompt) : null
    case 'scry-pick':
      return surveil ? null : pickStep(plan, prompt)
    case 'top-order':
      return orderStep(plan, prompt, [...plan.top].reverse(), true)
    case 'bottom-order':
      return surveil ? null : orderStep(plan, prompt, plan.away, plan.top.length < 2)
    case 'grave-order':
      return surveil ? orderStep(plan, prompt, plan.away, plan.top.length < 2) : null
    case 'grave-order-ask':
      return surveil && plan.away.length >= 2 ? settle(plan, { kind: 'boolean', value: true }, false) : null
    default:
      return null
  }
}
