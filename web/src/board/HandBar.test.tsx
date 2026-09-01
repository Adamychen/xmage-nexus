import { cleanup, fireEvent, render } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import HandBar from './HandBar'
import type { CardView } from '../net/types'
import { makeCard } from '../__fixtures__/gameViews'
import { HAND_BAR_MAX_CARD_W, HAND_CARD_ASPECT, HAND_BAR_PADDING_Y } from './handSizing'

vi.mock('./cardPositionRegistry', () => ({
  getPreviousCardPosition: vi.fn(() => undefined),
  getPreviousCardZone: vi.fn(() => undefined),
  recordCardPosition: vi.fn(),
}))

describe('HandBar', () => {
  afterEach(() => cleanup())

  const hand = (): Record<string, CardView> => ({
    'h-1': makeCard({ id: 'h-1', name: 'Lightning Bolt', parentId: 'h-1' }),
    'h-2': makeCard({ id: 'h-2', name: 'Counterspell', parentId: 'h-2' }),
    'h-3': makeCard({ id: 'h-3', name: 'Serra Angel', parentId: 'h-3' }),
  })

  it('renders nothing when the hand is empty', () => {
    const { container } = render(<HandBar cards={{}} />)
    expect(container.querySelector('.hand-bar')).toBeNull()
  })

  it('renders one slot per card with hand-card classes', () => {
    const { container, getByTestId } = render(<HandBar cards={hand()} />)
    expect(getByTestId('hand-bar')).not.toBeNull()
    const slots = container.querySelectorAll('.hand-bar .hand-card-slot')
    expect(slots.length).toBe(3)
    expect(container.querySelectorAll('.hand-bar .hand-card').length).toBe(3)
  })

  it('exposes sizing CSS variables and derived bar height', () => {
    const { getByTestId } = render(<HandBar cards={hand()} />)
    const bar = getByTestId('hand-bar') as HTMLElement
    expect(bar.style.getPropertyValue('--card-w')).toBe(`${HAND_BAR_MAX_CARD_W}px`)
    expect(bar.style.getPropertyValue('--hand-gap')).toBe('0px')
    expect(bar.style.height).toBe(`${HAND_BAR_MAX_CARD_W * HAND_CARD_ASPECT + HAND_BAR_PADDING_Y}px`)
  })

  it('routes clicks through onCardClick', () => {
    const onCardClick = vi.fn()
    const { container } = render(<HandBar cards={hand()} onCardClick={onCardClick} />)
    const slots = container.querySelectorAll('.hand-bar .hand-card-slot')
    fireEvent.click(slots[1].querySelector('.card-slot')!)
    expect(onCardClick).toHaveBeenCalledWith('h-2')
  })

  it('reports hover with the hand-bar origin', () => {
    const onHover = vi.fn()
    const { container } = render(<HandBar cards={hand()} onHover={onHover} />)
    const slot = container.querySelectorAll('.hand-bar .hand-card-slot')[2] as HTMLElement
    fireEvent.mouseEnter(slot)
    expect(onHover).toHaveBeenCalledTimes(1)
    const [card, rect, origin] = onHover.mock.calls[0]
    expect(card.name).toBe('Serra Angel')
    expect(rect).toHaveProperty('left')
    expect(origin).toBe('hand-bar')
    fireEvent.mouseLeave(slot)
    expect(onHover).toHaveBeenLastCalledWith(null)
  })

  it('marks playable and targetable cards', () => {
    const { container } = render(
      <HandBar cards={hand()} playableIds={new Set(['h-1'])} targetIds={new Set(['h-3'])} />,
    )
    const cards = container.querySelectorAll('.hand-bar .card-slot')
    expect(cards[0].classList.contains('playable')).toBe(true)
    expect(cards[2].classList.contains('targetable')).toBe(true)
  })
})
