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
    expect(screen.getAllByText('20').length).toBeGreaterThanOrEqual(1)
    // Creatures = 4 Goblin + 4 Eidolon = 8
    expect(screen.getAllByText('8').length).toBeGreaterThanOrEqual(1)
    // Spells = 4 Lightning Bolt = 4
    expect(screen.getAllByText('4').length).toBeGreaterThanOrEqual(1)
    // Avg CMC = (4*1 + 4*1 + 4*2) / 12 = 16 / 12 = 1.3
    expect(screen.getByText('1.3')).toBeDefined()
    // 16 {R} mana symbols
    expect(screen.getByText('16')).toBeDefined()
  })

  it('renders the Mana Analyser sections: sources, basics and distribution (U6-2)', () => {
    const cards: DeckCard[] = [
      { cardName: 'Mountain', setCode: 'DMU', cardNumber: '280', amount: 20 },
      { cardName: 'Llanura', setCode: 'DMU', cardNumber: '277', amount: 4 },
      { cardName: 'Steam Vents', setCode: 'GRN', cardNumber: '257', amount: 4 },
      { cardName: 'Sol Ring', setCode: 'C21', cardNumber: '264', amount: 1 },
      { cardName: 'Lightning Bolt', setCode: 'M10', cardNumber: '146', amount: 4 },
    ]

    const meta = new Map<string, CardStripMeta>([
      ['DMU/280', { artCropUrl: null, imageUrl: null, backImageUrl: null, manaCost: '', cmc: 0, typeLine: 'Basic Land — Mountain', colors: [] }],
      ['DMU/277', { artCropUrl: null, imageUrl: null, backImageUrl: null, manaCost: '', cmc: 0, typeLine: 'Basic Land — Plains', colors: [] }],
      ['GRN/257', { artCropUrl: null, imageUrl: null, backImageUrl: null, manaCost: '', cmc: 0, typeLine: 'Land — Island Mountain', colors: [] }],
      ['C21/264', { artCropUrl: null, imageUrl: null, backImageUrl: null, manaCost: '{1}', cmc: 1, typeLine: 'Artifact', colors: [], oracleText: '{T}: Add {C}{C}.' }],
      ['M10/146', { artCropUrl: null, imageUrl: null, backImageUrl: null, manaCost: '{R}', cmc: 1, typeLine: 'Instant', colors: ['R'], oracleText: 'Lightning Bolt deals 3 damage to any target.' }],
    ])

    render(<CurveChart cards={cards} meta={meta} />)

    // sources: 28 lands + 1 Sol Ring = 29
    expect(screen.getByText(/Mana sources|Fuentes de maná/i)).toBeDefined()
    expect(screen.getByText(/· 29/)).toBeDefined()
    // basics: 20 Mountain + 4 Plains = 24, nonbasic = 4 Steam Vents
    expect(screen.getByText(/Basic lands|Tierras básicas/i)).toBeDefined()
    expect(screen.getByText(/· 24/)).toBeDefined()
    // distribution section present
    expect(screen.getByText(/Mana by cost|Maná por coste/i)).toBeDefined()
  })
})
