import { act, cleanup, fireEvent, render } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import HandBar from './HandBar'
import type { CardView } from '../net/types'
import { makeCard } from '../__fixtures__/gameViews'
import { HAND_BAR_MAX_CARD_W, HAND_BAR_PEEK_RATIO, HAND_CARD_ASPECT, HAND_BAR_PADDING_Y } from './handSizing'

vi.mock('./cardPositionRegistry', () => ({
  getPreviousCardPosition: vi.fn(() => undefined),
  getPreviousCardZone: vi.fn(() => undefined),
  recordCardPosition: vi.fn(),
}))

const pointerEvent = (type: string, x: number) =>
  Object.assign(new MouseEvent(type, { bubbles: true, button: 0, clientX: x, clientY: 0 }), { pointerId: 1 })
const pointer = (type: string, x: number) => window.dispatchEvent(pointerEvent(type, x))
const pointerDown = (el: Element, x: number) => act(() => void el.dispatchEvent(pointerEvent('pointerdown', x)))

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
    expect(getByTestId('hand-bar').getAttribute('data-hand-count')).toBe('3')
  })

  it('shows the printed mana cost as bubbles, both halves for split cards and none for lands', () => {
    const { container } = render(
      <HandBar
        cards={{
          bolt: makeCard({ id: 'bolt', name: 'Lightning Bolt', manaCostLeftStr: ['{R}'] }),
          angel: makeCard({ id: 'angel', name: 'Serra Angel', manaCostLeftStr: ['{3}', '{W}', '{W}'] }),
          split: makeCard({ id: 'split', name: 'Fire // Ice', manaCostLeftStr: ['{1}', '{R}'], manaCostRightStr: ['{1}', '{U}'] }),
          land: makeCard({ id: 'land', name: 'Forest', manaCostLeftStr: [] }),
        }}
      />,
    )
    const costs = Array.from(container.querySelectorAll('.hand-card-slot')).map((slot) =>
      Array.from(slot.querySelectorAll('.hand-card-cost img')).map((img) => img.getAttribute('alt')).join(''),
    )
    expect(costs).toEqual(['{R}', '{3}{W}{W}', '{1}{R}{1}{U}', ''])
    const sizes = new Set(Array.from(container.querySelectorAll<HTMLImageElement>('.hand-card-cost img')).map((img) => img.style.width))
    expect(sizes.size, 'one bubble size for the whole hand').toBe(1)
  })

  it('exposes sizing CSS variables, sink and the visible band height', () => {
    const { getByTestId } = render(<HandBar cards={hand()} />)
    const bar = getByTestId('hand-bar') as HTMLElement
    const cardH = HAND_BAR_MAX_CARD_W * HAND_CARD_ASPECT
    expect(bar.style.getPropertyValue('--card-w')).toBe(`${HAND_BAR_MAX_CARD_W}px`)
    expect(bar.style.getPropertyValue('--hand-gap')).toBe('0px')
    expect(bar.style.getPropertyValue('--sink')).toBe(`${cardH * HAND_BAR_PEEK_RATIO}px`)
    expect(bar.style.height).toBe(`${cardH * HAND_BAR_PEEK_RATIO + HAND_BAR_PADDING_Y}px`)
  })

  it('routes clicks through onCardClick', () => {
    const onCardClick = vi.fn()
    const { container } = render(<HandBar cards={hand()} onCardClick={onCardClick} />)
    const slots = container.querySelectorAll('.hand-card-slot')
    fireEvent.click(slots[1].querySelector('.card-slot')!)
    expect(onCardClick).toHaveBeenCalledWith('h-2')
  })

  it('emits hover with card + anchor rect, and clears on leave', () => {
    const onHover = vi.fn()
    const { container } = render(<HandBar cards={hand()} onHover={onHover} />)
    const slots = container.querySelectorAll('.hand-card-slot')
    fireEvent.mouseEnter(slots[1])
    expect(onHover).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'h-2', name: 'Counterspell' }),
      expect.anything(),
    )
    fireEvent.mouseLeave(slots[1])
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

  it('rearranges the hand by dragging, swallows the drop click and keeps the order across updates', () => {
    const onCardClick = vi.fn()
    const { container, rerender } = render(<HandBar cards={hand()} onCardClick={onCardClick} />)
    const mockRects = () => {
      container.querySelectorAll<HTMLElement>('.hand-card-slot').forEach((slot, i) => {
        const card = slot.querySelector('.hand-card') as HTMLElement
        card.getBoundingClientRect = () => ({ left: i * 100, width: 100, top: 0, height: 140 }) as DOMRect
      })
    }
    const ids = () => Array.from(container.querySelectorAll<HTMLElement>('.hand-card-slot')).map((s) => s.dataset.handId)
    mockRects()
    pointerDown(container.querySelectorAll('.hand-card-slot')[0], 50)
    act(() => pointer('pointermove', 280))
    expect(ids()).toEqual(['h-2', 'h-3', 'h-1'])
    expect(container.querySelector('.hand-bar')?.classList.contains('is-reordering')).toBe(true)
    act(() => pointer('pointerup', 280))
    fireEvent.click(container.querySelector('[data-hand-id="h-1"] .card-slot')!)
    expect(onCardClick).not.toHaveBeenCalled()

    rerender(
      <HandBar
        cards={{ ...hand(), 'h-4': makeCard({ id: 'h-4', name: 'Shock', parentId: 'h-4' }) }}
        onCardClick={onCardClick}
      />,
    )
    expect(ids()).toEqual(['h-2', 'h-3', 'h-1', 'h-4'])
  })

  it('treats a press without movement as a plain click', () => {
    const onCardClick = vi.fn()
    const { container } = render(<HandBar cards={hand()} onCardClick={onCardClick} />)
    const slot = container.querySelectorAll('.hand-card-slot')[1]
    pointerDown(slot, 10)
    act(() => {
      pointer('pointermove', 12)
      pointer('pointerup', 12)
    })
    fireEvent.click(slot.querySelector('.card-slot')!)
    expect(onCardClick).toHaveBeenCalledWith('h-2')
  })

  it('marks the strip as target zone only while a card in hand is the target', () => {
    const { getByTestId, rerender } = render(<HandBar cards={hand()} targetIds={new Set(['h-3'])} />)
    expect(getByTestId('hand-bar').classList.contains('target-zone')).toBe(true)

    rerender(<HandBar cards={hand()} targetIds={new Set()} />)
    expect(getByTestId('hand-bar').classList.contains('target-zone')).toBe(false)
  })
})
