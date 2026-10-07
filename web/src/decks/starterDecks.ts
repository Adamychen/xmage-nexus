import { META_DECK_CATALOG, type MetaDeckItem } from './metaDeckCatalog'
import { cloneDeckForEdit } from './cloneDeck'
import { getDeckStorage } from './storage'
import type { DeckFormat, DeckV2 } from './types'

export const STARTER_DECK_IDS = ['meta-mod-burn', 'meta-pio-mono-white-humans', 'meta-edh-krenko'] as const

const VALIDATED_FORMAT: Partial<Record<string, DeckFormat>> = { 'meta-pio-mono-white-humans': 'Modern' }

export function starterDeckItems(): MetaDeckItem[] {
  return STARTER_DECK_IDS.map((id) => {
    const item = META_DECK_CATALOG.find((d) => d.id === id)
    if (!item) throw new Error(`starter deck ${id} is not in the catalog`)
    return item
  })
}

export async function addStarterDecks(): Promise<DeckV2[]> {
  const storage = getDeckStorage()
  const decks = starterDeckItems().map((item) => {
    const deck = { ...cloneDeckForEdit(item), format: VALIDATED_FORMAT[item.id] ?? item.format }
    return item.format === 'Commander' ? { ...deck, commanderCard: item.cards[0] } : deck
  })
  for (const deck of decks) await storage.put(deck)
  return decks
}
