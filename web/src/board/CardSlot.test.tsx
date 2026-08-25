import { describe, expect, it } from 'vitest'
import { render } from '@testing-library/react'
import CardSlot from './CardSlot'
import type { PermanentView } from '../net/types'

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
