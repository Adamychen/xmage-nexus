import { describe, it, expect } from 'vitest'
import { getRankInfo, playerRankRating } from './ranking'

describe('playerRankRating', () => {
  it('reads the ratings carried in PlayerView.userData', () => {
    expect(playerRankRating({ constructedRating: 1650, generalRating: 1600, limitedRating: 1500 })).toBe(1650)
    expect(playerRankRating({ constructedRating: 1650, generalRating: 1600, limitedRating: 1500 }, true)).toBe(1500)
  })

  it('falls back to generalRating when the primary is absent or zero', () => {
    expect(playerRankRating({ generalRating: 1450 })).toBe(1450)
    expect(playerRankRating({ constructedRating: 0, generalRating: 1450 })).toBe(1450)
  })

  it('returns null without real data (no fabricated 1500 badge)', () => {
    expect(playerRankRating(undefined)).toBeNull()
    expect(playerRankRating(null)).toBeNull()
    expect(playerRankRating({})).toBeNull()
    expect(playerRankRating({ constructedRating: 0 })).toBeNull()
    expect(playerRankRating({ generalRating: 0 })).toBeNull()
  })
})

describe('ranking.ts — MTG Arena Tier Calculation', () => {
  it('calculates Bronze tier for ELO < 1136', () => {
    const rank = getRankInfo(1000)
    expect(rank.tier).toBe('BRONZE')
    expect(rank.name).toBe('Bronze')
    expect(rank.icon).toBe('medal')
    expect(rank.nextTierName).toBe('Silver')
  })

  it('calculates Silver tier for 1250 ELO', () => {
    const rank = getRankInfo(1250)
    expect(rank.tier).toBe('SILVER')
    expect(rank.name).toBe('Silver')
    expect(rank.icon).toBe('medal')
    expect(rank.nextTierName).toBe('Gold')
  })

  it('calculates Gold tier for 1450 ELO', () => {
    const rank = getRankInfo(1450)
    expect(rank.tier).toBe('GOLD')
    expect(rank.name).toBe('Gold')
    expect(rank.icon).toBe('medal')
    expect(rank.nextTierName).toBe('Platinum')
  })

  it('calculates Platinum tier for 1580 ELO', () => {
    const rank = getRankInfo(1580)
    expect(rank.tier).toBe('PLATINUM')
    expect(rank.name).toBe('Platinum')
    expect(rank.icon).toBe('award')
    expect(rank.nextTierName).toBe('Diamond')
  })

  it('calculates Diamond tier for 1650 ELO', () => {
    const rank = getRankInfo(1650)
    expect(rank.tier).toBe('DIAMOND')
    expect(rank.name).toBe('Diamond')
    expect(rank.icon).toBe('gem')
    expect(rank.nextTierName).toBe('Mythic')
  })

  it('splits each tier into divisions at the historical quartiles', () => {
    expect(getRankInfo(1000).subTier).toBe('II')
    expect(getRankInfo(1136).subTier).toBe('IV')
    expect(getRankInfo(1358).subTier).toBe('I')
    expect(getRankInfo(1360).subTier).toBe('IV')
    expect(getRankInfo(1450).subTier).toBe('II')
    expect(getRankInfo(1600).subTier).toBe('I')
  })

  it('switches to Mythic exactly at 1688, Diamond below it', () => {
    expect(getRankInfo(1687).tier).toBe('DIAMOND')
    expect(getRankInfo(1688).tier).toBe('MYTHIC')
    expect(getRankInfo(1688).subTier).toBe('Top')
  })

  it('calculates Mythic tier for ELO >= 1688', () => {
    const rank = getRankInfo(2150)
    expect(rank.tier).toBe('MYTHIC')
    expect(rank.name).toBe('Mythic')
    expect(rank.icon).toBe('crown')
    expect(rank.nextTierName).toBeNull()
    expect(rank.progressPercent).toBe(100)
  })
})
