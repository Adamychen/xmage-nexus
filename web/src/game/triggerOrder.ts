import type { FeedbackCard } from './feedback/types'
import type { GameView } from '../net/types'

export type TriggerRuleScope = 'card' | 'name'

const TRIGGER_RULE_PATTERN = /whenever|^at the beginning of|^at the beginning of your|^at the end of|^when |^at |siempre que|al comienzo de|al final de/i
const RELATED_RULE_PATTERN = /related objects|<i>related|objetos relacionados/i

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

/**
 * Extra rules worth showing under the trigger text. `CardsView(abilities, game)`
 * appends a `Related objects: [...]` line (CardView targets computed from the
 * effect's TargetPointer) so triggers that target different objects are told
 * apart; the trigger-pattern pick in `triggerRuleText` would drop it.
 */
export function triggerExtraRules(card: FeedbackCard): string[] {
  return (card.rules ?? [])
    .map((rule) => String(rule).replace(/<[^>]*>/g, '').trim())
    .filter((rule) => rule && RELATED_RULE_PATTERN.test(rule))
}

/**
 * The server asks bottom-up ("Pick triggered ability (goes to the stack first)")
 * once per trigger, so a list displayed in resolution order (index 0 resolves
 * first) must be answered in reverse: the last to resolve goes on the stack first.
 */
export function triggerPickOrder(resolutionOrder: string[]): string[] {
  return [...resolutionOrder].reverse()
}

function addZone(zone: unknown, names: Map<string, string>): void {
  if (!zone || typeof zone !== 'object') return
  const entries = Array.isArray(zone) ? zone.map((item) => [undefined, item] as const) : Object.entries(zone)
  for (const [key, value] of entries) {
    const card = (value ?? {}) as { id?: string; name?: string; displayName?: string }
    const name = card.displayName ?? card.name
    if (name) names.set(card.id ?? key ?? '', name)
  }
}

/** id → display name for every public object of the current GameView (used to label trigger targets). */
export function gameObjectNames(game: GameView | null | undefined): Map<string, string> {
  const names = new Map<string, string>()
  if (!game) return names
  addZone(game.stack, names)
  addZone(game.myHand, names)
  addZone(game.myHelperEmblems, names)
  for (const player of game.players ?? []) {
    if (player.playerId && player.name) names.set(player.playerId, player.name)
    addZone(player.battlefield, names)
    addZone(player.graveyard, names)
    addZone(player.exile, names)
    addZone(player.commandList, names)
  }
  return names
}
