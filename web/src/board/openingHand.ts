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

/**
 * HND-14: in the pre-game the hand is held back until the opening-hand decision is on screen, and
 * from then on it stays, so a keep does not make the cards disappear again while the other seats
 * mulligan.
 */
export function openingHandHeld(game: GameView | null, feedback: FeedbackPrompt | null, decided: boolean): boolean {
  if (!game || decided) return false
  if (!isPreGame(game)) return false
  return !isOpeningHandDecision(feedback)
}

/** The same, for a board: it remembers the decision of the game it is drawing. */
export function useOpeningHandHeld(): boolean {
  const game = useStore((s) => s.game)
  const feedback = useStore((s) => s.feedback)
  const gameId = useStore((s) => s.gameId)
  const [decidedIn, setDecidedIn] = useState<string | null>(null)
  const decision = isOpeningHandDecision(feedback)

  useEffect(() => {
    if (decision && gameId) setDecidedIn(gameId)
  }, [decision, gameId])

  return openingHandHeld(game, feedback, decidedIn !== null && decidedIn === gameId)
}
