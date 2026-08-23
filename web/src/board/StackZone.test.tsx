import { fireEvent, render } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import StackZone from './StackZone'
import type { CardView } from '../net/types'

vi.mock('../cards/cardImages', () => ({
  awaitImageUrl: vi.fn().mockResolvedValue('https://img.test/card.jpg'),
  isAbilityCard: vi.fn().mockImplementation((card: CardView) => {
    const t = card.mageObjectType ?? ''
    return t.includes('Ability') || t.includes('ABILITY')
  }),
  getSourceCardName: vi.fn().mockImplementation((card: CardView) => {
    if (card.rules?.[0]?.includes('Cloud, Midgar Mercenary')) return 'Cloud, Midgar Mercenary'
    if (card.displayName && card.displayName !== 'Ability') return card.displayName
    if (card.name && card.name !== 'Ability') return card.name
    return 'Habilidad'
  }),
  cardName: vi.fn().mockImplementation((card: CardView) => {
    if (card.rules?.[0]?.includes('Cloud, Midgar Mercenary')) return 'Cloud, Midgar Mercenary'
    if (card.displayName && card.displayName !== 'Ability') return card.displayName
    if (card.name && card.name !== 'Ability') return card.name
    return 'Habilidad'
  }),
}))

describe('StackZone', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders empty when stack is null or empty', () => {
    const { container } = render(<StackZone stack={null} />)
    expect(container.querySelector('.stack-zone.empty')).toBeTruthy()
  })

  it('renders single spell on the stack as top item', () => {
    const stack: Record<string, CardView> = {
      'spell-1': {
        name: 'Lightning Bolt',
        cardTypes: ['INSTANT'],
        manaValue: 1,
        rules: ['Lightning Bolt deals 3 damage to any target.'],
      },
    }

    const { container } = render(
      <StackZone stack={stack} canResolve={true} onResolveClick={vi.fn()} />,
    )

    expect(container.textContent).toContain('Pila (1)')
    expect(container.textContent).toContain('Lightning Bolt')
    expect(container.textContent).toContain('Instantáneo')
    expect(container.querySelector('.stack-resolve-header-btn')).toBeTruthy()
  })

  it('renders multiple spells in timeline with newest on top', () => {
    const stack: Record<string, CardView> = {
      'spell-2': {
        name: 'Counterspell',
        cardTypes: ['INSTANT'],
        manaValue: 2,
        rules: ['Counter target spell.'],
      },
      'spell-1': {
        name: 'Lightning Bolt',
        cardTypes: ['INSTANT'],
        manaValue: 1,
      },
    }

    const { container } = render(<StackZone stack={stack} canResolve={true} />)

    expect(container.textContent).toContain('Pila (2)')
    const entries = container.querySelectorAll('.stack-tl-entry')
    expect(entries.length).toBe(2)
    expect(entries[0].classList.contains('is-top')).toBe(true)
    expect(entries[0].textContent).toContain('Counterspell')
    expect(entries[1].textContent).toContain('Lightning Bolt')
  })

  it('triggers onCardClick and onHover when interacting with stack items', () => {
    const onCardClick = vi.fn()
    const onHover = vi.fn()

    const stack: Record<string, CardView> = {
      'spell-2': {
        name: 'Counterspell',
        cardTypes: ['INSTANT'],
        manaValue: 2,
      },
      'spell-1': {
        name: 'Lightning Bolt',
        cardTypes: ['INSTANT'],
        manaValue: 1,
      },
    }

    const { container } = render(
      <StackZone stack={stack} onCardClick={onCardClick} onHover={onHover} />,
    )

    const entries = container.querySelectorAll('.stack-tl-entry')
    fireEvent.click(entries[1])
    expect(onCardClick).toHaveBeenCalledWith('spell-1')

    fireEvent.mouseEnter(entries[1])
    expect(onHover).toHaveBeenCalledWith(stack['spell-1'], expect.anything())
  })

  it('renders ability capsules with resolved source name', () => {
    const stack: Record<string, CardView> = {
      'ab-1': {
        name: 'Ability',
        mageObjectType: 'TRIGGERED_ABILITY',
        abilityType: 'Triggered',
        manaValue: 0,
        rules: ['When Cloud, Midgar Mercenary enters, search your library for an Equipment card...'],
      },
    }

    const { container } = render(<StackZone stack={stack} />)
    expect(container.textContent).toContain('Cloud, Midgar Mercenary')
    expect(container.textContent).toContain('Disparada')
    expect(container.querySelector('.stack-tl-entry.is-ability')).toBeTruthy()
  })

  it('renders storm copy badges and allows toggling view mode', () => {
    const stack: Record<string, CardView> = {
      'storm-1': {
        name: 'Grapeshot [Copia 1]',
        cardTypes: ['SORCERY'],
        manaValue: 2,
      },
    }

    const { container } = render(<StackZone stack={stack} />)
    expect(container.querySelector('.stack-tl-copy-badge')).toBeTruthy()
    expect(container.textContent).toContain('Copia')

    const expandedBtn = container.querySelectorAll('.toggle-mode-btn')[1] as HTMLButtonElement
    expect(expandedBtn).toBeTruthy()
    fireEvent.click(expandedBtn)
    expect(container.querySelector('.view-mode-expanded')).toBeTruthy()
  })

  it('shows timeline rail with green top node', () => {
    const stack: Record<string, CardView> = {
      'spell-1': {
        name: 'Bolt',
        cardTypes: ['INSTANT'],
        manaValue: 1,
      },
      'spell-2': {
        name: 'Giant Growth',
        cardTypes: ['INSTANT'],
        manaValue: 1,
      },
    }

    const { container } = render(<StackZone stack={stack} />)
    const nodes = container.querySelectorAll('.stack-tl-node')
    expect(nodes.length).toBe(2)
    expect(nodes[0].classList.contains('node-top')).toBe(true)
    expect(nodes[1].classList.contains('node-top')).toBe(false)

    const lines = container.querySelectorAll('.stack-tl-line')
    expect(lines.length).toBe(1)
    expect(lines[0].classList.contains('line-top')).toBe(true)
  })

  it('renders resolve button in header when canResolve is true', () => {
    const onResolveClick = vi.fn()
    const stack: Record<string, CardView> = {
      'spell-1': {
        name: 'Bolt',
        cardTypes: ['INSTANT'],
        manaValue: 1,
      },
    }

    const { container } = render(
      <StackZone stack={stack} canResolve={true} onResolveClick={onResolveClick} />,
    )

    const btn = container.querySelector('.stack-resolve-header-btn') as HTMLButtonElement
    expect(btn).toBeTruthy()
    fireEvent.click(btn)
    expect(onResolveClick).toHaveBeenCalled()
  })
})
