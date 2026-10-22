import { describe, expect, it } from 'vitest'
import { render } from '@testing-library/react'
import { BasicLandAdder } from './BasicLandAdder'
import type { DeckCard } from '../lobby/decks'

describe('BasicLandAdder', () => {
  it('shows the total copies of a basic whose lines are split', () => {
    const cards: DeckCard[] = [
      { cardName: 'Mountain', setCode: 'LEA', cardNumber: '292', amount: 4 },
      { cardName: 'Mountain', setCode: 'LEA', cardNumber: '292', amount: 52 },
    ]
    const { container } = render(
      <BasicLandAdder
        cards={cards}
        metaMap={new Map()}
        format="Freeform"
        onAddLand={() => {}}
        onRemoveLand={() => {}}
        onApplySuggestedLands={() => {}}
      />,
    )
    expect(container.querySelector('.basic-land-btn-count')?.textContent).toBe('56')
  })
})
