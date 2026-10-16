import { describe, it, expect, afterEach } from 'vitest'
import { render, cleanup } from '@testing-library/react'
import RankEmblem from './RankEmblem'
import { RANK_EMBLEM_SVG } from './rankEmblems'
import type { RankTier } from './ranking'

const TIERS: RankTier[] = ['BRONZE', 'SILVER', 'GOLD', 'PLATINUM', 'DIAMOND', 'MYTHIC']

describe('RankEmblem', () => {
  afterEach(() => {
    cleanup()
  })

  it('has a distinct shield emblem for every league', () => {
    const markup = TIERS.map((tier) => RANK_EMBLEM_SVG[tier])
    for (const svg of markup) expect(svg).toContain('<svg')
    expect(new Set(markup).size).toBe(TIERS.length)
  })

  it('renders the league svg inside a decorative wrapper', () => {
    const { container } = render(<RankEmblem tier="MYTHIC" />)
    const wrapper = container.querySelector('.rank-emblem')
    expect(wrapper?.getAttribute('aria-hidden')).toBe('true')
    expect(wrapper?.querySelector('svg polygon')).not.toBeNull()
  })
})
