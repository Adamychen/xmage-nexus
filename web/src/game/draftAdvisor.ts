export interface AdvisorCard {
  id: string
  cmc: number
  colors: string[]
  typeLine: string
  rarity: string
}

export type AdviceReason =
  | 'rare'
  | 'mythic'
  | 'on_colors'
  | 'splash'
  | 'off_colors'
  | 'colorless'
  | 'curve'
  | 'creatures'

export interface PickAdvice {
  id: string
  score: number
  reasons: AdviceReason[]
}

export interface PoolProfile {
  size: number
  colorCounts: Record<string, number>
  mainColors: string[]
  creatures: number
  curve: Record<number, number>
}

const IDEAL_CREATURE_CURVE: Record<number, number> = { 1: 1, 2: 4, 3: 4, 4: 3, 5: 2, 6: 1 }
const RARITY_BASE: Record<string, number> = { common: 0, uncommon: 0.6, rare: 1.6, mythic: 2.2, special: 1, bonus: 1 }
const COMMIT_AFTER = 10
const MIN_PICKS_FOR_COLORS = 4
const SPELL_SCORE_FLOOR = 0.2

function isCreature(card: AdvisorCard): boolean {
  return /\bcreature\b/i.test(card.typeLine)
}

function isBasicLand(card: AdvisorCard): boolean {
  return /\bbasic\b/i.test(card.typeLine) && /\bland\b/i.test(card.typeLine)
}

function isLand(card: AdvisorCard): boolean {
  return /\bland\b/i.test(card.typeLine)
}

function curveBucket(cmc: number): number {
  return Math.min(6, Math.max(1, Math.round(cmc)))
}

export function poolProfile(picks: AdvisorCard[]): PoolProfile {
  const colorCounts: Record<string, number> = {}
  const curve: Record<number, number> = {}
  let creatures = 0
  for (const card of picks) {
    for (const color of card.colors) colorCounts[color] = (colorCounts[color] ?? 0) + 1
    if (isCreature(card) && card.cmc > 0) {
      creatures++
      const bucket = curveBucket(card.cmc)
      curve[bucket] = (curve[bucket] ?? 0) + 1
    }
  }
  const ranked = Object.entries(colorCounts)
    .filter(([, n]) => n >= 2)
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, 2)
    .map(([color]) => color)
  return {
    size: picks.length,
    colorCounts,
    mainColors: picks.length >= MIN_PICKS_FOR_COLORS ? ranked : [],
    creatures,
    curve,
  }
}

export function adviseDraftPick(booster: AdvisorCard[], picks: AdvisorCard[]): PickAdvice[] {
  const profile = poolProfile(picks)
  const commitment = Math.min(1, profile.size / COMMIT_AFTER)
  const advice: PickAdvice[] = []

  for (const card of booster) {
    const reasons: AdviceReason[] = []
    let score = RARITY_BASE[card.rarity.toLowerCase()] ?? 0
    if (card.rarity === 'rare') reasons.push('rare')
    if (card.rarity === 'mythic') reasons.push('mythic')

    if (isBasicLand(card)) {
      score -= 3
    } else if (isLand(card)) {
      score += 0.3
    } else if (card.colors.length === 0) {
      score += 0.6
      reasons.push('colorless')
    } else if (profile.mainColors.length > 0) {
      const inMain = card.colors.filter((c) => profile.mainColors.includes(c)).length
      if (inMain === card.colors.length) {
        score += 2.4 * commitment
        reasons.push('on_colors')
      } else if (inMain > 0) {
        score += 0.6 * commitment
        reasons.push('splash')
      } else {
        score -= 2 * commitment
        reasons.push('off_colors')
      }
    }

    if (isCreature(card) && card.cmc > 0 && !isLand(card)) {
      const bucket = curveBucket(card.cmc)
      const need = (IDEAL_CREATURE_CURVE[bucket] ?? 0) - (profile.curve[bucket] ?? 0)
      if (need > 0) {
        score += Math.min(need, 2) * 0.5
        reasons.push('curve')
      }
      if (profile.size >= 8 && profile.creatures / profile.size < 0.45) {
        score += 0.8
        reasons.push('creatures')
      }
    } else if (!isLand(card)) {
      score += SPELL_SCORE_FLOOR
    }

    advice.push({ id: card.id, score: Math.round(score * 100) / 100, reasons })
  }

  return advice.sort((a, b) => b.score - a.score || a.id.localeCompare(b.id))
}
