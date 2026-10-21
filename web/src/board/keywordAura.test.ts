import { describe, expect, it } from 'vitest'
import { MTG_KEYWORDS } from '../data/mtgKeywords'
import { AURA_KEYWORDS, auraKeyframes, dominantAuraKeyword, gainedKeywordIds } from './keywordAura'

describe('dominantAuraKeyword', () => {
  it('returns null for an empty list', () => {
    expect(dominantAuraKeyword([])).toBeNull()
  })

  it('returns null when no id is an aura keyword', () => {
    expect(dominantAuraKeyword(['reach', 'vigilance', 'menace'])).toBeNull()
  })

  it('picks the aura keyword present', () => {
    expect(dominantAuraKeyword(['flying', 'hexproof'])).toBe('hexproof')
  })

  it('ranks trample above haste', () => {
    expect(dominantAuraKeyword(['haste', 'trample'])).toBe('trample')
  })

  it('ranks indestructible above deathtouch and flying', () => {
    expect(dominantAuraKeyword(['indestructible', 'deathtouch', 'flying'])).toBe('indestructible')
  })

  it('does not treat hexproof_from_black as hexproof', () => {
    expect(dominantAuraKeyword(['hexproof_from_black'])).toBeNull()
  })
})

describe('auraKeyframes', () => {
  it('names the keyframes after the Pascal-cased keyword', () => {
    expect(auraKeyframes('flying')).toBe('kwAuraFlying')
    expect(auraKeyframes('lifelink')).toBe('kwAuraLifelink')
  })
})

describe('AURA_KEYWORDS', () => {
  it('only lists keywords the keyword catalogue knows', () => {
    const catalogue = new Set(MTG_KEYWORDS.map((k) => k.id))
    for (const id of AURA_KEYWORDS) {
      expect(catalogue.has(id), `${id} missing from MTG_KEYWORDS`).toBe(true)
    }
  })
})

describe('gainedKeywordIds', () => {
  it('reports every id on the first appearance', () => {
    expect(gainedKeywordIds([], ['flying'])).toEqual(['flying'])
  })

  it('reports only the ids that were not there before', () => {
    expect(gainedKeywordIds(['flying'], ['flying', 'trample'])).toEqual(['trample'])
  })

  it('reports nothing when ids are lost', () => {
    expect(gainedKeywordIds(['flying'], [])).toEqual([])
  })

  it('ignores blank ids', () => {
    expect(gainedKeywordIds([''], ['', 'haste'])).toEqual(['haste'])
  })
})
