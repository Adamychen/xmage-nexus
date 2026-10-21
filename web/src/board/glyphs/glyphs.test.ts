import { describe, expect, it } from 'vitest'
import { MTG_KEYWORDS } from '../../data/mtgKeywords'
import { GLYPH_GROUPS, resolveKeywordGlyph, resolvableKeywordIds } from './index'

describe('keyword glyph registry', () => {
  it('draws a glyph or an abbreviation for every keyword, never the category fallback', () => {
    const missing = MTG_KEYWORDS.filter((k) => resolveKeywordGlyph(k.id, k.category).kind === 'fallback').map((k) => k.id)
    expect(missing).toEqual([])
    expect(resolvableKeywordIds()).toHaveLength(MTG_KEYWORDS.length)
  })

  it('writes every abbreviation as exactly two letters', () => {
    for (const [name, group] of Object.entries(GLYPH_GROUPS)) {
      for (const [id, text] of Object.entries(group.abbreviations)) {
        expect(text, `${name}/${id}`).toMatch(/^[A-Za-z]{2}$/)
      }
    }
  })

  it('never defines an id as both a glyph and an abbreviation in one group', () => {
    for (const [name, group] of Object.entries(GLYPH_GROUPS)) {
      for (const id of Object.keys(group.glyphs)) {
        expect(group.abbreviations[id], `${name}/${id}`).toBeUndefined()
      }
    }
  })

  it('defines every id in a single group', () => {
    const owner = new Map<string, string>()
    for (const [name, group] of Object.entries(GLYPH_GROUPS)) {
      for (const id of [...Object.keys(group.glyphs), ...Object.keys(group.abbreviations)]) {
        expect(owner.get(id), `${id} is in ${owner.get(id)} and ${name}`).toBeUndefined()
        owner.set(id, name)
      }
    }
  })

  it('gives every drawn glyph at least one node', () => {
    for (const [name, group] of Object.entries(GLYPH_GROUPS)) {
      for (const [id, nodes] of Object.entries(group.glyphs)) {
        expect(nodes.length, `${name}/${id}`).toBeGreaterThan(0)
      }
    }
  })
})
