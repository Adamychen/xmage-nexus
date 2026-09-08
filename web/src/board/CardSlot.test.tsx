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

  it('renders designation badges for live monstrous/renowned hints', () => {
    const card = {
      id: 'c3',
      name: 'Polukranos, World Eater',
      cardTypes: ['Creature'],
      rules: ['Trample', '<br/><hintstart/>', 'ICON_GOOD{this} is monstrous'],
    } as unknown as PermanentView
    const { container } = render(<CardSlot card={card} />)
    expect(container.querySelector('.designation-badge.is-monstrous')).not.toBeNull()
    expect(container.querySelector('.designation-badge.is-renowned')).toBeNull()
  })

  it('renders no designation badge for the negative hint branch', () => {
    const card = {
      id: 'c4',
      name: "Consul's Lieutenant",
      cardTypes: ['Creature'],
      rules: ['First strike', 'Renown 1', "ICON_BAD{this} isn't renowned"],
    } as unknown as PermanentView
    const { container } = render(<CardSlot card={card} />)
    expect(container.querySelector('.designation-badge')).toBeNull()
  })

  it('renders suspected badge from the engine info line', () => {
    const card = {
      id: 'c5',
      name: 'Shady Informant',
      cardTypes: ['Creature'],
      rules: ['Deathtouch', "<font color = 'blue'>Suspected (has menace and can't block)</font>"],
    } as unknown as PermanentView
    const { container } = render(<CardSlot card={card} />)
    expect(container.querySelector('.designation-badge.is-suspected')).not.toBeNull()
  })

  it('renders paired badge with partner name in title', () => {
    const card = {
      id: 'c6',
      name: 'Silverblade Paladin',
      cardTypes: ['Creature'],
      rules: ['Soulbond', "Paired with <font color='#B0C4DE'>Grizzly Bears [a1b]</font>"],
    } as unknown as PermanentView
    const { container } = render(<CardSlot card={card} />)
    const badge = container.querySelector('.designation-badge.is-paired')
    expect(badge).not.toBeNull()
    expect(badge?.getAttribute('title')).toContain('Grizzly Bears')
  })

  it('renders class level badge with the live level', () => {
    const card = {
      id: 'c7',
      name: 'Bard Class',
      cardTypes: ['Enchantment'],
      rules: ['Level 2 — Whenever you cast a legendary spell, ...', 'Class level: 2'],
    } as unknown as PermanentView
    const { container } = render(<CardSlot card={card} />)
    const badge = container.querySelector('.designation-badge.is-classlevel')
    expect(badge).not.toBeNull()
    expect(badge?.textContent).toContain('2')
    expect(badge?.getAttribute('title')).toContain('2/3')
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
