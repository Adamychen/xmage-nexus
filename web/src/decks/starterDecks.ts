import { META_DECK_CATALOG, type MetaDeckItem } from './metaDeckCatalog'
import { cloneDeckForEdit } from './cloneDeck'
import { getDeckStorage } from './storage'
import type { DeckV2 } from './types'

export const STARTER_DECK_IDS = ['meta-mod-burn', 'meta-pio-mono-white-humans'] as const

export function starterDeckItems(): MetaDeckItem[] {
  return STARTER_DECK_IDS.map((id) => {
    const item = META_DECK_CATALOG.find((d) => d.id === id)
    if (!item) throw new Error(`starter deck ${id} is not in the catalog`)
    return item
  })
}

export async function addStarterDecks(): Promise<DeckV2[]> {
  const storage = getDeckStorage()
  const decks = starterDeckItems().map(cloneDeckForEdit)
  for (const deck of decks) await storage.put(deck)
  return decks
}
