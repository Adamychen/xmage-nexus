import type { SimpleCardView } from '../net/types'
import type { DeckCard } from '../lobby/decks'
import type { CardStripMeta } from '../decks/ArenaCardStrip'
import type { StackColumn } from '../decks/ArenaCardStacks'
import { buildStackColumns, type StackLabels } from '../decks/stackColumns'

export interface DraftPickZones {
  deck: StackColumn[]
  side: StackColumn[]
}

export function buildDraftPickZones(
  picks: SimpleCardView[],
  hiddenIds: ReadonlySet<string>,
  metaOf: (pick: SimpleCardView) => CardStripMeta | undefined,
  labels: StackLabels,
  sideLabel: string,
): DraftPickZones {
  const pickOf = new Map<DeckCard, SimpleCardView>()
  const deck: DeckCard[] = []
  const side: DeckCard[] = []
  for (const p of picks) {
    const card: DeckCard = {
      cardName: p.name || metaOf(p)?.name || '',
      setCode: p.expansionSetCode ?? '',
      cardNumber: p.cardNumber ?? '',
      amount: 1,
    }
    pickOf.set(card, p)
    if (hiddenIds.has(p.id)) side.push(card)
    else deck.push(card)
  }
  const keyOf = (card: DeckCard) => pickOf.get(card)?.id ?? ''
  const metaOfCard = (card: DeckCard) => {
    const p = pickOf.get(card)
    return p ? metaOf(p) : undefined
  }
  return {
    deck: deck.length ? buildStackColumns(deck, metaOfCard, { group: 'cmc', sort: 'cmc', labels, keyOf }) : [],
    side: side.length
      ? buildStackColumns(side, metaOfCard, { group: 'free', sort: 'cmc', labels, keyOf, singlePile: { id: 'sideboard', label: sideLabel } })
      : [],
  }
}
