import type { FeedbackPrompt } from './feedback'

/**
 * Plain yes/no asks (pay life, optional costs, ward, cascade…) that carry no
 * dedicated dialog and can be answered from the non-modal ask bar: the board
 * stays readable and hoverable while the player decides.
 */
export function isPlainBooleanAsk(prompt: FeedbackPrompt): boolean {
  return prompt.method === 'GAME_ASK'
    && prompt.mode === 'boolean'
    && !prompt.isMulligan
    && !prompt.isVoting
    && !prompt.isStartingPlayer
}

/**
 * Ids of a `GAME_TARGET` whose cards are all in the controller's hand: the
 * hand strip is already the natural picker, so the grid dialog is skipped and
 * the command zone stays visible. Returns null when any legal candidate lives
 * outside the hand (the grid must remain the source of truth).
 */
export function handPickIds(prompt: FeedbackPrompt, myHandIds: ReadonlySet<string>): string[] | null {
  if (prompt.method !== 'GAME_TARGET') return null
  if (!prompt.cards || prompt.cards.length === 0) return null
  if (!prompt.cards.every((card) => myHandIds.has(card.id))) return null
  const optionIds = prompt.options.map((option) => option.id).filter(Boolean)
  if (optionIds.length > 0 && !optionIds.every((id) => myHandIds.has(id))) return null
  const ids = optionIds.length > 0 ? optionIds : prompt.cards.map((card) => card.id)
  return ids.length > 0 ? ids : null
}
