import type { Deck, DeckCard } from '../lobby/decks'

export type DeckFormat = 'Standard' | 'Modern' | 'Commander' | 'Freeform' | 'Brawl' | 'Historic' | 'Pioneer' | 'Legacy' | 'Vintage' | 'Pauper'

export interface DeckV2 extends Deck {
  id: string
  format: DeckFormat
  colors: ('W' | 'U' | 'B' | 'R' | 'G')[]
  favorite?: boolean
  coverCard?: DeckCard
  createdAt: number
  updatedAt: number
  source: 'custom' | 'imported' | 'precon'
}

export function deckTotalCards(d: Deck): number {
  return d.cards.reduce((s, c) => s + c.amount, 0)
}
export function deckSideboardCount(d: Deck): number {
  return d.sideboard.reduce((s, c) => s + c.amount, 0)
}
export const deckMainCount = deckTotalCards
export const deckSideCount = deckSideboardCount
export function deckColorIdentity(_cards: DeckCard[]): ('W' | 'U' | 'B' | 'R' | 'G')[] {
  return []
}

export const MAX_DECKS = 75
export const MAX_SIDEBOARD = 15

export function makeDeckId(): string {
  try {
    return crypto.randomUUID()
  } catch {
    return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
  }
}

export function toDeckV2(deck: Deck, source: DeckV2['source'] = 'custom'): DeckV2 {
  const now = Date.now()
  return {
    ...deck,
    id: makeDeckId(),
    format: inferFormat(deck),
    colors: colorIdentityFromCards(deck.cards),
    coverCard: deck.cards[0],
    createdAt: now,
    updatedAt: now,
    source,
  }
}

export function inferFormat(deck: Deck): DeckFormat {
  const n = deckTotalCards(deck)
  if (n >= 99) return 'Commander'
  return 'Freeform'
}

export function colorIdentityFromCards(_cards: DeckCard[]): ('W' | 'U' | 'B' | 'R' | 'G')[] {
  return []
}

export function deckIsValidForPlay(d: Deck): { ok: boolean; reason?: string } {
  const main = deckTotalCards(d)
  const sb = deckSideboardCount(d)
  if (main < 60) return { ok: false, reason: `Mazo principal ${main}/60` }
  if (sb > 15) return { ok: false, reason: `Banquillo ${sb}/15 excedido` }
  return { ok: true }
}
