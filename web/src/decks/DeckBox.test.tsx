import { describe, expect, it, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import { DeckBox } from './DeckBox'
import type { DeckV2 } from './types'

describe('DeckBox', () => {
  afterEach(() => {
    cleanup()
  })

  it('renders valid deck badge when format requirements are met', () => {
    const deck: DeckV2 = {
      id: 'deck-1',
      name: 'Standard Deck',
      format: 'Standard',
      colors: ['R', 'U'],
      cards: [
        { cardName: 'Lightning Bolt', setCode: 'M10', cardNumber: '146', amount: 4 },
        { cardName: 'Mountain', setCode: 'DMU', cardNumber: '280', amount: 56 },
      ],
      sideboard: [],
      createdAt: 1000,
      updatedAt: 1000,
      source: 'custom',
    }

    render(<DeckBox deck={deck} />)
    expect(screen.getByText('Standard Deck')).toBeDefined()
    expect(screen.getByText('✓ Standard')).toBeDefined()
    expect(screen.getByText('60 cartas')).toBeDefined()
  })

  it('renders invalid badge when deck is under minimum card limit', () => {
    const deck: DeckV2 = {
      id: 'deck-2',
      name: 'Incomplete Deck',
      format: 'Modern',
      colors: ['G'],
      cards: [
        { cardName: 'Forest', setCode: 'DMU', cardNumber: '281', amount: 30 },
      ],
      sideboard: [],
      createdAt: 1000,
      updatedAt: 1000,
      source: 'custom',
    }

    render(<DeckBox deck={deck} />)
    expect(screen.getByText('Incomplete Deck')).toBeDefined()
    expect(screen.getByText('⚠️ 30/60')).toBeDefined()
  })
})
