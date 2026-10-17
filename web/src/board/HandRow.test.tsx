import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import HandRow from './HandRow'
import { getState, setState } from '../state/state'
import { normalizeHandRow } from './cardOverlays'
import type { CardView } from '../net/types'

const hand = {
  a: { name: 'Opt', manaValue: 1, cardTypes: ['INSTANT'], rules: ['Scry 1.'] } as CardView,
  b: { name: 'Forest', manaValue: 0, cardTypes: ['LAND'], rules: ['{T}: Add {G}.'] } as CardView,
}

describe('HandRow', () => {
  it('normalizes the row flag', () => {
    expect(normalizeHandRow(true)).toBe(true)
    expect(normalizeHandRow(false)).toBe(false)
    expect(normalizeHandRow('yes')).toBe(false)
  })

  it('lists every card of the hand as readable text in rendered mode and flags playable ones', () => {
    setState({ settings: { ...getState().settings, cardRender: 'rendered', handRail: false, handRow: true, handRailWidth: 240 } })
    const clicked: string[] = []
    const { container } = render(<HandRow cards={hand} playableIds={new Set(['a'])} onCardClick={(id) => clicked.push(id)} />)
    expect(screen.getByText('Scry 1.')).toBeTruthy()
    expect(container.querySelectorAll('.hand-row-card').length).toBe(2)
    expect(container.querySelector('[data-hand-id="a"]')?.className).toContain('playable')
    expect(container.querySelector('[data-hand-id="b"]')?.className).not.toContain('playable')
    ;(container.querySelector('[data-hand-id="a"]') as HTMLElement).click()
    expect(clicked).toEqual(['a'])
  })

  it('renders nothing for an empty hand', () => {
    const { container } = render(<HandRow cards={{}} />)
    expect(container.firstChild).toBeNull()
  })
})

describe('HandRow draw slide', () => {
  it('animates only a card drawn after the hand is on screen', () => {
    setState({ settings: { ...getState().settings, cardRender: 'image', handRow: true, effects: true } })
    const { container, rerender } = render(<HandRow cards={hand} />)
    expect(container.querySelectorAll('.draw-slide, .draw-fade').length).toBe(0)
    const drawn = { ...hand, c: { name: 'Island', manaValue: 0, cardTypes: ['LAND'], rules: [] } as CardView }
    rerender(<HandRow cards={drawn} />)
    expect(container.querySelector('[data-hand-id="c"]')?.className).toContain('draw-')
    expect(container.querySelector('[data-hand-id="a"]')?.className).not.toContain('draw-')
  })
})
