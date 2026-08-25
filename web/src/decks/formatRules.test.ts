import { describe, it, expect } from 'vitest'
import {
  ALL_FORMATS,
  FORMAT_CONFIGS,
  validateDeckForFormat,
  isBasicOrUnlimited,
} from './formatRules'
import type { DeckV2 } from './types'
import type { CardStripMeta } from './ArenaCardStrip'

describe('formatRules', () => {
  it('defines all major MTG formats with complete configs', () => {
    expect(ALL_FORMATS).toContain('Standard')
    expect(ALL_FORMATS).toContain('Pioneer')
    expect(ALL_FORMATS).toContain('Modern')
    expect(ALL_FORMATS).toContain('Legacy')
    expect(ALL_FORMATS).toContain('Vintage')
    expect(ALL_FORMATS).toContain('Pauper')
    expect(ALL_FORMATS).toContain('Commander')
    expect(ALL_FORMATS).toContain('Brawl')
    expect(ALL_FORMATS).toContain('Historic')
    expect(ALL_FORMATS).toContain('Timeless')
    expect(ALL_FORMATS).toContain('Freeform')

    for (const f of ALL_FORMATS) {
      expect(FORMAT_CONFIGS[f]).toBeDefined()
      expect(FORMAT_CONFIGS[f].minMain).toBeGreaterThan(0)
    }
  })

  it('identifies basic lands and cards with unlimited copies', () => {
    expect(isBasicOrUnlimited('Plains')).toBe(true)
    expect(isBasicOrUnlimited('Snow-Covered Island')).toBe(true)
    expect(isBasicOrUnlimited('Mountain')).toBe(true)
    expect(isBasicOrUnlimited('Relentless Rats')).toBe(true)
    expect(isBasicOrUnlimited('Dragon\'s Approach')).toBe(true)
    expect(isBasicOrUnlimited('Lightning Bolt')).toBe(false)
  })

  it('validates Standard deck copy limits and deck size', () => {
    const validDeck: DeckV2 = {
      id: 'test-std',
      name: 'Mono Red Standard',
      format: 'Standard',
      cards: [
        { cardName: 'Mountain', setCode: 'LEA', cardNumber: '292', amount: 24 },
        { cardName: 'Lightning Strike', setCode: 'DMU', cardNumber: '137', amount: 4 },
        { cardName: 'Monastery Swiftspear', setCode: 'BRO', cardNumber: '144', amount: 4 },
        { cardName: 'Play with Fire', setCode: 'MID', cardNumber: '154', amount: 4 },
        { cardName: 'Kumano Faces Kakkazan', setCode: 'NEO', cardNumber: '152', amount: 4 },
        { cardName: 'Shock', setCode: 'M21', cardNumber: '159', amount: 4 },
        { cardName: 'Feldon, Ronom Excavator', setCode: 'BRO', cardNumber: '135', amount: 4 },
        { cardName: 'Squee, Dubious Monarch', setCode: 'DMU', cardNumber: '146', amount: 4 },
        { cardName: 'Charming Scoundrel', setCode: 'WOE', cardNumber: '124', amount: 4 },
        { cardName: 'Bloodthirsty Adversary', setCode: 'MID', cardNumber: '129', amount: 4 },
      ],
      sideboard: [],
      colors: ['R'],
      createdAt: Date.now(),
      updatedAt: Date.now(),
      source: 'custom',
    }

    const metaMap = new Map<string, CardStripMeta>()
    const report = validateDeckForFormat(validDeck, metaMap)
    expect(report.isValid).toBe(true)
    expect(report.issues.length).toBe(0)
  })

  it('flags exceeded copy limits in constructed formats', () => {
    const invalidDeck: DeckV2 = {
      id: 'test-illegal',
      name: '5 Bolts',
      format: 'Modern',
      cards: [
        { cardName: 'Mountain', setCode: 'LEA', cardNumber: '292', amount: 55 },
        { cardName: 'Lightning Bolt', setCode: 'M10', cardNumber: '146', amount: 5 },
      ],
      sideboard: [],
      colors: ['R'],
      createdAt: Date.now(),
      updatedAt: Date.now(),
      source: 'custom',
    }

    const report = validateDeckForFormat(invalidDeck, new Map())
    expect(report.isValid).toBe(false)
    expect(report.issues.some((i) => i.type === 'copy_limit')).toBe(true)
  })

  it('flags banned cards according to Scryfall legalities', () => {
    const bannedDeck: DeckV2 = {
      id: 'test-banned',
      name: 'Oko Modern',
      format: 'Modern',
      cards: [
        { cardName: 'Forest', setCode: 'LEA', cardNumber: '294', amount: 56 },
        { cardName: 'Oko, Thief of Crowns', setCode: 'ELD', cardNumber: '197', amount: 4 },
      ],
      sideboard: [],
      colors: ['G', 'U'],
      createdAt: Date.now(),
      updatedAt: Date.now(),
      source: 'custom',
    }

    const metaMap = new Map<string, CardStripMeta>()
    metaMap.set('ELD/197', {
      manaCost: '{1}{G}{U}',
      colors: ['G', 'U'],
      legalities: { modern: 'banned', standard: 'banned', commander: 'legal' },
    })

    const report = validateDeckForFormat(bannedDeck, metaMap)
    expect(report.isValid).toBe(false)
    expect(report.issues.some((i) => i.type === 'banned')).toBe(true)
  })

  it('validates Commander format rules (100 cards, Singleton, Color Identity)', () => {
    const monoGreenCommander: DeckV2 = {
      id: 'test-edh',
      name: 'Omnath EDH',
      format: 'Commander',
      cards: [
        { cardName: 'Omnath, Locus of Mana', setCode: 'WWK', cardNumber: '109', amount: 1 },
        { cardName: 'Forest', setCode: 'LEA', cardNumber: '294', amount: 98 },
        { cardName: 'Counterspell', setCode: 'EMA', cardNumber: '43', amount: 1 }, // Blue card in mono-green deck!
      ],
      sideboard: [],
      colors: ['G'],
      coverCard: { cardName: 'Omnath, Locus of Mana', setCode: 'WWK', cardNumber: '109', amount: 1 },
      createdAt: Date.now(),
      updatedAt: Date.now(),
      source: 'custom',
    }

    const metaMap = new Map<string, CardStripMeta>()
    metaMap.set('WWK/109', {
      manaCost: '{2}{G}',
      colors: ['G'],
      legalities: { commander: 'legal' },
    })
    metaMap.set('EMA/43', {
      manaCost: '{U}{U}',
      colors: ['U'],
      legalities: { commander: 'legal' },
    })

    const report = validateDeckForFormat(monoGreenCommander, metaMap)
    expect(report.isValid).toBe(false)
    expect(report.issues.some((i) => i.type === 'color_identity')).toBe(true)
  })

  it('allows any card in Freeform format', () => {
    const freeDeck: DeckV2 = {
      id: 'test-free',
      name: 'Anything Goes',
      format: 'Freeform',
      cards: [
        { cardName: 'Black Lotus', setCode: 'LEA', cardNumber: '232', amount: 20 },
        { cardName: 'Lightning Bolt', setCode: 'LEA', cardNumber: '161', amount: 20 },
      ],
      sideboard: [],
      colors: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
      source: 'custom',
    }

    const report = validateDeckForFormat(freeDeck, new Map())
    expect(report.isValid).toBe(true)
    expect(report.issues.length).toBe(0)
  })
})
