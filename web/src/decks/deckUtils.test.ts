import { describe, expect, it } from 'vitest'
import {
  cmcFromManaCost,
  colorsFromManaCost,
  countManaPips,
  suggestBasicLands,
  basicLandKind,
  isManaSourceCard,
  isPartnerCard,
  commanderCardsFor,
} from './deckUtils'
import type { DeckCard } from '../lobby/decks'

describe('deckUtils basic calculations', () => {
  it('computes cmc and colors correctly', () => {
    expect(cmcFromManaCost('{1}{U}{U}')).toBe(3)
    expect(cmcFromManaCost('{2}{R/G}')).toBe(3)
    expect(cmcFromManaCost('{W/P}')).toBe(1)
    expect(cmcFromManaCost('{X}{2}{B}')).toBe(3)

    expect(colorsFromManaCost('{1}{U}{B}')).toEqual(['U', 'B'])
    expect(colorsFromManaCost('{G}{G}')).toEqual(['G'])
  })

  it('counts mana pips from deck cards excluding lands', () => {
    const cards: DeckCard[] = [
      { cardName: 'Counterspell', setCode: 'EMA', cardNumber: '43', amount: 4 },
      { cardName: 'Lightning Bolt', setCode: 'M10', cardNumber: '146', amount: 4 },
      { cardName: 'Steam Vents', setCode: 'GRN', cardNumber: '257', amount: 4 },
    ]

    const metaMap = new Map([
      ['EMA/43', { manaCost: '{U}{U}', typeLine: 'Instant' }],
      ['M10/146', { manaCost: '{R}', typeLine: 'Instant' }],
      ['GRN/257', { manaCost: '', typeLine: 'Land — Island Mountain' }],
    ])

    const pips = countManaPips(cards, metaMap)
    expect(pips.U).toBe(8) // 4 * 2 = 8
    expect(pips.R).toBe(4) // 4 * 1 = 4
    expect(pips.W).toBe(0)
    expect(pips.B).toBe(0)
    expect(pips.G).toBe(0)
  })

  it('suggests basic lands proportionally', () => {
    const pips = { W: 0, U: 8, B: 0, R: 4, G: 0 } // 2:1 ratio U to R
    const suggested = suggestBasicLands(pips, 24)

    expect(suggested).toHaveLength(2)
    const islands = suggested.find((l) => l.name === 'Island')
    const mountains = suggested.find((l) => l.name === 'Mountain')

    expect(islands?.amount).toBe(16)
    expect(mountains?.amount).toBe(8)
    expect((islands?.amount ?? 0) + (mountains?.amount ?? 0)).toBe(24)
  })

  it('handles single color mana base suggestion', () => {
    const pips = { W: 0, U: 0, B: 0, R: 12, G: 0 }
    const suggested = suggestBasicLands(pips, 20)

    expect(suggested).toHaveLength(1)
    expect(suggested[0].name).toBe('Mountain')
    expect(suggested[0].amount).toBe(20)
  })

  it('handles empty pips gracefully', () => {
    const pips = { W: 0, U: 0, B: 0, R: 0, G: 0 }
    expect(suggestBasicLands(pips, 20)).toEqual([])
  })

  it('normalizes basic lands in all supported languages', async () => {
    const { normalizeBasicLandName, getBasicLandLabel } = await import('./deckUtils')
    expect(normalizeBasicLandName('Montaña')).toBe('Mountain')
    expect(normalizeBasicLandName('Plaine')).toBe('Plains')
    expect(normalizeBasicLandName('Insel')).toBe('Island')
    expect(normalizeBasicLandName('Foresta')).toBe('Forest')
    expect(normalizeBasicLandName('Pântano')).toBe('Swamp')
    expect(normalizeBasicLandName('Гора')).toBe('Mountain')
    expect(normalizeBasicLandName('島')).toBe('Island')
    expect(normalizeBasicLandName('沼泽')).toBe('Swamp')
    expect(normalizeBasicLandName('Counterspell')).toBeNull()

    expect(getBasicLandLabel('Mountain', 'es')).toBe('Montaña')
    expect(getBasicLandLabel('Island', 'ja')).toBe('島')
    expect(getBasicLandLabel('Forest', 'de')).toBe('Wald')
    expect(getBasicLandLabel('Plains', 'fr')).toBe('Plaine')
  })

  it('classifies basic lands in 9 languages (U6-2)', () => {
    expect(basicLandKind('Mountain')).toBe('Mountain')
    expect(basicLandKind('Montaña')).toBe('Mountain')
    expect(basicLandKind('山')).toBe('Mountain')
    expect(basicLandKind('Yermos')).toBe('Wastes')
    expect(basicLandKind('Steam Vents')).toBeNull()
    expect(basicLandKind('Lightning Bolt')).toBeNull()
  })

  it('detects mana sources: lands plus mana-ability text (U6-2)', () => {
    expect(isManaSourceCard('Land', undefined)).toBe(true)
    expect(isManaSourceCard('Basic Land — Forest', undefined)).toBe(true)
    expect(isManaSourceCard('Artifact', '{T}: Add {C}.')).toBe(true)
    expect(isManaSourceCard('Creature — Elf Druid', '{T}: Add {G}.')).toBe(true)
    expect(isManaSourceCard('Creature — Goblin Scout', 'Haste')).toBe(false)
    expect(isManaSourceCard('Instant', 'Lightning Bolt deals 3 damage.')).toBe(false)
    expect(isManaSourceCard('Sorcery', 'Search your library for a basic land card.')).toBe(false)
    expect(isManaSourceCard(undefined, undefined)).toBe(false)
  })

  it('detects Partner from keywords or oracle text (U7-7)', () => {
    expect(isPartnerCard({ keywords: ['Partner'] })).toBe(true)
    expect(isPartnerCard({ keywords: ['Partner with Akroma'] })).toBe(true)
    expect(isPartnerCard({ oracleText: 'Partner (You can have two commanders …)' })).toBe(true)
    expect(isPartnerCard({ oracleText: 'Flying' })).toBe(false)
    expect(isPartnerCard(undefined)).toBe(false)
    expect(isPartnerCard(null)).toBe(false)
  })

  it('returns one commander normally, two with Partner (U7-7)', () => {
    const atraxa = { cardName: "Atraxa, Praetors' Voice", setCode: 'C16', cardNumber: '28', amount: 1 }
    const solRing = { cardName: 'Sol Ring', setCode: 'C16', cardNumber: '264', amount: 1 }
    const sidar = { cardName: 'Sidar Kondo of Jamuraa', setCode: 'PC2', cardNumber: '1', amount: 1 }
    const tana = { cardName: 'Tana, the Bloodsower', setCode: 'C16', cardNumber: '56', amount: 1 }
    const noMeta = new Map()
    expect(commanderCardsFor([atraxa, solRing], atraxa, noMeta)).toEqual([atraxa])
    expect(commanderCardsFor([solRing, atraxa], null, noMeta)).toEqual([solRing])
    expect(commanderCardsFor([], null, noMeta)).toEqual([])
    const partnerMeta = new Map([
      ['PC2/1', { keywords: ['Partner'] }],
      ['sidar kondo of jamuraa', { keywords: ['Partner'] }],
      ['C16/56', { oracleText: 'Partner (You can have two commanders if both have partner.)' }],
      ['tana, the bloodsower', { oracleText: 'Partner (You can have two commanders if both have partner.)' }],
    ])
    expect(commanderCardsFor([sidar, tana, solRing], sidar, partnerMeta)).toEqual([sidar, tana])
  })
})
