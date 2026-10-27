export type FormatFamily = 'commander' | 'standard' | 'pioneer' | 'modern' | 'eternal' | 'pauper' | 'limited' | 'casual'

export const FORMAT_FAMILIES: readonly FormatFamily[] = [
  'commander', 'standard', 'pioneer', 'modern', 'eternal', 'pauper', 'limited', 'casual',
]

type FamilyFields = { deckType?: string; gameType?: string; limited?: boolean }

const FAMILY_PATTERNS: Array<[FormatFamily, RegExp]> = [
  ['limited', /^limited$|\b(?:draft|sealed|jumpstart|cube)\b/i],
  ['commander', /\b(?:commander|brawl|oathbreaker|tiny leaders)\b/i],
  ['pauper', /\bpauper\b/i],
  ['eternal', /\b(?:premodern|legacy|vintage|eternal|old school)\b/i],
  ['modern', /\bmodern\b/i],
  ['pioneer', /\b(?:pioneer|explorer)\b/i],
  ['standard', /\b(?:standard|historic|frontier|extended|type 2)\b|^block constructed - /i],
]

export function formatFamily(t: FamilyFields): FormatFamily {
  if (t.limited) return 'limited'
  const deckType = t.deckType ?? ''
  for (const [family, pattern] of FAMILY_PATTERNS) {
    if (pattern.test(deckType)) return family
  }
  if (/\b(?:commander|brawl|oathbreaker|tiny leaders)\b/i.test(t.gameType ?? '')) return 'commander'
  return 'casual'
}

/** The deck type without the server's category prefix: "Constructed - Modern" → "Modern". */
export function formatDisplayName(deckType?: string): string {
  if (!deckType) return ''
  return deckType.replace(/^(?:Constructed|Variant Magic|Block Constructed(?: Custom)?) - /, '')
}
