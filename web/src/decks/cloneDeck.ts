import type { MetaDeckItem } from './metaDeckCatalog'
import { makeDeckId, type DeckV2 } from './types'

export function cloneDeckForEdit(d: MetaDeckItem | DeckV2): DeckV2 {
  const now = Date.now()
  return {
    ...d,
    id: makeDeckId(),
    coverCard: d.coverCard ?? d.cards[0],
    createdAt: now,
    updatedAt: now,
    source: 'custom',
  }
}
