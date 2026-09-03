import type { Deck, DeckCard } from '../lobby/decks'
import { t } from '../i18n'

export type DeckFormat = 'Standard' | 'Modern' | 'Commander' | 'Freeform' | 'Brawl' | 'Historic' | 'Pioneer' | 'Legacy' | 'Vintage' | 'Pauper' | 'Timeless'

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
export function deckColorIdentity(cards: DeckCard[]): ('W' | 'U' | 'B' | 'R' | 'G')[] {
  return colorIdentityFromCards(cards)
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

export function colorIdentityFromCards(cards: DeckCard[]): ('W' | 'U' | 'B' | 'R' | 'G')[] {
  const set = new Set<'W' | 'U' | 'B' | 'R' | 'G'>()
  for (const c of cards) {
    const n = c.cardName.toLowerCase()
    if (n.includes('island') || n.includes('isla')) set.add('U')
    if (n.includes('mountain') || n.includes('montaña')) set.add('R')
    if (n.includes('plains') || n.includes('llanura')) set.add('W')
    if (n.includes('swamp') || n.includes('pantano')) set.add('B')
    if (n.includes('forest') || n.includes('bosque')) set.add('G')
    if (n.includes('bolt') || n.includes('blaze')) set.add('R')
    if (n.includes('charm') || n.includes('counterspell') || n.includes('ponder') || n.includes('brainstorm')) {
      if (n.includes('charm')) { set.add('R'); set.add('W') }
      if (n.includes('counterspell')) { set.add('U') }
    }
  }
  return [...set].sort()
}

export function deckIsValidForPlay(d: Deck): { ok: boolean; reason?: string } {
  const main = deckTotalCards(d)
  const sb = deckSideboardCount(d)
  if (main < 60) return { ok: false, reason: `${t('decks', 'total_cards')} ${main}/60` }
  if (sb > 15) return { ok: false, reason: `${t('decks', 'sideboard')} ${sb}/15` }
  return { ok: true }
}
