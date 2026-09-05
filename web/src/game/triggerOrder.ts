import type { FeedbackCard } from './feedback/types'

export type TriggerRuleScope = 'card' | 'name'

const TRIGGER_RULE_PATTERN = /whenever|^at the beginning of|^at the beginning of your|^at the end of|^when |^at |siempre que|al comienzo de|al final de/i

export function triggerRuleText(card: FeedbackCard): string {
  const rules = card.rules ?? []
  const trigger = rules.find((rule) => TRIGGER_RULE_PATTERN.test(rule.trim()))
  const text = (trigger ?? rules[0] ?? '').trim()
  if (!text) return card.displayName ?? card.name
  return text.replace(/\{this\}/g, card.displayName ?? card.name)
}

export function triggerDisplayName(card: FeedbackCard): string {
  return card.displayName ?? card.name
}
