import { describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { DeckInspectorModal } from './DeckInspectorModal'
import type { DeckV2 } from './types'

const deck = (): DeckV2 => ({
  id: 'c1',
  name: 'Mi Burn',
  format: 'Freeform',
  colors: ['R'],
  cards: [
    { cardName: 'Lightning Bolt', setCode: 'M10', cardNumber: '146', amount: 4 },
    { cardName: 'Mountain', setCode: 'LEA', cardNumber: '292', amount: 20 },
  ],
  sideboard: [],
  createdAt: 1,
  updatedAt: 2,
  source: 'custom',
}) as DeckV2

describe('DeckInspectorModal cover (gallery polish)', () => {
  it('ofrece las cartas como portada y avisa al elegir', () => {
    const onSelectCover = vi.fn()
    render(
      <DeckInspectorModal
        deck={deck()}
        onClose={() => {}}
        onCopy={() => {}}
        onEdit={() => {}}
        onSelectCover={onSelectCover}
      />,
    )
    const first = screen.getByTestId('inspector-cover-0')
    expect(first.getAttribute('aria-pressed')).not.toBeNull()
    fireEvent.click(screen.getByTestId('inspector-cover-1'))
    expect(onSelectCover).toHaveBeenCalledTimes(1)
    expect(onSelectCover.mock.calls[0][0].cardName).toBe('Mountain')
    cleanup()
  })
})
