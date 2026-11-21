import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import HandRail from './HandRail'
import { getState, setState } from '../state/state'
import { normalizeCardRender, normalizeHandRailWidth, HAND_RAIL_MAX_W, HAND_RAIL_MIN_W } from './cardOverlays'
import type { CardView } from '../net/types'

const hand = {
  a: { name: 'Opt', manaValue: 1, cardTypes: ['INSTANT'], rules: ['Scry 1.'] } as CardView,
  b: { name: 'Forest', manaValue: 0, cardTypes: ['LAND'], rules: ['{T}: Add {G}.'] } as CardView,
}

describe('card render settings', () => {
  it('normalizes the style and clamps the rail width', () => {
    expect(normalizeCardRender('rendered')).toBe('rendered')
    expect(normalizeCardRender('bogus')).toBe('image')
    expect(normalizeHandRailWidth(10)).toBe(HAND_RAIL_MIN_W)
    expect(normalizeHandRailWidth(9999)).toBe(HAND_RAIL_MAX_W)
    expect(normalizeHandRailWidth('abc')).toBe(260)
  })
})

describe('HandRail', () => {
  it('HND-7: lists every card of the hand as readable text in rendered mode and flags playable ones', () => {
    setState({ settings: { ...getState().settings, cardRender: 'rendered', handRail: true, handRailWidth: 240 } })
    const clicked: string[] = []
    const { container } = render(<HandRail cards={hand} playableIds={new Set(['a'])} onCardClick={(id) => clicked.push(id)} />)
    expect(screen.getByText('Scry 1.')).toBeTruthy()
    expect(container.querySelectorAll('.hand-rail-card').length).toBe(2)
    expect(container.querySelector('[data-hand-id="a"]')?.className).toContain('playable')
    expect(container.querySelector('[data-hand-id="b"]')?.className).not.toContain('playable')
    ;(container.querySelector('[data-hand-id="a"]') as HTMLElement).click()
    expect(clicked).toEqual(['a'])
  })
})

describe('HandRail draw slide', () => {
  it('animates only a card drawn after the hand is on screen', () => {
    setState({ settings: { ...getState().settings, cardRender: 'image', handRail: true, handRailWidth: 240, effects: true } })
    const { container, rerender } = render(<HandRail cards={hand} />)
    expect(container.querySelectorAll('.draw-slide, .draw-fade').length).toBe(0)
    const drawn = { ...hand, c: { name: 'Island', manaValue: 0, cardTypes: ['LAND'], rules: [] } as CardView }
    rerender(<HandRail cards={drawn} />)
    expect(container.querySelector('[data-hand-id="c"]')?.className).toContain('draw-')
    expect(container.querySelector('[data-hand-id="a"]')?.className).not.toContain('draw-')
  })
})

describe('HandRail, the commander under the hand', () => {
  const commander = {
    id: 'cmd-atraxa',
    card: { name: "Atraxa, Praetors' Voice", manaValue: 4, cardTypes: ['CREATURE'] } as CardView,
    tax: 4,
    companion: false,
  }

  it('BRD-34: the uncast commander is drawn under the hand column, with its tax', () => {
    setState({ settings: { ...getState().settings, cardRender: 'image', handRail: true, handRailWidth: 240 } })
    const { container } = render(<HandRail cards={hand} trailing={[commander]} />)
    const slot = container.querySelector('[data-trailing-id="cmd-atraxa"]')
    expect(slot, 'the commander hangs under the hand').not.toBeNull()
    expect(container.querySelector('[data-testid="commander-tax"]')?.getAttribute('data-tax')).toBe('4')
    expect(container.querySelectorAll('.hand-rail-card').length, 'and it is not one more card of the hand').toBe(2)
  })

  it('BRD-34: a click on it casts it', () => {
    setState({ settings: { ...getState().settings, cardRender: 'image', handRail: true, handRailWidth: 240 } })
    const cast: string[] = []
    const { container } = render(<HandRail cards={hand} trailing={[commander]} onTrailingClick={(id) => cast.push(id)} />)
    ;(container.querySelector('[data-trailing-id="cmd-atraxa"] .card-slot') as HTMLElement).click()
    expect(cast).toEqual(['cmd-atraxa'])
  })

  it('BRD-34: an empty hand still shows the commander, because it is not part of the hand', () => {
    setState({ settings: { ...getState().settings, cardRender: 'image', handRail: true, handRailWidth: 240 } })
    const { container } = render(<HandRail cards={{}} trailing={[commander]} />)
    expect(container.querySelector('[data-trailing-id="cmd-atraxa"]')).not.toBeNull()
  })
})
