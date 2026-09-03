import { describe, expect, it, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import CurveChart from './CurveChart'
import type { DeckCard } from '../lobby/decks'
import type { CardStripMeta } from './ArenaCardStrip'

describe('CurveChart', () => {
  afterEach(() => {
    cleanup()
  })

  it('separates lands from spell mana curve and computes statistics', () => {
    const cards: DeckCard[] = [
      { cardName: 'Mountain', setCode: 'DMU', cardNumber: '280', amount: 20 },
      { cardName: 'Goblin Guide', setCode: 'ZEN', cardNumber: '126', amount: 4 },
      { cardName: 'Lightning Bolt', setCode: 'M10', cardNumber: '146', amount: 4 },
      { cardName: 'Eidolon of the Great Revel', setCode: 'JOU', cardNumber: '94', amount: 4 },
    ]

    const meta = new Map<string, CardStripMeta>([
      ['ZEN/126', {
        artCropUrl: null,
        imageUrl: null,
        backImageUrl: null,
        manaCost: '{R}',
        cmc: 1,
        typeLine: 'Creature — Goblin Scout',
        colors: ['R'],
      }],
      ['M10/146', {
        artCropUrl: null,
        imageUrl: null,
        backImageUrl: null,
        manaCost: '{R}',
        cmc: 1,
        typeLine: 'Instant',
        colors: ['R'],
      }],
      ['JOU/94', {
        artCropUrl: null,
        imageUrl: null,
        backImageUrl: null,
        manaCost: '{R}{R}',
        cmc: 2,
        typeLine: 'Enchantment Creature — Spirit',
        colors: ['R'],
      }],
    ])

    render(<CurveChart cards={cards} meta={meta} />)

    // Lands should not be in CMC 0 bar; 20 lands reported
    expect(screen.getByText('20')).toBeDefined()
    // Creatures = 4 Goblin + 4 Eidolon = 8
    expect(screen.getAllByText('8').length).toBeGreaterThanOrEqual(1)
    // Spells = 4 Lightning Bolt = 4
    expect(screen.getAllByText('4').length).toBeGreaterThanOrEqual(1)
    // Avg CMC = (4*1 + 4*1 + 4*2) / 12 = 16 / 12 = 1.3
    expect(screen.getByText('1.3')).toBeDefined()
    // 16 {R} mana symbols
    expect(screen.getByText('16')).toBeDefined()
  })
})
