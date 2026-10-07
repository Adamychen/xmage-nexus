import type { DeckCard } from '../lobby/decks'
import type { CardStripMeta } from '../decks/ArenaCardStrip'

export type PoolSort = 'color' | 'cmc' | 'type' | 'name'
export const POOL_SORTS: readonly PoolSort[] = ['color', 'cmc', 'type', 'name']

const COLOR_ORDER = ['W', 'U', 'B', 'R', 'G']
const TYPE_ORDER = ['Creature', 'Planeswalker', 'Instant', 'Sorcery', 'Artifact', 'Enchantment', 'Battle', 'Land']
// cards whose Scryfall data has not arrived yet go last, by name
const UNKNOWN = 1000

const isLand = (m: CardStripMeta) => /\bLand\b/.test(m.typeLine ?? '')

/** Limited building order: mono colours WUBRG, then gold, colourless, lands. */
function colorRank(m: CardStripMeta | undefined): number {
  if (!m) return UNKNOWN
  if (isLand(m)) return 8
  const colors = m.colors ?? []
  if (colors.length === 0) return 7
  if (colors.length > 1) return 6
  const i = COLOR_ORDER.indexOf(colors[0])
  return i < 0 ? 7 : i + 1
}

/** Lands after every spell: their mana value 0 is not a cost. */
function cmcRank(m: CardStripMeta | undefined): number {
  if (!m) return UNKNOWN
  return isLand(m) ? UNKNOWN - 1 : m.cmc ?? UNKNOWN - 1
}

function typeRank(m: CardStripMeta | undefined): number {
  if (!m) return UNKNOWN
  // the main type before the dash; an artifact creature is a creature
  const main = (m.typeLine ?? '').split(/\s[—-]\s/)[0]
  const i = TYPE_ORDER.findIndex((ty) => new RegExp(`\\b${ty}\\b`).test(main))
  return i < 0 ? TYPE_ORDER.length : i
}

/** A sorted copy of the pool. Ties fall back to mana value, then name. */
export function sortPool(
  cards: readonly DeckCard[],
  sort: PoolSort,
  metaOf: (card: DeckCard) => CardStripMeta | undefined,
): DeckCard[] {
  const byName = (a: DeckCard, b: DeckCard) => a.cardName.localeCompare(b.cardName, undefined, { numeric: true })
  const byCmc = (a: DeckCard, b: DeckCard) => cmcRank(metaOf(a)) - cmcRank(metaOf(b))
  const primary: Record<PoolSort, (a: DeckCard, b: DeckCard) => number> = {
    name: () => 0,
    cmc: byCmc,
    color: (a, b) => colorRank(metaOf(a)) - colorRank(metaOf(b)),
    type: (a, b) => typeRank(metaOf(a)) - typeRank(metaOf(b)),
  }
  return [...cards].sort((a, b) => primary[sort](a, b) || (sort === 'name' ? 0 : byCmc(a, b)) || byName(a, b))
}
