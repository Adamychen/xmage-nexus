import { describe, expect, it } from 'vitest'
import { FORMAT_FAMILIES, formatDisplayName, formatFamily } from './formatFamily'
import { DEFAULT_DECK_TYPES, DEFAULT_GAME_TYPES } from './CreateTable/constants'

describe('formatFamily', () => {
  it('LBY-21: every deck type of the server catalogue belongs to exactly one known family', () => {
    for (const deckType of DEFAULT_DECK_TYPES) {
      expect(FORMAT_FAMILIES, deckType).toContain(formatFamily({ deckType }))
    }
  })

  it.each([
    ['Variant Magic - Commander', 'commander'],
    ['Variant Magic - Duel Commander', 'commander'],
    ['Variant Magic - Brawl', 'commander'],
    ['Variant Magic - Oathbreaker', 'commander'],
    ['Variant Magic - Tiny Leaders', 'commander'],
    ['Constructed - Standard', 'standard'],
    ['Constructed - Historic', 'standard'],
    ['Block Constructed - Innistrad', 'standard'],
    ['Constructed - Pioneer', 'pioneer'],
    ['Constructed - Modern', 'modern'],
    ['Constructed - Modern - No Banned List', 'modern'],
    ['Constructed - Premodern', 'eternal'],
    ['Constructed - Legacy', 'eternal'],
    ['Constructed - Old School 93/94 - Italian Rules', 'eternal'],
    ['Constructed - Pauper', 'pauper'],
    ['Limited', 'limited'],
    ['Constructed - Freeform', 'casual'],
    ['Variant Magic - Momir Basic', 'casual'],
    ['Constructed - Canadian Highlander', 'casual'],
    ['Block Constructed Custom - Star Wars', 'casual'],
  ])('LBY-21: %s is %s', (deckType, family) => {
    expect(formatFamily({ deckType })).toBe(family)
  })

  it('LBY-21: a limited table is limited whatever its deck type says, and a commander game type marks a free deck type', () => {
    expect(formatFamily({ deckType: 'Constructed - Standard', limited: true })).toBe('limited')
    expect(formatFamily({ deckType: 'Some new type', gameType: 'Commander Free For All' })).toBe('commander')
    for (const gameType of DEFAULT_GAME_TYPES) {
      expect(FORMAT_FAMILIES).toContain(formatFamily({ deckType: '', gameType: gameType.name }))
    }
  })

  it('drops the category prefix from the display name', () => {
    expect(formatDisplayName('Constructed - Modern')).toBe('Modern')
    expect(formatDisplayName('Variant Magic - Commander')).toBe('Commander')
    expect(formatDisplayName('Block Constructed Custom - Star Wars')).toBe('Star Wars')
    expect(formatDisplayName('Limited')).toBe('Limited')
  })
})
