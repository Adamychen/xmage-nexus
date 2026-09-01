export const HAND_BAR_MIN_CARD_W = 64
export const HAND_BAR_MAX_CARD_W = 116
export const HAND_CARD_ASPECT = 1.4
export const HAND_BAR_MIN_VISIBLE_RATIO = 0.55
export const HAND_BAR_MAX_GAP = 24
export const HAND_BAR_PADDING_X = 24
export const HAND_BAR_PADDING_Y = 12

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

  const usableW = Math.max(0, availW - HAND_BAR_PADDING_X)

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
