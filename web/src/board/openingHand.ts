import { useEffect, useState } from 'react'
import type { GameView } from '../net/types'
import type { FeedbackPrompt } from '../game/feedback'
import { isPreGame } from '../game/waitingState'
import { isMulliganDecision } from '../state/selectors'
import { useStore } from '../state/store'

/** The opening-hand decision (keep or mulligan, and the London cards to put back) is on screen. */
export function isOpeningHandDecision(feedback: FeedbackPrompt | null | undefined): boolean {
  return isMulliganDecision(feedback) || feedback?.isMulliganLondon === true
}

/** Which hand this is: the cards it holds, so a mulligan's new hand is told from the one kept. */
export function openingHandKey(game: GameView | null): string {
  return Object.keys(game?.myHand ?? {}).sort().join(',')
}

/**
 * HND-14: in the pre-game the hand is held back until the opening-hand decision is on screen. The
 * decision is remembered for the hand it was asked about, not for the game: a keep leaves the
 * cards up while the other seats decide, and a mulligan deals a new hand, which waits for its own
 * question instead of being shown for a few seconds before the screen comes back.
 */
export function openingHandHeld(game: GameView | null, feedback: FeedbackPrompt | null, decidedFor: string | null): boolean {
  if (!game) return false
  if (!isPreGame(game)) return false
  if (isOpeningHandDecision(feedback)) return false
  return decidedFor === null || decidedFor !== openingHandKey(game)
}

/** The same, for a board: it remembers which hand the question was asked about. */
export function useOpeningHandHeld(): boolean {
  const game = useStore((s) => s.game)
  const feedback = useStore((s) => s.feedback)
  const [decidedFor, setDecidedFor] = useState<string | null>(null)
  const decision = isOpeningHandDecision(feedback)
  const key = openingHandKey(game)

  useEffect(() => {
    if (decision) setDecidedFor(key)
  }, [decision, key])

  return openingHandHeld(game, feedback, decidedFor)
}
