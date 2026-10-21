import { MTG_KEYWORDS } from '../data/mtgKeywords'
import type { DetectedKeyword } from '../data/keywordExtractor'
import type { CardIconLike } from './cardIconFx'

const ICON_TYPE_KEYWORD: Record<string, string> = {
  ABILITY_FLYING: 'flying',
  ABILITY_DEFENDER: 'defender',
  ABILITY_DEATHTOUCH: 'deathtouch',
  ABILITY_LIFELINK: 'lifelink',
  ABILITY_DOUBLE_STRIKE: 'double_strike',
  ABILITY_FIRST_STRIKE: 'first_strike',
  ABILITY_TRAMPLE: 'trample',
  ABILITY_HEXPROOF: 'hexproof',
  ABILITY_INFECT: 'infect',
  ABILITY_INDESTRUCTIBLE: 'indestructible',
  ABILITY_VIGILANCE: 'vigilance',
  ABILITY_REACH: 'reach',
}

const BADGE_CATEGORIES = ['combat', 'evasion', 'protection']
export const MAX_BADGES = 5

export function iconKeywordId(icon: CardIconLike): string | undefined {
  return ICON_TYPE_KEYWORD[icon.cardIconType ?? '']
}

export function mergeBadgeKeywords(
  icons: readonly CardIconLike[] | undefined,
  fromRules: readonly DetectedKeyword[],
  limit: number = MAX_BADGES,
): DetectedKeyword[] {
  const merged: DetectedKeyword[] = []
  const seen = new Set<string>()
  for (const icon of icons ?? []) {
    const id = iconKeywordId(icon)
    const kw = id ? MTG_KEYWORDS.find((k) => k.id === id) : undefined
    if (!kw || seen.has(kw.id)) continue
    seen.add(kw.id)
    merged.push({ id: kw.id, name: kw.name, icon: kw.icon, category: kw.category })
  }
  for (const kw of fromRules) {
    if (!BADGE_CATEGORIES.includes(kw.category) || seen.has(kw.id)) continue
    seen.add(kw.id)
    merged.push(kw)
  }
  return merged.slice(0, limit)
}
