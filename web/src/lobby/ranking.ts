import type { IconName } from '../ui/Icon'

export type RankTier = 'BRONZE' | 'SILVER' | 'GOLD' | 'PLATINUM' | 'DIAMOND' | 'MYTHIC'

export interface RankInfo {
  tier: RankTier
  name: string
  subTier: string // 'IV', 'III', 'II', 'I' or 'Top'
  label: string // e.g. 'Oro II', 'Mythic'
  icon: IconName
  color: string
  bg: string
  border: string
  minElo: number
  maxElo: number
  nextTier: RankTier | null
  nextTierName: string | null
  nextTierMinElo: number | null
  progressPercent: number
}

export const RANK_TIERS_CONFIG: Array<{
  tier: RankTier
  name: string
  minElo: number
  maxElo: number
  icon: IconName
  color: string
  bg: string
  border: string
  subTierStarts: readonly number[]
}> = [
  {
    tier: 'BRONZE',
    name: 'Bronze',
    minElo: 0,
    maxElo: 1135,
    subTierStarts: [0, 885, 985, 1051],
    icon: 'medal',
    color: '#d97706',
    bg: 'rgba(217, 119, 6, 0.15)',
    border: 'rgba(217, 119, 6, 0.4)',
  },
  {
    tier: 'SILVER',
    name: 'Silver',
    minElo: 1136,
    maxElo: 1359,
    subTierStarts: [1136, 1177, 1250, 1298],
    icon: 'medal',
    color: '#e5e7eb',
    bg: 'rgba(229, 231, 235, 0.15)',
    border: 'rgba(229, 231, 235, 0.35)',
  },
  {
    tier: 'GOLD',
    name: 'Gold',
    minElo: 1360,
    maxElo: 1519,
    subTierStarts: [1360, 1401, 1429, 1473],
    icon: 'medal',
    color: '#facc15',
    bg: 'rgba(250, 204, 21, 0.15)',
    border: 'rgba(250, 204, 21, 0.45)',
  },
  {
    tier: 'PLATINUM',
    name: 'Platinum',
    minElo: 1520,
    maxElo: 1610,
    subTierStarts: [1520, 1541, 1557, 1580],
    icon: 'award',
    color: '#38bdf8',
    bg: 'rgba(56, 189, 248, 0.15)',
    border: 'rgba(56, 189, 248, 0.45)',
  },
  {
    tier: 'DIAMOND',
    name: 'Diamond',
    minElo: 1611,
    maxElo: 1687,
    subTierStarts: [1611, 1628, 1648, 1662],
    icon: 'gem',
    color: '#818cf8',
    bg: 'rgba(129, 140, 248, 0.18)',
    border: 'rgba(129, 140, 248, 0.5)',
  },
  {
    tier: 'MYTHIC',
    name: 'Mythic',
    minElo: 1688,
    maxElo: 3000,
    subTierStarts: [],
    icon: 'crown',
    color: '#fb923c',
    bg: 'rgba(251, 146, 60, 0.2)',
    border: 'rgba(251, 146, 60, 0.6)',
  },
]

export function getRankInfo(eloInput?: number | string | null): RankInfo {
  const elo = typeof eloInput === 'number' ? eloInput : parseInt(String(eloInput ?? '1500'), 10) || 1500

  // Mythic Tier
  if (elo >= 1688) {
    return {
      tier: 'MYTHIC',
      name: 'Mythic',
    subTier: 'Top',
    label: 'Mythic',
    icon: 'crown',
      color: '#fb923c',
      bg: 'rgba(251, 146, 60, 0.2)',
      border: 'rgba(251, 146, 60, 0.6)',
      minElo: 1688,
      maxElo: 3000,
      nextTier: null,
      nextTierName: null,
      nextTierMinElo: null,
      progressPercent: 100,
    }
  }

  // Find corresponding tier config
  const config =
    RANK_TIERS_CONFIG.find((c) => elo >= c.minElo && elo <= c.maxElo) ??
    RANK_TIERS_CONFIG[1] // Silver default

  const tierSpan = config.maxElo - config.minElo + 1
  const progressInTier = Math.max(0, elo - config.minElo)
  const subTierIndex = Math.max(0, config.subTierStarts.filter((start) => elo >= start).length - 1) // 0: IV, 1: III, 2: II, 3: I
  const subTierNumerals = ['IV', 'III', 'II', 'I']
  const subTier = subTierNumerals[subTierIndex]

  const configIndex = RANK_TIERS_CONFIG.findIndex((c) => c.tier === config.tier)
  const nextConfig = configIndex < RANK_TIERS_CONFIG.length - 1 ? RANK_TIERS_CONFIG[configIndex + 1] : null
  const progressPercent = Math.min(100, Math.max(0, Math.round((progressInTier / tierSpan) * 100)))

  return {
    tier: config.tier,
    name: config.name,
    subTier,
    label: `${config.name} ${subTier}`,
    icon: config.icon,
    color: config.color,
    bg: config.bg,
    border: config.border,
    minElo: config.minElo,
    maxElo: config.maxElo,
    nextTier: nextConfig?.tier ?? null,
    nextTierName: nextConfig?.name ?? null,
    nextTierMinElo: nextConfig?.minElo ?? null,
    progressPercent,
  }
}

export function getTierName(tier: RankTier, t?: (ns: 'lobby', key: string) => string): string {
  if (!t) {
    const fallbackMap: Record<RankTier, string> = {
      BRONZE: 'Bronze',
      SILVER: 'Silver',
      GOLD: 'Gold',
      PLATINUM: 'Platinum',
      DIAMOND: 'Diamond',
      MYTHIC: 'Mythic',
    }
    return fallbackMap[tier] ?? tier
  }
  const keyMap: Record<RankTier, string> = {
    BRONZE: 'tier_bronze',
    SILVER: 'tier_silver',
    GOLD: 'tier_gold',
    PLATINUM: 'tier_platinum',
    DIAMOND: 'tier_diamond',
    MYTHIC: 'tier_mythic',
  }
  return t('lobby', keyMap[tier])
}

export function getRankLabel(rank: RankInfo, t?: (ns: 'lobby', key: string) => string): string {
  const name = getTierName(rank.tier, t)
  return rank.tier === 'MYTHIC' ? name : `${name} ${rank.subTier}`
}

/**
 * Rating to display for one in-game player from the `userData` that travels
 * with every `PlayerView` (the same rule as the staging roster: limited tables
 * use `limitedRating`, everything else `constructedRating`, falling back to
 * `generalRating`). `null` means there is no real data, so no badge is drawn —
 * never a fabricated default 1500 (same rule that removed the lying ping dash).
 */
export function playerRankRating(
  userData: { generalRating?: number; constructedRating?: number; limitedRating?: number } | null | undefined,
  limited = false,
): number | null {
  if (!userData) return null
  const primary = limited ? userData.limitedRating : userData.constructedRating
  const value = primary && primary > 0 ? primary : userData.generalRating
  return value && value > 0 ? value : null
}
