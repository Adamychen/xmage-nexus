import { describe, expect, it } from 'vitest'
import type { CardView } from '../net/types'
import { artCropUrl, cardAspectFor, manaSourceSymbols, normalizeCardStyle, normalizeTapStyle, primaryCardType } from './compactCard'

const card = (over: Partial<CardView>): CardView =>
  ({ id: 'c1', name: 'X', manaValue: 0, expansionSetCode: 'DMU', cardNumber: '1', ...over }) as CardView

describe('artCropUrl', () => {
  it('rewrites Scryfall CDN image sizes to the art crop', () => {
    expect(artCropUrl('https://cards.scryfall.io/normal/front/6/d/6da0.jpg?1562')).toBe(
      'https://cards.scryfall.io/art_crop/front/6/d/6da0.jpg?1562',
    )
    expect(artCropUrl('https://cards.scryfall.io/small/back/a/b/ab.jpg')).toBe(
      'https://cards.scryfall.io/art_crop/back/a/b/ab.jpg',
    )
  })

  it('returns null for images it cannot crop', () => {
    expect(artCropUrl('https://img.test/art.jpg')).toBeNull()
    expect(artCropUrl('https://cards.scryfall.io/png/front/a/b/ab.png')).toBeNull()
    expect(artCropUrl(null)).toBeNull()
  })
})

describe('manaSourceSymbols', () => {
  it('reads the colors from the Add clauses of the rules', () => {
    expect(manaSourceSymbols(card({ rules: ['{T}: Add {G}.'] }))).toEqual(['G'])
    expect(manaSourceSymbols(card({ rules: ['{T}: Add {R} or {B}.', '{T}: Add {C}.'] }))).toEqual(['B', 'R', 'C'])
  })

  it('collapses "any color" to a single ANY symbol', () => {
    expect(manaSourceSymbols(card({ rules: ['{T}: Add one mana of any color.'] }))).toEqual(['ANY'])
  })

  it('uses basic land types when the rules do not list the ability', () => {
    expect(manaSourceSymbols(card({ subTypes: ['FOREST', 'ISLAND'] }))).toEqual(['U', 'G'])
  })

  it('is empty for non-sources', () => {
    expect(manaSourceSymbols(card({ rules: ['Flying', 'Put a +1/+1 counter on target creature.'] }))).toEqual([])
    expect(manaSourceSymbols(card({}))).toEqual([])
  })
})

describe('primaryCardType', () => {
  it('prefers creature over artifact and falls back to null for untranslated types', () => {
    expect(primaryCardType(card({ cardTypes: ['ARTIFACT', 'CREATURE'] }))).toBe('creature')
    expect(primaryCardType(card({ cardTypes: ['LAND'] }))).toBe('land')
    expect(primaryCardType(card({ cardTypes: ['KINDRED'] }))).toBeNull()
  })
})

describe('card style', () => {
  it('normalizes unknown values to classic and maps each style to its aspect', () => {
    expect(normalizeCardStyle('compact')).toBe('compact')
    expect(normalizeCardStyle('weird')).toBe('classic')
    expect(normalizeCardStyle(undefined)).toBe('classic')
    expect(cardAspectFor('classic')).toBe(1.4)
    expect(cardAspectFor('compact')).toBeLessThan(1)
  })
})

describe('tap style', () => {
  it('defaults to sideways and keeps tilted', () => {
    expect(normalizeTapStyle('tilted')).toBe('tilted')
    expect(normalizeTapStyle('sideways')).toBe('sideways')
    expect(normalizeTapStyle(42)).toBe('sideways')
  })
})
