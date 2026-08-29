import { describe, expect, it, vi, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import {
  SampleHandModal,
  buildDeckInstances,
  shuffleDeck,
} from './SampleHandModal'
import type { DeckCard } from '../lobby/decks'
import type { CardStripMeta } from './ArenaCardStrip'

describe('SampleHandModal functions', () => {
  afterEach(() => {
    cleanup()
  })

  const cards: DeckCard[] = [
    { cardName: 'Lightning Bolt', setCode: 'M10', cardNumber: '146', amount: 4 },
    { cardName: 'Mountain', setCode: 'LEA', cardNumber: '292', amount: 20 },
  ]
  const metaMap = new Map<string, CardStripMeta>([
    ['M10/146', { manaCost: '{R}', typeLine: 'Instant' }],
    ['LEA/292', { manaCost: '', typeLine: 'Basic Land — Mountain' }],
  ])

  it('builds individual card instances correctly', () => {
    const instances = buildDeckInstances(cards, metaMap)
    expect(instances).toHaveLength(24)
    expect(instances.filter((c) => c.isLand)).toHaveLength(20)
    expect(instances.filter((c) => !c.isLand)).toHaveLength(4)
  })

  it('shuffles deck preserving total card count', () => {
    const instances = buildDeckInstances(cards, metaMap)
    const shuffled = shuffleDeck(instances)
    expect(shuffled).toHaveLength(24)
  })

  it('renders SampleHandModal and draws opening hand of 7 cards', () => {
    const onClose = vi.fn()
    render(
      <SampleHandModal
        deckName="Burn Deck"
        cards={cards}
        metaMap={metaMap}
        onClose={onClose}
      />
    )

    expect(screen.getByText('🖐️ Simulador de Mano Inicial')).toBeDefined()
    expect(screen.getByText('Burn Deck')).toBeDefined()
    expect(screen.getByText(/Cartas:\s*7/)).toBeDefined()
    expect(screen.getByText(/Biblioteca:\s*17/)).toBeDefined()
  })

  it('allows drawing cards and taking mulligans', () => {
    const onClose = vi.fn()
    render(
      <SampleHandModal
        deckName="Burn Deck"
        cards={cards}
        metaMap={metaMap}
        onClose={onClose}
      />
    )

    const drawBtn = screen.getByRole('button', { name: /Robar Carta/ })
    fireEvent.click(drawBtn)
    expect(screen.getByText(/Cartas:\s*8/)).toBeDefined()
    expect(screen.getByText(/Biblioteca:\s*16/)).toBeDefined()

    const mulliganBtn = screen.getByRole('button', { name: /Mulligan/ })
    fireEvent.click(mulliganBtn)
    expect(screen.getByText(/London Mulligan \(1\)/)).toBeDefined()
  })
})
