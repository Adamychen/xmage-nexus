import { describe, expect, it, vi, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import { ArenaCardStacks, type StackColumn } from './ArenaCardStacks'
import type { DeckCard } from '../lobby/decks'

const bolt: DeckCard = { cardName: 'Lightning Bolt', setCode: 'M10', cardNumber: '146', amount: 4 }
const mountain: DeckCard = { cardName: 'Mountain', setCode: 'LEA', cardNumber: '292', amount: 20 }

const columns: StackColumn[] = [
  {
    id: 'cmc-1',
    label: 'CMC 1',
    items: [{ key: 'M10:146:Lightning Bolt', card: bolt, meta: { imageUrl: 'https://img.test/bolt.jpg' } }],
  },
  {
    id: 'lands',
    label: 'Lands',
    items: [{ key: 'LEA:292:Mountain', card: mountain, issue: 'Not in the format' }],
  },
]

function renderStacks(overrides: Partial<Parameters<typeof ArenaCardStacks>[0]> = {}) {
  const props = {
    columns,
    onInc: vi.fn(),
    onDec: vi.fn(),
    onHover: vi.fn(),
    onLeave: vi.fn(),
    ...overrides,
  }
  render(<ArenaCardStacks {...props} />)
  return props
}

afterEach(cleanup)

describe('ArenaCardStacks', () => {
  it('renders one column per group with its total copies', () => {
    renderStacks()
    const cols = document.querySelectorAll('.arena-stack-col')
    expect(cols).toHaveLength(2)
    expect(cols[0].querySelector('.arena-stack-col-count')?.textContent).toBe('4')
    expect(cols[1].querySelector('.arena-stack-col-count')?.textContent).toBe('20')
  })

  it('shows the card art when there is an image and the name otherwise', () => {
    renderStacks()
    expect(document.querySelector('img.arena-stack-img')?.getAttribute('src')).toBe('https://img.test/bolt.jpg')
    expect(document.querySelector('.arena-stack-fallback')?.textContent).toBe('Mountain')
  })

  it('shows the copy count on each card', () => {
    renderStacks()
    expect(screen.getByText('4x')).toBeDefined()
    expect(screen.getByText('20x')).toBeDefined()
  })

  it('left click removes one copy and shift-click adds one', () => {
    const { onInc, onDec } = renderStacks()
    const card = screen.getByRole('button', { name: /Lightning Bolt/ })
    fireEvent.click(card)
    expect(onDec).toHaveBeenCalledWith('M10:146:Lightning Bolt')
    fireEvent.click(card, { shiftKey: true })
    expect(onInc).toHaveBeenCalledWith('M10:146:Lightning Bolt')
  })

  it('right click adds one copy without opening the context menu', () => {
    const { onInc } = renderStacks()
    const card = screen.getByRole('button', { name: /Lightning Bolt/ })
    const notPrevented = fireEvent.contextMenu(card)
    expect(notPrevented).toBe(false)
    expect(onInc).toHaveBeenCalledWith('M10:146:Lightning Bolt')
  })

  it('reports hover with the card meta and leave', () => {
    const { onHover, onLeave } = renderStacks()
    const card = screen.getByRole('button', { name: /Lightning Bolt/ })
    fireEvent.mouseEnter(card)
    expect(onHover).toHaveBeenCalledWith(bolt, columns[0].items[0].meta, expect.anything())
    fireEvent.mouseLeave(card)
    expect(onLeave).toHaveBeenCalled()
  })

  it('flags cards with a validation issue', () => {
    renderStacks()
    expect(document.querySelector('.arena-stack-card.has-issue')?.textContent).toContain('20x')
  })
})
