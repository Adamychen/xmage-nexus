export const HAND_BAR_MIN_CARD_W = 64
export const HAND_BAR_MAX_CARD_W = 100
export const HAND_CARD_ASPECT = 1.4
export const HAND_BAR_MIN_VISIBLE_RATIO = 0.55
export const HAND_BAR_MAX_GAP = 6
export const HAND_BAR_MAX_SPAN = 640
export const HAND_BAR_PADDING_X = 24
export const HAND_BAR_PADDING_Y = 12

export const HAND_ARC_ROT_PER_CARD = 1.6
export const HAND_ARC_MAX_ROT_DEG = 10
export const HAND_ARC_MAX_RISE_RATIO = 0.03
export const HAND_ARC_MAX_RISE_PX = 4
export const HAND_ARC_PLAYABLE_RISE_PX = 3

export interface HandArcEntry {
  rot: number
  rise: number
}

export function computeHandArc(count: number, cardW: number): HandArcEntry[] {
  if (count <= 0) return []
  if (count === 1) return [{ rot: 0, rise: 0 }]

  const step = Math.min(HAND_ARC_ROT_PER_CARD, HAND_ARC_MAX_ROT_DEG / (count - 1))
  const mid = (count - 1) / 2
  const maxRise = Math.min(HAND_ARC_MAX_RISE_RATIO * cardW * HAND_CARD_ASPECT, HAND_ARC_MAX_RISE_PX)

  return Array.from({ length: count }, (_, i) => {
    const off = (i - mid) / mid
    return { rot: (i - mid) * step, rise: maxRise * (1 - off * off) }
  })
}

export interface HandBarSizing {
  cardW: number
  gap: number
  barHeight: number
}

export function computeHandBarSizing(availW: number, count: number): HandBarSizing {
  if (count <= 0 || availW <= 0) {
    return {
      cardW: HAND_BAR_MAX_CARD_W,
      gap: 0,
      barHeight: HAND_BAR_MAX_CARD_W * HAND_CARD_ASPECT + HAND_BAR_PADDING_Y,
    }
  }

  const usableW = Math.max(0, Math.min(availW - HAND_BAR_PADDING_X, HAND_BAR_MAX_SPAN, availW * 0.8))

  if (count === 1 || usableW <= 0) {
    const cardW = Math.min(HAND_BAR_MAX_CARD_W, Math.max(HAND_BAR_MIN_CARD_W, usableW))
    return { cardW, gap: 0, barHeight: cardW * HAND_CARD_ASPECT + HAND_BAR_PADDING_Y }
  }

  const fitW = usableW / (count - (1 - HAND_BAR_MIN_VISIBLE_RATIO) * (count - 1))
  const cardW = Math.min(HAND_BAR_MAX_CARD_W, Math.max(HAND_BAR_MIN_CARD_W, fitW))
  const maxOverlap = -(1 - HAND_BAR_MIN_VISIBLE_RATIO) * cardW

  const naturalGap = (usableW - count * cardW) / (count - 1)
  const gap = Math.max(maxOverlap, Math.min(HAND_BAR_MAX_GAP, naturalGap))

  return { cardW, gap, barHeight: cardW * HAND_CARD_ASPECT + HAND_BAR_PADDING_Y }
}
