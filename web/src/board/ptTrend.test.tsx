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

  it('BRD-49: reads the printed value from MageInt objects and plain strings', () => {
    expect(basePtValue(mageInt('2', 2))).toBe(2)
    expect(basePtValue('3')).toBe(3)
    expect(basePtValue(null)).toBeNull()
    expect(basePtValue('*')).toBeNull()
  })

  it('BRD-49: the printed value is the one the card was made with, not the one an effect left behind', () => {
    // Maha, Its Feathers Night gives "base toughness 1" through MageInt.setModifiedBaseValue,
    // which also overwrites cardValue, so the string the engine sends is already the new base and
    // a 2/3 under it looked unchanged at 2/1.
    const mahaed = { baseValue: 3, modifiedBaseValue: 1, boostedValue: 1, cardValue: '1' }
    expect(basePtValue(mahaed)).toBe(3)
    expect(ptTrend({ power: '2', toughness: '1', originalPower: mageInt('2', 2), originalToughness: mahaed } as never))
      .toEqual({ power: 'same', toughness: 'down' })
  })

  it('BRD-49: a printed P/T that is not a number is nothing to compare against', () => {
    // Tarmogoyf prints `*`/`1+*`: the engine sends cardValue '*' with baseValue 0, and reading
    // that 0 as the printed value marked every one of them as grown.
    expect(basePtValue(mageInt('*', 0))).toBeNull()
    expect(ptTrend({ power: '4', toughness: '5', originalPower: mageInt('*', 0), originalToughness: mageInt('*', 0) } as never))
      .toEqual({ power: 'same', toughness: 'same' })
  })

  it('BRD-49: compares current P/T with the printed one per component', () => {
    const card = (power: string, toughness: string) =>
      ({ power, toughness, originalPower: mageInt('2', 2), originalToughness: mageInt('2', 2) }) as never
    expect(ptTrend(card('4', '4'))).toEqual({ power: 'up', toughness: 'up' })
    expect(ptTrend(card('1', '3'))).toEqual({ power: 'down', toughness: 'up' })
    expect(ptTrend(card('2', '2'))).toEqual({ power: 'same', toughness: 'same' })
    expect(ptTrend({ power: '2', toughness: '2' } as never)).toEqual({ power: 'same', toughness: 'same' })
  })

  it('BRD-49: tints the badge values and exposes the base as a tooltip', () => {
    const perm = makePermanent({
      id: 'c1', name: 'Grizzly Bears', cardTypes: ['CREATURE'], power: '3', toughness: '1',
      originalPower: mageInt('2', 2) as never, originalToughness: mageInt('2', 2) as never,
    })
    const { container } = render(<CardSlot card={perm} showPt />)
    const badge = container.querySelector('.pt-badge')!
    expect(badge.textContent).toBe('3/1')
    expect(badge.getAttribute('data-trend')).toBe('changed')
    expect(badge.getAttribute('aria-label')).toContain('2/2')
    const [p, t] = [...badge.querySelectorAll('.pt-value')]
    expect(p.getAttribute('data-trend')).toBe('up')
    expect(t.getAttribute('data-trend')).toBe('down')
  })

  it('BRD-49: only the side that changed is tinted, and never the slash between them', () => {
    const perm = makePermanent({
      id: 'c4', name: 'Grizzly Bears', cardTypes: ['CREATURE'], power: '3', toughness: '2',
      originalPower: mageInt('2', 2) as never, originalToughness: mageInt('2', 2) as never,
    })
    const { container } = render(<CardSlot card={perm} showPt />)
    const badge = container.querySelector('.pt-badge')!
    const [p, t] = [...badge.querySelectorAll('.pt-value')]
    expect(p.getAttribute('data-trend')).toBe('up')
    expect(t.getAttribute('data-trend')).toBe('same')
    const slash = [...badge.childNodes].filter((n) => n.nodeType === Node.TEXT_NODE).map((n) => n.textContent).join('')
    expect(slash).toBe('/')
  })

  it('marks permanents that entered this turn', () => {
    setState({ enteredThisTurn: { c2: true } })
    const fresh = render(<CardSlot card={makePermanent({ id: 'c2', name: 'Elves', cardTypes: ['CREATURE'] })} />)
    expect(fresh.container.querySelector('[data-entered="turn"] .entered-glow')).not.toBeNull()
    const old = render(<CardSlot card={makePermanent({ id: 'c3', name: 'Bears', cardTypes: ['CREATURE'] })} />)
    expect(old.container.querySelector('.entered-glow')).toBeNull()
  })
})
