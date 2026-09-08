import type { FeedbackPrompt } from '../game/feedback/types'
import { soundManager } from './soundManager'

let lastSignature: string | null = null

export function feedbackSignature(fb: FeedbackPrompt): string {
  const opts = (fb.options ?? []).map((o) => o.id).join(',')
  return [fb.method, fb.gameId, fb.title, fb.message, fb.mode, fb.min, fb.max, opts].join('|')
}

export function notifyFeedbackOpened(fb: FeedbackPrompt): void {
  const sig = feedbackSignature(fb)
  if (sig === lastSignature) return
  lastSignature = sig
  soundManager.play('prompt_open', 'ui')
}

export function resetPromptSound(): void {
  lastSignature = null
}
