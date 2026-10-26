import { describe, expect, it, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import BoardLivePreview from './BoardLivePreview'
import { getState, setSetting } from '../state/store'

const initial = { ...getState().settings }

afterEach(() => {
  cleanup()
  for (const key of ['cardStyle', 'tapStyle', 'ptBadgeMode', 'sicknessStyle', 'showHandCost', 'showManaSource', 'playmatId'] as const) {
    setSetting(key, initial[key] as never)
  }
})

const stage = () => screen.getByTestId('board-live-preview').querySelector('.board-live-stage') as HTMLElement

describe('BoardLivePreview', () => {
  it('SET-7: draws the board with the current card style, tapped style and playmat', () => {
    setSetting('cardStyle', 'classic')
    setSetting('tapStyle', 'sideways')
    setSetting('playmatId', 'ember')
    const { rerender } = render(<BoardLivePreview />)
    expect(stage().classList.contains('card-style-compact')).toBe(false)
    expect(stage().classList.contains('tap-tilted')).toBe(false)
    expect(stage().dataset.playmat).toBe('ember')
    expect(stage().querySelectorAll('.card-slot.tapped')).toHaveLength(1)

    setSetting('cardStyle', 'compact')
    setSetting('tapStyle', 'tilted')
    rerender(<BoardLivePreview />)
    expect(stage().classList.contains('card-style-compact')).toBe(true)
    expect(stage().classList.contains('tap-tilted')).toBe(true)
    expect(stage().querySelectorAll('.card-slot.is-compact').length).toBeGreaterThan(0)
  })

  it('SET-7: follows the P/T badge and summoning sickness choices', () => {
    setSetting('cardStyle', 'classic')
    setSetting('ptBadgeMode', 'always')
    setSetting('sicknessStyle', 'veil')
    const { rerender } = render(<BoardLivePreview />)
    expect(stage().querySelectorAll('.pt-badge')).toHaveLength(3)
    expect(stage().querySelectorAll('.sickness-veil')).toHaveLength(1)

    setSetting('ptBadgeMode', 'changed')
    setSetting('sicknessStyle', 'badge')
    rerender(<BoardLivePreview />)
    expect(stage().querySelectorAll('.pt-badge')).toHaveLength(1)
    expect(stage().querySelectorAll('.sickness-badge')).toHaveLength(1)
    expect(stage().querySelectorAll('.sickness-veil')).toHaveLength(0)

    setSetting('ptBadgeMode', 'hidden')
    rerender(<BoardLivePreview />)
    expect(stage().querySelectorAll('.pt-badge')).toHaveLength(0)
  })

  it('SET-7: shows hand costs only when that option is on', () => {
    setSetting('showHandCost', false)
    const { rerender } = render(<BoardLivePreview />)
    expect(screen.queryAllByTestId('board-live-cost')).toHaveLength(0)
    setSetting('showHandCost', true)
    rerender(<BoardLivePreview />)
    expect(screen.getAllByTestId('board-live-cost')).toHaveLength(2)
  })
})
