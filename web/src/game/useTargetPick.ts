import { useRef } from 'react'
import * as cmds from '../net/commands'
import { clearFeedback, getState } from '../state/store'
import { perfMark } from '../system/perfProbe'
import type { FeedbackPrompt } from './feedback'

export function useTargetPick(gameId: string | null, onError: (error?: string) => void) {
  const answeredRef = useRef<FeedbackPrompt | null>(null)

  return async (id: string) => {
    if (!gameId) return
    const answered = getState().feedback
    // PRM-17: a target prompt takes one answer; the next pick waits for the prompt the server sends next.
    if (answered && answeredRef.current === answered) return
    answeredRef.current = answered
    perfMark('click', 'target', undefined, { id })
    const result = await cmds.sendPlayerUUID(id, gameId)
    if (!result.ok) {
      if (answeredRef.current === answered) answeredRef.current = null
      onError(result.error)
      return
    }
    // PRM-9: the accepted pick clears the prompt it answered. A hand pick (a discard) has no
    // other clearing event until the next priority pass, so the dialog stayed open meanwhile.
    if (getState().feedback === answered) clearFeedback()
  }
}
