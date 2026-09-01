import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { act, StrictMode } from 'react'
import { render } from '@testing-library/react'
import CardSlot from './CardSlot'
import type { PermanentView } from '../net/types'

vi.mock('./cardPositionRegistry', () => ({
  getPreviousCardPosition: vi.fn(() => undefined),
  getPreviousCardZone: vi.fn(() => undefined),
  recordCardPosition: vi.fn(),
}))

describe('CardSlot', () => {
  it('renders loyalty badge for planeswalker with loyalty', () => {
    const card = {
      id: 'pw1',
      name: 'Jace, the Mind Sculptor',
      cardTypes: ['Planeswalker'],
      loyalty: '3',
    } as unknown as PermanentView
    const { container } = render(<CardSlot card={card} />)
    expect(container.querySelector('.loyalty-badge')).not.toBeNull()
    expect(container.querySelector('.loyalty-badge')?.textContent).toContain('3')
  })

  it('renders keyword badges for Flying/Deathtouch/Trample/Haste', () => {
    const card = {
      id: 'c1',
      name: 'Keyword Beast',
      cardTypes: ['Creature'],
      power: '4',
      toughness: '4',
      rules: ['Flying, deathtouch, trample, haste'],
    } as unknown as PermanentView
    const { container } = render(<CardSlot card={card} />)
    const badges = container.querySelectorAll('.keyword-badge')
    expect(badges.length).toBeGreaterThanOrEqual(3)
    expect(container.querySelector('.keyword-badges')).not.toBeNull()
  })

  it('does not render keyword badges when no keywords', () => {
    const card = {
      id: 'c2',
      name: 'Vanilla',
      cardTypes: ['Creature'],
      rules: ['Vanilla creature'],
    } as unknown as PermanentView
    const { container } = render(<CardSlot card={card} />)
    expect(container.querySelector('.keyword-badges')).toBeNull()
  })
})

describe('CardSlot entering lifecycle', () => {
  const realRect = Element.prototype.getBoundingClientRect

  beforeEach(() => {
    vi.useFakeTimers()
    Element.prototype.getBoundingClientRect = function () {
      return { x: 8, y: 8, width: 100, height: 140, top: 8, left: 8, right: 108, bottom: 148, toJSON: () => ({}) }
    } as typeof Element.prototype.getBoundingClientRect
  })

  afterEach(() => {
    Element.prototype.getBoundingClientRect = realRect
    vi.useRealTimers()
  })

  const tappedCard = (id: string) =>
    ({ id, name: 'Bear', cardTypes: ['Creature'], power: '2', toughness: '2' }) as unknown as PermanentView
  const slot = (view: { container: HTMLElement }) => view.container.querySelector('.card-slot')!

  it('clears entering after 250ms even when the card prop changes (nuevo objeto por GAME_UPDATE)', () => {
    const view = render(<CardSlot card={tappedCard('enter-1')} tapped />)
    expect(slot(view).className).toContain('entering')

    view.rerender(<CardSlot card={tappedCard('enter-1')} tapped />)
    act(() => { vi.advanceTimersByTime(300) })

    expect(slot(view).className, 'entering no debe quedarse clavado: el cleanup del efecto no puede anular su timer').not.toContain('entering')
    expect(slot(view).className).toContain('tapped')
  })

  it('clears entering under StrictMode double mount (dev)', () => {
    const view = render(
      <StrictMode>
        <CardSlot card={tappedCard('enter-2')} tapped />
      </StrictMode>,
    )
    expect(slot(view).className).toContain('entering')

    act(() => { vi.advanceTimersByTime(300) })

    expect(slot(view).className).not.toContain('entering')
    expect(slot(view).className).toContain('tapped')
  })
})
