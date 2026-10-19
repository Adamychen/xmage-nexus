import type { DeckCard } from '../lobby/decks'
import type { CardStripMeta } from './ArenaCardStrip'
import type { StackColumn, StackItem } from './ArenaCardStacks'
import { categorizeCard, CARD_CATEGORY_ORDER, type CardCategory } from './cardCategory'

export function buildTypeColumns(
  cards: DeckCard[],
  metaOf: (card: DeckCard) => CardStripMeta | undefined,
  labels: Record<CardCategory, string>,
  keyPrefix = '',
): StackColumn[] {
  const groups = new Map<CardCategory, StackItem[]>()
  for (const card of cards) {
    const meta = metaOf(card)
    const category = categorizeCard(meta?.typeLine)
    const item: StackItem = { key: `${keyPrefix}${card.setCode}:${card.cardNumber}:${card.cardName}`, card, meta }
    groups.set(category, [...(groups.get(category) ?? []), item])
  }
  return CARD_CATEGORY_ORDER.flatMap((category) => {
    const items = groups.get(category)
    if (!items || items.length === 0) return []
    items.sort((a, b) => (a.meta?.cmc ?? 0) - (b.meta?.cmc ?? 0) || a.card.cardName.localeCompare(b.card.cardName))
    return [{ id: category, label: labels[category], items }]
  })
}
