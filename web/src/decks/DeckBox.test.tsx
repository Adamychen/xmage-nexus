import { describe, expect, it, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import { DeckBox } from './DeckBox'
import type { DeckV2 } from './types'
import { deckInitials } from './types'

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
    expect(screen.getByText('60 Total Cartas')).toBeDefined()
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
    expect(screen.getByText('30/60')).toBeDefined()
  })

  it('triggers onDoubleClick when double clicked', () => {
    const deck: DeckV2 = {
      id: 'deck-3',
      name: 'Test Deck',
      format: 'Standard',
      colors: ['R'],
      cards: [{ cardName: 'Mountain', setCode: 'DMU', cardNumber: '280', amount: 60 }],
      sideboard: [],
      createdAt: 1000,
      updatedAt: 1000,
      source: 'custom',
    }
    let dblClicked = false
    render(<DeckBox deck={deck} onDoubleClick={() => { dblClicked = true }} />)
    const box = screen.getByRole('button')
    box.dispatchEvent(new MouseEvent('dblclick', { bubbles: true }))
    expect(dblClicked).toBe(true)
  })

  it('shows distinct fallback initials for decks sharing a common name prefix', () => {
    const base = {
      colors: [] as DeckV2['colors'],
      cards: [{ cardName: 'Mountain', setCode: 'DMU', cardNumber: '280', amount: 60 }],
      sideboard: [],
      createdAt: 1000,
      updatedAt: 1000,
      source: 'precon' as const,
    }
    const starter: DeckV2 = { ...base, id: 'precon-0', name: 'Mage Web starter', format: 'Freeform' }
    const bolt: DeckV2 = { ...base, id: 'precon-1', name: 'Mage Web bolt', format: 'Freeform' }

    render(<DeckBox deck={starter} />)
    render(<DeckBox deck={bolt} />)

    // Antes del fix ambos caían en "MA" (slice(0, 2) del prefijo compartido "Mage Web").
    expect(screen.getByText('WS')).toBeDefined()
    expect(screen.getByText('WB')).toBeDefined()
    expect(screen.queryByText('MA')).toBeNull()
  })
})

describe('deckInitials', () => {
  it('takes the last two significant words instead of the shared prefix', () => {
    expect(deckInitials('Mage Web starter')).toBe('WS')
    expect(deckInitials('Mage Web bolt')).toBe('WB')
    expect(deckInitials('Mage Web AI lands')).toBe('AL')
  })

  it('falls back to the first two letters for a single-word name', () => {
    expect(deckInitials('Solo')).toBe('SO')
  })

  it('returns a placeholder for an empty name', () => {
    expect(deckInitials('')).toBe('??')
  })
})
