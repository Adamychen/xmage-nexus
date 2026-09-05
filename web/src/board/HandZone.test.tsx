import { render, fireEvent } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import HandZone from './HandZone'
import { setLanguage } from '../i18n'
import type { CardView } from '../net/types'

function back(id: string): [string, CardView] {
  return [id, { id, name: '?', manaValue: 0, expansionSetCode: '', cardNumber: '0', faceDown: true }]
}

function faceUp(id: string, name: string): [string, CardView] {
  return [id, { id, name, manaValue: 2, expansionSetCode: 'lea', cardNumber: '1' }]
}

describe('HandZone back stacking (pod/arena)', () => {
  beforeEach(() => {
    setLanguage('es')
  })

  it('renders one slot per card without stackBacks', () => {
    const { container } = render(
      <HandZone cards={Object.fromEntries([back('a'), back('b'), back('c')])} compact />
    )
    expect(container.querySelector('[data-testid="opp-hand-stack"]')).toBeNull()
    expect(container.querySelectorAll('.hand-card-slot').length).toBe(3)
  })

  it('collapses 3+ backs into one ×N stack with stackBacks', () => {
    const { container } = render(
      <HandZone cards={Object.fromEntries([back('a'), back('b'), back('c'), back('d')])} compact stackBacks />
    )
    const stack = container.querySelector('[data-testid="opp-hand-stack"]')
    expect(stack).not.toBeNull()
    expect(stack?.getAttribute('data-count')).toBe('4')
    expect(stack?.textContent).toContain('×4')
    expect(container.querySelectorAll('.hand-card-slot').length).toBe(0)
  })

  it('keeps a single back as a plain slot', () => {
    const { container } = render(
      <HandZone cards={Object.fromEntries([back('a')])} compact stackBacks />
    )
    expect(container.querySelector('[data-testid="opp-hand-stack"]')).toBeNull()
    expect(container.querySelectorAll('.hand-card-slot').length).toBe(1)
  })

  it('keeps known face-up cards inline next to the backs stack', () => {
    const { container } = render(
      <HandZone
        cards={Object.fromEntries([faceUp('k1', 'Lightning Bolt'), faceUp('k2', 'Shock'), back('a'), back('b'), back('c')])}
        compact
        stackBacks
        viewable
        viewKnownCount={2}
        onViewHand={() => {}}
      />
    )
    expect(container.querySelectorAll('.hand-card-slot').length).toBe(2)
    const stack = container.querySelector('[data-testid="opp-hand-stack"]')
    expect(stack?.getAttribute('data-count')).toBe('3')
    expect(stack?.classList.contains('is-viewable')).toBe(true)
    expect(stack?.querySelector('.hand-view-badge')).not.toBeNull()
    expect(stack?.getAttribute('title')).toContain('Ver mano')
  })

  it('opens the viewer even on a fully unknown stack (backs only)', () => {
    const onViewHand = vi.fn()
    const { container } = render(
      <HandZone cards={Object.fromEntries([back('a'), back('b')])} compact stackBacks onViewHand={onViewHand} />
    )
    const stack = container.querySelector('[data-testid="opp-hand-stack"]')
    expect(stack?.classList.contains('is-viewable')).toBe(false)
    expect(stack?.querySelector('.hand-view-badge')).toBeNull()
    expect(stack?.getAttribute('title')).toContain('Mano rival')
    fireEvent.click(stack!)
    expect(onViewHand).toHaveBeenCalledTimes(1)
  })

  it('opens the viewer on click when viewable', () => {
    const onViewHand = vi.fn()
    const { container } = render(
      <HandZone
        cards={Object.fromEntries([faceUp('k1', 'Lightning Bolt'), back('a'), back('b')])}
        compact
        stackBacks
        viewable
        viewKnownCount={1}
        onViewHand={onViewHand}
      />
    )
    fireEvent.click(container.querySelector('[data-testid="opp-hand-stack"]')!)
    expect(onViewHand).toHaveBeenCalledTimes(1)
  })

  it('never stacks an all face-up hand (my own cards)', () => {
    const { container } = render(
      <HandZone cards={Object.fromEntries([faceUp('k1', 'Bolt'), faceUp('k2', 'Shock')])} stackBacks />
    )
    expect(container.querySelector('[data-testid="opp-hand-stack"]')).toBeNull()
    expect(container.querySelectorAll('.hand-card-slot').length).toBe(2)
  })
})
