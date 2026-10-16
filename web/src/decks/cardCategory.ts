export type CardCategory = 'creatures' | 'planeswalkers' | 'instants' | 'sorceries' | 'enchantments' | 'artifacts' | 'lands' | 'other'

export const CARD_CATEGORY_ORDER: readonly CardCategory[] = ['creatures', 'planeswalkers', 'instants', 'sorceries', 'artifacts', 'enchantments', 'lands', 'other']

export function categorizeCard(typeLine?: string): CardCategory {
  if (!typeLine) return 'other'
  const tl = typeLine.toLowerCase()
  if (tl.includes('creature') || tl.includes('criatura')) return 'creatures'
  if (tl.includes('planeswalker')) return 'planeswalkers'
  if (tl.includes('instant') || tl.includes('instantáneo')) return 'instants'
  if (tl.includes('sorcery') || tl.includes('conjuro')) return 'sorceries'
  if (tl.includes('enchantment') || tl.includes('encantamiento')) return 'enchantments'
  if (tl.includes('artifact') || tl.includes('artefacto')) return 'artifacts'
  if (tl.includes('land') || tl.includes('tierra')) return 'lands'
  return 'other'
}
