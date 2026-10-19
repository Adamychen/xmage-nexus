import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import DeckCarousel from './DeckCarousel'
import type { Deck } from '../decks'

const decks: Deck[] = [
  { name: 'Burn', cards: [{ cardName: 'Lightning Bolt', setCode: 'M10', cardNumber: '146', amount: 60 }], sideboard: [] },
  { name: 'Humans', cards: [{ cardName: 'Savannah Lions', setCode: 'LEA', cardNumber: '1', amount: 60 }], sideboard: [] },
  { name: 'Control', cards: [{ cardName: 'Counterspell', setCode: 'LEA', cardNumber: '2', amount: 60 }], sideboard: [] },
]

describe('DeckCarousel', () => {
  afterEach(() => {
    cleanup()
  })

  it('marks only the selected deck as checked', () => {
    render(<DeckCarousel decks={decks} selected="Humans" onSelect={() => {}} label="Deck" />)
    const checked = screen.getAllByRole('radio').filter((r) => r.getAttribute('aria-checked') === 'true')
    expect(checked).toHaveLength(1)
    expect(checked[0].textContent).toContain('Humans')
  })

  it('selects a deck on click and on Enter', () => {
    const onSelect = vi.fn()
    render(<DeckCarousel decks={decks} selected="Burn" onSelect={onSelect} label="Deck" />)
    fireEvent.click(screen.getByRole('radio', { name: /Control/ }))
    expect(onSelect).toHaveBeenLastCalledWith('Control')
    fireEvent.keyDown(screen.getByRole('radio', { name: /Humans/ }), { key: 'Enter' })
    expect(onSelect).toHaveBeenLastCalledWith('Humans')
  })

  it('moves the selection with the arrow keys and wraps around', () => {
    const onSelect = vi.fn()
    render(<DeckCarousel decks={decks} selected="Control" onSelect={onSelect} label="Deck" />)
    fireEvent.keyDown(screen.getByRole('radio', { name: /Control/ }), { key: 'ArrowRight' })
    expect(onSelect).toHaveBeenLastCalledWith('Burn')
    fireEvent.keyDown(screen.getByRole('radio', { name: /Control/ }), { key: 'ArrowLeft' })
    expect(onSelect).toHaveBeenLastCalledWith('Humans')
  })

  it('does not select anything when disabled', () => {
    const onSelect = vi.fn()
    render(<DeckCarousel decks={decks} selected="Burn" onSelect={onSelect} label="Deck" disabled />)
    fireEvent.click(screen.getByRole('radio', { name: /Control/ }))
    expect(onSelect).not.toHaveBeenCalled()
  })

  it('renders nothing without decks', () => {
    const { container } = render(<DeckCarousel decks={[]} selected="" onSelect={() => {}} label="Deck" />)
    expect(container.firstChild).toBeNull()
  })
})
