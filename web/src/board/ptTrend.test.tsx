import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, render } from '@testing-library/react'
import { basePtValue, ptTrend } from './ptTrend'
import CardSlot from './CardSlot'
import { makePermanent } from '../__fixtures__/gameViews'
import { setState } from '../state/store'

const mageInt = (card: string, base: number) => ({ baseValue: base, modifiedBaseValue: base, boostedValue: base, cardValue: card })

describe('ptTrend', () => {
  afterEach(() => {
    cleanup()
    setState({ enteredThisTurn: {} })
  })

  it('reads the printed value from MageInt objects and plain strings', () => {
    expect(basePtValue(mageInt('2', 2))).toBe(2)
    expect(basePtValue(mageInt('*', 0))).toBe(0)
    expect(basePtValue('3')).toBe(3)
    expect(basePtValue(null)).toBeNull()
    expect(basePtValue('*')).toBeNull()
  })

  it('compares current P/T with the printed one per component', () => {
    const card = (power: string, toughness: string) =>
      ({ power, toughness, originalPower: mageInt('2', 2), originalToughness: mageInt('2', 2) }) as never
    expect(ptTrend(card('4', '4'))).toEqual({ power: 'up', toughness: 'up' })
    expect(ptTrend(card('1', '3'))).toEqual({ power: 'down', toughness: 'up' })
    expect(ptTrend(card('2', '2'))).toEqual({ power: 'same', toughness: 'same' })
    expect(ptTrend({ power: '2', toughness: '2' } as never)).toEqual({ power: 'same', toughness: 'same' })
  })

  it('tints the badge values and exposes the base as a tooltip', () => {
    const perm = makePermanent({
      id: 'c1', name: 'Grizzly Bears', cardTypes: ['CREATURE'], power: '3', toughness: '1',
      originalPower: mageInt('2', 2) as never, originalToughness: mageInt('2', 2) as never,
    })
    const { container } = render(<CardSlot card={perm} showPt />)
    const badge = container.querySelector('.pt-badge')!
    expect(badge.textContent).toBe('3/1')
    expect(badge.getAttribute('data-trend')).toBe('changed')
    expect(badge.getAttribute('title')).toContain('2/2')
    const [p, t] = [...badge.querySelectorAll('.pt-value')]
    expect(p.getAttribute('data-trend')).toBe('up')
    expect(t.getAttribute('data-trend')).toBe('down')
  })

  it('marks permanents that entered this turn', () => {
    setState({ enteredThisTurn: { c2: true } })
    const fresh = render(<CardSlot card={makePermanent({ id: 'c2', name: 'Elves', cardTypes: ['CREATURE'] })} />)
    expect(fresh.container.querySelector('[data-entered="turn"] .entered-glow')).not.toBeNull()
    const old = render(<CardSlot card={makePermanent({ id: 'c3', name: 'Bears', cardTypes: ['CREATURE'] })} />)
    expect(old.container.querySelector('.entered-glow')).toBeNull()
  })
})
