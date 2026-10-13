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
  it('lists every card of the hand as readable text in rendered mode and flags playable ones', () => {
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
