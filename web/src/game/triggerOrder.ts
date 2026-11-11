import type { FeedbackCard } from './feedback/types'
import type { CardView, GameView, PermanentView } from '../net/types'
import { findCardViewInGame } from '../board/boardShared'

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

export type TriggerObjectZone = 'battlefield' | 'graveyard' | 'exile' | 'hand' | 'command' | 'stack' | 'other'

/** An object a trigger points at (`CardView.targets`): a card wherever it is now, or a player. */
export interface TriggerObject {
  id: string
  name: string
  /** The card as the GameView shows it now; null for players and for objects the view does not carry. */
  card: CardView | PermanentView | null
  zone: TriggerObjectZone | null
  /** Player whose zone holds the card (the controller for a permanent). */
  ownerName: string | null
  isPlayer: boolean
}

function zoneHit(zone: unknown, id: string): CardView | null {
  if (!zone || typeof zone !== 'object') return null
  const hit = Array.isArray(zone)
    ? zone.find((item) => (item as { id?: string } | null)?.id === id)
    : (zone as Record<string, unknown>)[id]
  return hit && typeof hit === 'object' ? (hit as CardView) : null
}

/**
 * Resolves an id from `CardView.targets` against the current GameView. Cards keep their id across
 * zones in XMage, so the card a trigger refers to is found again in the graveyard, exile or any
 * other public zone (Tergrid's "that card" sits in an opponent's graveyard).
 */
export function resolveTriggerObject(game: GameView | null | undefined, id: string, names?: Map<string, string>): TriggerObject {
  const fallbackName = names?.get(id) ?? id.slice(0, 8)
  if (game) {
    for (const player of game.players ?? []) {
      if (player.playerId === id) {
        return { id, name: player.name ?? fallbackName, card: null, zone: null, ownerName: null, isPlayer: true }
      }
    }
    const zones: Array<[TriggerObjectZone, 'battlefield' | 'graveyard' | 'exile' | 'commandList']> = [
      ['battlefield', 'battlefield'], ['graveyard', 'graveyard'], ['exile', 'exile'], ['command', 'commandList'],
    ]
    for (const [zone, key] of zones) {
      for (const player of game.players ?? []) {
        const card = zoneHit(player[key], id)
        if (card) return { id, name: card.displayName ?? card.name ?? fallbackName, card, zone, ownerName: player.name ?? null, isPlayer: false }
      }
    }
    const stack = zoneHit(game.stack, id)
    if (stack) return { id, name: stack.displayName ?? stack.name ?? fallbackName, card: stack, zone: 'stack', ownerName: null, isPlayer: false }
    const hand = zoneHit(game.myHand, id)
    if (hand) {
      const me = (game.players ?? []).find((player) => player.controlled)
      return { id, name: hand.displayName ?? hand.name ?? fallbackName, card: hand, zone: 'hand', ownerName: me?.name ?? null, isPlayer: false }
    }
    const other = findCardViewInGame(game, id)?.view
    if (other) return { id, name: other.displayName ?? other.name ?? fallbackName, card: other, zone: 'other', ownerName: null, isPlayer: false }
  }
  return { id, name: fallbackName, card: null, zone: null, ownerName: null, isPlayer: false }
}

/** Every object the trigger points at, in the order the server lists them. */
export function triggerObjects(card: FeedbackCard, game: GameView | null | undefined, names?: Map<string, string>): TriggerObject[] {
  return (card.targets ?? []).map((id) => resolveTriggerObject(game, id, names))
}

/**
 * The card the trigger comes from, as fresh as possible: the live object when it is still in a
 * public zone (counters, P/T), else the `sourceCard` the server sent (last known information),
 * else the ability view itself, which already carries the source's name and printing.
 */
export function triggerSourceCard(card: FeedbackCard, game: GameView | null | undefined): CardView | PermanentView {
  const wire = card.sourceCard
  const live = wire?.id ? findCardViewInGame(game ?? null, wire.id)?.view : null
  return live ?? wire ?? (card as unknown as CardView)
}

/** Key that groups triggers of the same source: rows sharing it look alike and are told apart by their objects. */
export function triggerSourceKey(card: FeedbackCard): string {
  return card.sourceCard?.id ?? triggerDisplayName(card)
}
