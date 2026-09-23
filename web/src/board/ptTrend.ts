import type { CardView } from '../net/types'

export type PtTrend = 'up' | 'down' | 'same'

function toInt(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string' && /^-?\d+$/.test(value.trim())) return Number.parseInt(value, 10)
  return null
}

export function basePtValue(original: unknown): number | null {
  if (original == null) return null
  if (typeof original === 'object') {
    const mage = original as { cardValue?: unknown; baseValue?: unknown }
    return toInt(mage.cardValue) ?? toInt(mage.baseValue)
  }
  return toInt(original)
}

function trend(current: unknown, base: number | null): PtTrend {
  const now = toInt(current)
  if (now == null || base == null || now === base) return 'same'
  return now > base ? 'up' : 'down'
}

export function ptTrend(card: Pick<CardView, 'power' | 'toughness' | 'originalPower' | 'originalToughness'>): { power: PtTrend; toughness: PtTrend } {
  return {
    power: trend(card.power, basePtValue(card.originalPower)),
    toughness: trend(card.toughness, basePtValue(card.originalToughness)),
  }
}
