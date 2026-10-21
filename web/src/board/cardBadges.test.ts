import { describe, expect, it } from 'vitest'
import { MTG_KEYWORDS } from '../data/mtgKeywords'
import { iconKeywordId, mergeBadgeKeywords } from './cardBadges'

describe('card badge glyphs', () => {
  it('maps every server ability icon to a keyword that exists', () => {
    for (const type of ['FLYING', 'DEFENDER', 'DEATHTOUCH', 'LIFELINK', 'DOUBLE_STRIKE', 'FIRST_STRIKE', 'TRAMPLE', 'HEXPROOF', 'INFECT', 'INDESTRUCTIBLE', 'VIGILANCE', 'REACH']) {
      const id = iconKeywordId({ cardIconType: `ABILITY_${type}` })
      expect(MTG_KEYWORDS.some((k) => k.id === id), type).toBe(true)
    }
  })

  it('merges server icons and rules keywords without duplicates', () => {
    const fromRules = [
      { id: 'flying', name: 'Flying', icon: '', category: 'evasion' as const },
      { id: 'menace', name: 'Menace', icon: '', category: 'evasion' as const },
      { id: 'scry', name: 'Scry', icon: '', category: 'mechanic' as const },
    ]
    const merged = mergeBadgeKeywords([{ cardIconType: 'ABILITY_FLYING' }], fromRules)
    expect(merged.map((k) => k.id)).toEqual(['flying', 'menace'])
  })
})
