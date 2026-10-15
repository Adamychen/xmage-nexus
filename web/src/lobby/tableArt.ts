import type { CardRef } from '../cards/scryfallCards'

/**
 * Decorative card art per format. The table view does not carry the creator's
 * deck, so the art is a fixed representative card for the XMage deck type
 * (`TableView.deckType`), not anything about the table itself.
 *
 * Order matters: the first matching rule wins, so commander variants (which also
 * contain "Freeform" or "Constructed") are checked before the generic formats.
 */
const FORMAT_ART: Array<{ match: RegExp; card: string }> = [
  { match: /commander|brawl|oathbreaker|tiny leaders|centurion|penny dreadful/i, card: 'Command Tower' },
  { match: /momir/i, card: 'Momir Vig, Simic Visionary' },
  { match: /limited|draft|sealed|booster/i, card: 'Serra Angel' },
  { match: /vintage|legacy|canadian highlander/i, card: 'Black Lotus' },
  { match: /pauper/i, card: 'Lightning Bolt' },
  { match: /modern/i, card: 'Snapcaster Mage' },
  { match: /pioneer|standard|historic/i, card: 'Sheoldred, the Apocalypse' },
]

export function tableArtCard(deckType?: string | null): CardRef | null {
  if (!deckType) return null
  const rule = FORMAT_ART.find((r) => r.match.test(deckType))
  return rule ? { cardName: rule.card } : null
}
