import type { Deck, DeckCard } from '../lobby/decks'

export type DeckFormat = 'Standard' | 'Modern' | 'Commander' | 'Freeform' | 'Brawl' | 'Historic' | 'Pioneer' | 'Legacy' | 'Vintage' | 'Pauper' | 'Timeless' | 'Oathbreaker' | 'PennyDreadfulCommander' | 'EuropeanHighlander' | 'CanadianHighlander'

export interface DeckV2 extends Deck {
  id: string
  format: DeckFormat
  colors: ('W' | 'U' | 'B' | 'R' | 'G')[]
  favorite?: boolean
  coverCard?: DeckCard
  commanderCard?: DeckCard
  partnerCard?: DeckCard
  createdAt: number
  updatedAt: number
  source: 'custom' | 'imported' | 'precon'
}

export function deckTotalCards(d: Deck): number {
  return d.cards.reduce((s, c) => s + c.amount, 0)
}
export const deckMainCount = deckTotalCards
export const deckSideCount = (d: Deck): number => d.sideboard.reduce((s, c) => s + c.amount, 0)

/**
 * Iniciales para el fallback visual cuando no hay portada. Toma las últimas
 * (hasta) 2 palabras del nombre en vez de las primeras: los mazos precon
 * empaquetados comparten un prefijo común ("Mage Web ...") y las primeras
 * 2 letras colisionaban casi siempre en "MA".
 */
export function deckInitials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean)
  if (words.length === 0) return '??'
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase()
  return words
    .slice(-2)
    .map((w) => w[0])
    .join('')
    .toUpperCase()
}

export const MAX_DECKS = 75

export function makeDeckId(): string {
  try {
    return crypto.randomUUID()
  } catch {
    return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
  }
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
