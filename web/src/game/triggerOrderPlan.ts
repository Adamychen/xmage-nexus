import type { FeedbackCard } from './feedback/types'
import { triggerPickOrder } from './triggerOrder'

/**
 * A confirmed trigger order, answered across the server's one-pick-at-a-time
 * prompts. `order` is display order (index 0 resolves first); `picks` is the
 * order the UUIDs must be sent, built once (reverse: bottom of the stack first).
 */
export interface TriggerOrderPlan {
  gameId: string
  order: string[]
  picks: string[]
  entries: Map<string, FeedbackCard>
  sent: string[]
}

let plan: TriggerOrderPlan | null = null

/**
 * One chained answer per server prompt. Module-level on purpose: React StrictMode
 * remounts the dialog (fresh refs) in dev, and a ref-based latch would consume a
 * second pick of the same prompt.
 */
const claimedPrompts = new WeakSet<object>()

export function claimTriggerPrompt(prompt: object): boolean {
  if (claimedPrompts.has(prompt)) return false
  claimedPrompts.add(prompt)
  return true
}

export function setTriggerOrderPlan(gameId: string, order: string[], cards: FeedbackCard[]): TriggerOrderPlan {
  const entries = new Map(cards.map((card) => [card.id, card]))
  plan = { gameId, order: [...order], picks: triggerPickOrder(order), entries, sent: [] }
  return plan
}

export function getTriggerOrderPlan(): TriggerOrderPlan | null {
  return plan
}

export function clearTriggerOrderPlan(): void {
  plan = null
}

/**
 * Next UUID of the plan if the server is still waiting for it (present in the
 * current prompt). A mismatch means the game state moved on: the plan is
 * dropped and `null` lets the dialog fall back to manual picking.
 */
export function takeNextTriggerPick(gameId: string, candidateIds: Iterable<string>): string | null {
  if (!plan || plan.gameId !== gameId) return null
  const next = plan.picks[plan.sent.length]
  if (!next) {
    clearTriggerOrderPlan()
    return null
  }
  const candidates = new Set(candidateIds)
  if (!candidates.has(next)) {
    clearTriggerOrderPlan()
    return null
  }
  plan.sent.push(next)
  return next
}
