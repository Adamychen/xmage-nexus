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
  it('calculates Bronze tier for ELO < 1400', () => {
    const rank = getRankInfo(1200)
    expect(rank.tier).toBe('BRONZE')
    expect(rank.name).toBe('Bronce')
    expect(rank.icon).toBe('medal')
    expect(rank.nextTierName).toBe('Plata')
  })

  it('calculates Silver tier for default 1500 ELO', () => {
    const rank = getRankInfo(1500)
    expect(rank.tier).toBe('SILVER')
    expect(rank.name).toBe('Plata')
    expect(rank.icon).toBe('medal')
    expect(rank.nextTierName).toBe('Oro')
  })

  it('calculates Gold tier for 1650 ELO', () => {
    const rank = getRankInfo(1650)
    expect(rank.tier).toBe('GOLD')
    expect(rank.name).toBe('Oro')
    expect(rank.icon).toBe('medal')
    expect(rank.nextTierName).toBe('Platino')
  })

  it('calculates Platinum tier for 1750 ELO', () => {
    const rank = getRankInfo(1750)
    expect(rank.tier).toBe('PLATINUM')
    expect(rank.name).toBe('Platino')
    expect(rank.icon).toBe('award')
    expect(rank.nextTierName).toBe('Diamante')
  })

  it('calculates Diamond tier for 1900 ELO', () => {
    const rank = getRankInfo(1900)
    expect(rank.tier).toBe('DIAMOND')
    expect(rank.name).toBe('Diamante')
    expect(rank.icon).toBe('gem')
    expect(rank.nextTierName).toBe('Mítico')
  })

  it('calculates Mythic tier for ELO >= 2000', () => {
    const rank = getRankInfo(2150)
    expect(rank.tier).toBe('MYTHIC')
    expect(rank.name).toBe('Mítico')
    expect(rank.icon).toBe('crown')
    expect(rank.nextTierName).toBeNull()
    expect(rank.progressPercent).toBe(100)
  })
})
