export const HAND_BAR_MIN_CARD_W = 64
export const HAND_BAR_MAX_CARD_W = 156
export const HAND_CARD_ASPECT = 1.4
/** Smallest visible strip of a card at the maximum overlap (the fan's rest pitch never goes below it). */
export const HAND_BAR_MIN_VISIBLE_RATIO = 0.35
export const HAND_BAR_REST_OVERLAP_RATIO = 0.5
export const HAND_BAR_MAX_GAP = 6
export const HAND_BAR_MAX_SPAN = 1100
export const HAND_BAR_PADDING_X = 24
export const HAND_BAR_PADDING_Y = 12
/** Clear space kept between the hand's centre band and a side panel it sits beside. */
export const HAND_BAR_PANEL_GAP_PX = 16

export const HAND_BAR_PEEK_RATIO = 0.5

export const HAND_HOVER_TARGET_W = 260
export const HAND_HOVER_MAX_VIEWPORT_H_RATIO = 0.55
export const HAND_HOVER_MIN_SCALE = 1.15

export const HAND_COST_PIP_CARD_RATIO = 0.13
export const HAND_COST_PIP_STRIP_RATIO = 0.45
export const HAND_COST_PIP_MIN_PX = 10
export const HAND_COST_PIP_GAP_PX = 2
export const HAND_COST_MIN_STEP_RATIO = 0.35
export const HAND_COST_INSET_PX = 4

export const HAND_ARC_ROT_PER_CARD = 2.6
export const HAND_ARC_MAX_ROT_DEG = 18
export const HAND_ARC_MAX_RISE_RATIO = 0.08
export const HAND_ARC_MAX_RISE_PX = 16
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

export interface HandSpan {
  left: number
  right: number
}

export interface HandSideReserve {
  left: number
  right: number
}

/** The part of the hand's band that side panels take from each edge. A panel left of the band's
 *  centre reserves its inner edge (plus the gap) from the left edge; one right of it, from the right. */
export function computeHandSideReserve(band: HandSpan, panels: HandSpan[]): HandSideReserve {
  const mid = (band.left + band.right) / 2
  const reserve = { left: 0, right: 0 }
  for (const panel of panels) {
    if ((panel.left + panel.right) / 2 < mid) {
      const inset = panel.right - band.left
      if (inset > 0) reserve.left = Math.max(reserve.left, inset + HAND_BAR_PANEL_GAP_PX)
    } else {
      const inset = band.right - panel.left
      if (inset > 0) reserve.right = Math.max(reserve.right, inset + HAND_BAR_PANEL_GAP_PX)
    }
  }
  return reserve
}

export function computeHandBarSizing(availW: number, count: number): HandBarSizing {
  if (count <= 0 || availW <= 0) {
    return {
      cardW: HAND_BAR_MAX_CARD_W,
      gap: 0,
      barHeight: HAND_BAR_MAX_CARD_W * HAND_CARD_ASPECT * HAND_BAR_PEEK_RATIO + HAND_BAR_PADDING_Y,
    }
  }

  const usableW = Math.max(0, Math.min(availW - HAND_BAR_PADDING_X, HAND_BAR_MAX_SPAN))

  if (count === 1 || usableW <= 0) {
    const cardW = Math.min(HAND_BAR_MAX_CARD_W, Math.max(HAND_BAR_MIN_CARD_W, usableW))
    return { cardW, gap: 0, barHeight: cardW * HAND_CARD_ASPECT * HAND_BAR_PEEK_RATIO + HAND_BAR_PADDING_Y }
  }

  // Cards keep their size while the row still fits at the maximum overlap; past that they shrink.
  const fitW = usableW / (1 + (count - 1) * HAND_BAR_MIN_VISIBLE_RATIO)
  const cardW = Math.min(HAND_BAR_MAX_CARD_W, Math.max(HAND_BAR_MIN_CARD_W, fitW))

  // The rendered pitch is the rest strip (cardW * (1 - rest overlap)) plus the gap.
  // The gap spreads the row over the usable width, bounded by the maximum overlap
  // and by the compact fan's max gap.
  const pitch = (usableW - cardW) / (count - 1)
  const minGap = -(HAND_BAR_REST_OVERLAP_RATIO - HAND_BAR_MIN_VISIBLE_RATIO) * cardW
  const gap = Math.min(HAND_BAR_MAX_GAP, Math.max(minGap, pitch - cardW * (1 - HAND_BAR_REST_OVERLAP_RATIO)))

  return { cardW, gap, barHeight: cardW * HAND_CARD_ASPECT * HAND_BAR_PEEK_RATIO + HAND_BAR_PADDING_Y }
}

export function computeHandHoverScale(cardW: number, viewportH: number): number {
  if (cardW <= 0) return HAND_HOVER_MIN_SCALE
  const byHeight = viewportH > 0 ? (viewportH * HAND_HOVER_MAX_VIEWPORT_H_RATIO) / HAND_CARD_ASPECT : HAND_HOVER_TARGET_W
  const targetW = Math.min(HAND_HOVER_TARGET_W, byHeight)
  return Math.max(HAND_HOVER_MIN_SCALE, targetW / cardW)
}

/** Visible width of a hand card at rest: the distance to the next card. */
export function handRestStripWidth(cardW: number, gap: number): number {
  return cardW * (1 - HAND_BAR_REST_OVERLAP_RATIO) + gap
}

export interface CostPipLayout {
  size: number
  /** Offset between consecutive bubble starts; below `size` they stack. */
  step: number
}

/** One bubble size for the whole hand, proportional to the card and to the
 *  strip each card shows at rest. */
export function computeCostPipSize(stripW: number, cardW: number): number {
  const size = Math.min(cardW * HAND_COST_PIP_CARD_RATIO, stripW * HAND_COST_PIP_STRIP_RATIO)
  return Math.max(HAND_COST_PIP_MIN_PX, Math.round(size))
}

/** Long costs stack their bubbles so the group stays inside the card's
 *  visible strip (never over the neighbour's cost). */
export function computeCostPipLayout(stripW: number, size: number, count: number): CostPipLayout {
  const natural = size + HAND_COST_PIP_GAP_PX
  if (count <= 1) return { size, step: natural }
  const fit = (stripW - 2 * HAND_COST_INSET_PX - size) / (count - 1)
  const step = Math.max(size * HAND_COST_MIN_STEP_RATIO, Math.min(natural, fit))
  return { size, step: Math.round(step * 10) / 10 }
}
