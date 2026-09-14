import { describe, expect, it, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import ManaPie, { ManaPieLegend, manaShare, type ManaPieSlice } from './ManaPie'

const SLICES: ManaPieSlice[] = [
  { key: 'R', label: 'Red', value: 6, color: '#d94a3a', pip: 'R' },
  { key: 'U', label: 'Blue', value: 2, color: '#5aa0d8', pip: 'U' },
]

describe('ManaPie', () => {
  afterEach(() => {
    cleanup()
  })

  it('renders one arc per slice and the center total', () => {
    const { container } = render(<ManaPie slices={SLICES} centerValue={8} ariaLabel="Color pip breakdown" />)

    expect(container.querySelectorAll('.mana-pie-slice').length).toBe(2)
    expect(screen.getByText('8')).toBeDefined()
    expect(screen.getByRole('img', { name: 'Color pip breakdown' })).toBeDefined()
  })

  it('draws a gapless ring for a single slice', () => {
    const { container } = render(<ManaPie slices={[SLICES[0]]} ariaLabel="One color" />)
    const arc = container.querySelector('.mana-pie-slice')
    const [dash, gap] = (arc?.getAttribute('stroke-dasharray') ?? '').split(' ').map(Number)

    expect(dash).toBeGreaterThan(0)
    expect(gap).toBe(0)
  })

  it('leaves a gap between slices when there are several', () => {
    const { container } = render(<ManaPie slices={SLICES} ariaLabel="Two colors" />)
    const arcs = container.querySelectorAll('.mana-pie-slice')
    const [, gap] = (arcs[0].getAttribute('stroke-dasharray') ?? '').split(' ').map(Number)

    expect(gap).toBeGreaterThan(0)
  })

  it('returns null without positive values', () => {
    const { container } = render(<ManaPie slices={[]} ariaLabel="Empty" />)
    expect(container.querySelector('.mana-pie')).toBeNull()
  })

  it('lists counts and shares in the legend', () => {
    render(<ManaPieLegend slices={SLICES} total={8} />)

    expect(screen.getByText('6')).toBeDefined()
    expect(screen.getByText('2')).toBeDefined()
    expect(screen.getByText('75%')).toBeDefined()
    expect(screen.getByText('25%')).toBeDefined()
  })

  it('computes shares with rounding and a small-slice floor', () => {
    expect(manaShare(1, 3)).toBe('33%')
    expect(manaShare(1, 200)).toBe('<1%')
    expect(manaShare(199, 200)).toBe('100%')
    expect(manaShare(0, 0)).toBe('0%')
    expect(manaShare(0, 5)).toBe('0%')
  })
})
