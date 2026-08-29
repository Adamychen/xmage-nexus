import { describe, expect, it } from 'vitest'
import {
  cmcFromManaCost,
  colorsFromManaCost,
  countManaPips,
  suggestBasicLands,
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
})
