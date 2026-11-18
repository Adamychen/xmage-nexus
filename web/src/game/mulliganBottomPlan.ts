/**
 * PRM-2: the cards a player chose to put at the bottom of their library after a London mulligan.
 *
 * The server asks for them one at a time (`Select a card (N more) to put on the bottom…`), but the
 * player chooses all of them first and then confirms, so the confirmation becomes a plan that is
 * answered across those consecutive asks: `picks` is the order the UUIDs are sent, `sent` is how
 * far it got. Same shape as `triggerOrderPlan`, for the same reason.
 */
export interface MulliganBottomPlan {
  gameId: string
  picks: string[]
  sent: string[]
}

let plan: MulliganBottomPlan | null = null

/**
 * One chained answer per server ask. Module-level on purpose: React StrictMode remounts the
 * dialog (fresh refs) in dev, and a ref-based latch would consume a second pick of the same ask.
 */
const claimedPrompts = new WeakSet<object>()

export function claimMulliganPrompt(prompt: object): boolean {
  if (claimedPrompts.has(prompt)) return false
  claimedPrompts.add(prompt)
  return true
}

export function setMulliganBottomPlan(gameId: string, picks: string[]): MulliganBottomPlan {
  plan = { gameId, picks: [...picks], sent: [] }
  return plan
}

export function getMulliganBottomPlan(): MulliganBottomPlan | null {
  return plan
}

export function clearMulliganBottomPlan(): void {
  plan = null
}

/**
 * Next UUID of the plan if the server is still waiting for it (present in the current ask). A
 * mismatch means the game state moved on: the plan is dropped and `null` puts the player back in
 * charge of the choice.
 */
export function takeNextMulliganPick(gameId: string, candidateIds: Iterable<string>): string | null {
  if (!plan || plan.gameId !== gameId) return null
  const next = plan.picks[plan.sent.length]
  if (!next) {
    clearMulliganBottomPlan()
    return null
  }
  if (!new Set(candidateIds).has(next)) {
    clearMulliganBottomPlan()
    return null
  }
  plan.sent.push(next)
  return next
}
