import { describe, expect, it, beforeEach } from 'vitest'
import { rememberPrints, resetSeenPrints, seenPrintOf } from './seenPrints'
import { cardKey, resetCardImageCache } from './cardImages'
import type { CardView, GameView } from '../net/types'

const card = (over: Partial<CardView>): CardView => ({ name: 'The Warring Triad', manaValue: 0, expansionSetCode: '', cardNumber: '0', ...over }) as CardView

const table = (over: Partial<CardView> = {}): GameView =>
  ({
    players: [
      {
        playerId: 'p1',
        battlefield: { triad: card({ id: 'triad', expansionSetCode: 'FIC', cardNumber: '193', ...over }) },
      },
    ],
  }) as unknown as GameView

describe('CRD-10: the printing a card was seen with on the table', () => {
  beforeEach(() => {
    resetSeenPrints()
    resetCardImageCache()
  })

  it('CRD-10: remembers it by id and by name, and ignores what carries none', () => {
    rememberPrints(table())
    expect(seenPrintOf(card({ id: 'triad' }))).toBe('FIC/193')
    expect(seenPrintOf(card({ id: 'another-id' }))).toBe('FIC/193')
    expect(seenPrintOf(card({ id: 'x', name: 'Someone Else' }))).toBeNull()
  })

  it('CRD-10: a face-down card or a token teaches nothing', () => {
    rememberPrints(table({ faceDown: true }))
    expect(seenPrintOf(card({ id: 'triad' }))).toBeNull()
    resetSeenPrints()
    rememberPrints(table({ isToken: true }))
    expect(seenPrintOf(card({ id: 'triad' }))).toBeNull()
  })

  it("CRD-10: a trigger with no printing is drawn as its source is on the table, not by name", () => {
    const trigger = card({
      id: 'trg-1',
      name: 'Ability',
      mageObjectType: 'ABILITY_STACK_FROM_CARD',
      sourceCard: card({ id: 'triad', name: 'The Warring Triad' }) as never,
    })
    // Before the table has been seen there is nothing better than the name.
    expect(cardKey(trigger)).toBe('named:The Warring Triad')
    rememberPrints(table())
    expect(cardKey(trigger)).toBe('FIC/193')
  })

  it('CRD-10: a card that carries its own printing keeps it, table or no table', () => {
    rememberPrints(table())
    expect(cardKey(card({ id: 'other', expansionSetCode: 'MH3', cardNumber: '107' }))).toBe('MH3/107')
  })
})
