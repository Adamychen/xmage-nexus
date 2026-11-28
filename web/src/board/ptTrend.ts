import type { CardView } from '../net/types'

export type PtTrend = 'up' | 'down' | 'same'

function toInt(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string' && /^-?\d+$/.test(value.trim())) return Number.parseInt(value, 10)
  return null
}

/**
 * BRD-49: the value the card was printed with, read from the engine's `MageInt`. It is
 * `baseValue`, which is final: `cardValue` is the string the object shows, and
 * `setModifiedBaseValue` overwrites it whenever an effect gives the permanent a new base ("base
 * toughness 1"), so reading it would compare the new base against itself and call it unchanged.
 * A `cardValue` that is not a number is a printed `*`, where there is nothing to compare against.
 */
export function basePtValue(original: unknown): number | null {
  if (original == null) return null
  if (typeof original === 'object') {
    const mage = original as { cardValue?: unknown; baseValue?: unknown }
    if (typeof mage.cardValue === 'string' && mage.cardValue.trim() !== '' && toInt(mage.cardValue) == null) return null
    return toInt(mage.baseValue) ?? toInt(mage.cardValue)
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
