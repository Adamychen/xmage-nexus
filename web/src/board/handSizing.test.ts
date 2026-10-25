// @vitest-environment node
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import {
  computeHandArc,
  computeHandBarSizing,
  computeHandHoverScale,
  computeHandSideReserve,
  computeCostPipLayout,
  computeCostPipSize,
  handLandsGap,
  handRestHeight,
  handRestStripWidth,
  HAND_BAR_REST_SINK_K,
  HAND_ARC_MAX_RISE_PX,
  HAND_ARC_MAX_RISE_RATIO,
  HAND_ARC_MAX_ROT_DEG,
  HAND_BAR_MAX_CARD_W,
  HAND_BAR_MAX_GAP,
  HAND_BAR_MAX_SPAN,
  HAND_BAR_MIN_CARD_W,
  HAND_BAR_MIN_VISIBLE_RATIO,
  HAND_BAR_PANEL_GAP_PX,
  HAND_BAR_PEEK_RATIO,
  HAND_BAR_REST_OVERLAP_RATIO,
  HAND_CARD_ASPECT,
  HAND_BAR_PADDING_X,
  HAND_BAR_PADDING_Y,
  HAND_HOVER_MIN_SCALE,
  HAND_COST_PIP_CARD_RATIO,
  HAND_COST_PIP_STRIP_RATIO,
  HAND_COST_PIP_MIN_PX,
  HAND_COST_PIP_GAP_PX,
  HAND_COST_MIN_STEP_RATIO,
  HAND_COST_INSET_PX,
  HAND_HOVER_TARGET_W,
} from './handSizing'

const bandHeight = (cardW: number) => cardW * HAND_CARD_ASPECT * HAND_BAR_PEEK_RATIO + HAND_BAR_PADDING_Y

describe('computeHandBarSizing', () => {
  it('returns defaults for empty hand or zero width', () => {
    for (const [w, c] of [[800, 0], [0, 5]] as const) {
      const s = computeHandBarSizing(w, c)
      expect(s.cardW).toBe(HAND_BAR_MAX_CARD_W)
      expect(s.gap).toBe(0)
      expect(s.barHeight).toBe(bandHeight(HAND_BAR_MAX_CARD_W))
    }
  })

  it('single card: max width, no gap', () => {
    const s = computeHandBarSizing(800, 1)
    expect(s.cardW).toBe(HAND_BAR_MAX_CARD_W)
    expect(s.gap).toBe(0)
    expect(s.barHeight).toBe(bandHeight(s.cardW))
  })

  it('ample width: max card size, compact via cap or slight overlap', () => {
    const s = computeHandBarSizing(1286, 7)
    expect(s.cardW).toBe(HAND_BAR_MAX_CARD_W)
    const maxOverlap = -(HAND_BAR_REST_OVERLAP_RATIO - HAND_BAR_MIN_VISIBLE_RATIO) * HAND_BAR_MAX_CARD_W
    expect(s.gap).toBeGreaterThanOrEqual(maxOverlap)
    expect(s.gap).toBeLessThanOrEqual(HAND_BAR_MAX_GAP)
    expect(s.barHeight).toBe(bandHeight(s.cardW))
  })

  it('HND-2: very wide screens: the hand never spans beyond the max span', () => {
    for (const availW of [1286, 1686, 2400]) {
      expect(renderedRowW(availW, 7)).toBeLessThanOrEqual(HAND_BAR_MAX_SPAN + 1e-9)
    }
  })

  it('tight width: cards shrink keeping the min visible ratio', () => {
    const s = computeHandBarSizing(400, 7)
    expect(s.cardW).toBeGreaterThan(HAND_BAR_MIN_CARD_W)
    expect(s.cardW).toBeLessThan(HAND_BAR_MAX_CARD_W)
    expect(handRestStripWidth(s.cardW, s.gap)).toBeGreaterThanOrEqual(s.cardW * HAND_BAR_MIN_VISIBLE_RATIO - 1e-9)
  })

  it('HND-2: very narrow width: clamps at min card width and still respects the ratio', () => {
    const s = computeHandBarSizing(200, 7)
    expect(s.cardW).toBe(HAND_BAR_MIN_CARD_W)
    expect(handRestStripWidth(s.cardW, s.gap)).toBeGreaterThanOrEqual(s.cardW * HAND_BAR_MIN_VISIBLE_RATIO - 1e-9)
    expect(s.barHeight).toBe(bandHeight(s.cardW))
  })

  it('HND-2: cards never grow when the hand gets bigger', () => {
    let prev = HAND_BAR_MAX_CARD_W + 1
    for (let count = 1; count <= 12; count++) {
      const s = computeHandBarSizing(640, count)
      expect(s.cardW).toBeLessThanOrEqual(prev)
      prev = s.cardW
    }
  })

  it('HND-1: bar height is the visible band (half-sunken hand)', () => {
    for (const [w, c] of [[1600, 4], [900, 8], [420, 10]] as const) {
      const s = computeHandBarSizing(w, c)
      expect(s.barHeight).toBe(bandHeight(s.cardW))
    }
  })

  it('HND-1: peek ratios keep the hand half-visible at rest and ~90% on hover', () => {
    expect(HAND_BAR_PEEK_RATIO).toBeGreaterThan(0.25)
    expect(HAND_BAR_PEEK_RATIO).toBeLessThan(0.75)
  })
})

/** Rendered row width: the first card, then one rest pitch per card (CSS: margin-left = gap - cardW * rest overlap). */
const renderedRowW = (availW: number, count: number) => {
  const s = computeHandBarSizing(availW, count)
  return s.cardW + (count - 1) * handRestStripWidth(s.cardW, s.gap)
}
const usableHandW = (availW: number) => Math.min(availW - HAND_BAR_PADDING_X, HAND_BAR_MAX_SPAN)

describe('the hand spreads across the width as cards are added', () => {
  const availW = 1008

  it('a small hand keeps the normal card size and the compact fan', () => {
    const s = computeHandBarSizing(availW, 3)
    expect(s.cardW).toBe(HAND_BAR_MAX_CARD_W)
    expect(s.gap).toBe(HAND_BAR_MAX_GAP)
  })

  it.each([12, 15])('%i cards reach the usable width of the hand', (count) => {
    expect(renderedRowW(availW, count)).toBeCloseTo(usableHandW(availW), 0)
  })

  it('HND-2: cards keep their size until the maximum overlap is reached, then shrink', () => {
    for (let count = 1; count <= 15; count++) {
      const s = computeHandBarSizing(availW, count)
      if (s.cardW < HAND_BAR_MAX_CARD_W - 1e-9) {
        const visible = handRestStripWidth(s.cardW, s.gap)
        expect(visible, `${count} cards: max overlap reached`).toBeCloseTo(s.cardW * HAND_BAR_MIN_VISIBLE_RATIO, 0)
      }
    }
  })
})

describe('the hand stays in the centre band between the side panels', () => {
  const band = { left: 0, right: 1008 }
  const leftPanel = { left: 18, right: 254 }
  const dock = { left: 742, right: 990 }

  it('no side panels: nothing is reserved', () => {
    expect(computeHandSideReserve(band, [])).toEqual({ left: 0, right: 0 })
  })

  it('HND-2: a left panel reserves its inner edge plus the gap, measured from the band edge', () => {
    expect(computeHandSideReserve(band, [leftPanel])).toEqual({ left: 254 + HAND_BAR_PANEL_GAP_PX, right: 0 })
  })

  it('HND-2: a right panel reserves its inner edge plus the gap on the right', () => {
    expect(computeHandSideReserve(band, [dock])).toEqual({ left: 0, right: 1008 - 742 + HAND_BAR_PANEL_GAP_PX })
  })

  it('both sides reserve independently', () => {
    expect(computeHandSideReserve(band, [leftPanel, dock])).toEqual({
      left: 254 + HAND_BAR_PANEL_GAP_PX,
      right: 1008 - 742 + HAND_BAR_PANEL_GAP_PX,
    })
  })

  it.each([8, 15])('%i cards: the row fits the centre band and keeps the minimum visible strip', (count) => {
    const reserve = computeHandSideReserve(band, [leftPanel, dock])
    const centreW = band.right - band.left - reserve.left - reserve.right
    const s = computeHandBarSizing(centreW, count)
    expect(renderedRowW(centreW, count)).toBeLessThanOrEqual(centreW - HAND_BAR_PADDING_X + 1e-9)
    expect(s.cardW).toBeGreaterThanOrEqual(HAND_BAR_MIN_CARD_W)
    expect(handRestStripWidth(s.cardW, s.gap)).toBeGreaterThanOrEqual(s.cardW * HAND_BAR_MIN_VISIBLE_RATIO - 1e-9)
  })

  it('the centre band gives 15 cards smaller cards than the full width, never larger', () => {
    const reserve = computeHandSideReserve(band, [leftPanel, dock])
    const centreW = band.right - band.left - reserve.left - reserve.right
    expect(computeHandBarSizing(centreW, 15).cardW).toBeLessThan(computeHandBarSizing(band.right, 15).cardW)
  })
})

describe('computeHandArc', () => {
  it('returns empty for a zero-count hand', () => {
    expect(computeHandArc(0, HAND_BAR_MAX_CARD_W)).toEqual([])
  })

  it('single card is straight and centered', () => {
    expect(computeHandArc(1, HAND_BAR_MAX_CARD_W)).toEqual([{ rot: 0, rise: 0 }])
  })

  it('HND-1: the arc is symmetric around the center card', () => {
    for (const count of [2, 3, 5, 7, 10]) {
      const arc = computeHandArc(count, HAND_BAR_MAX_CARD_W)
      const mid = (count - 1) / 2
      for (let i = 0; i * 2 < count - 1; i++) {
        expect(arc[i].rot).toBeCloseTo(-arc[count - 1 - i].rot, 10)
        expect(arc[i].rise).toBeCloseTo(arc[count - 1 - i].rise, 10)
      }
      if (count % 2 === 1) expect(arc[Math.floor(mid)].rot).toBeCloseTo(0, 10)
    }
  })

  it('HND-1: edges rotate outward and only the center rises to the max', () => {
    const arc = computeHandArc(7, HAND_BAR_MAX_CARD_W)
    expect(arc[0].rot).toBeLessThan(0)
    expect(arc[6].rot).toBeGreaterThan(0)
    expect(arc[3].rise).toBeCloseTo(Math.min(HAND_ARC_MAX_RISE_RATIO * HAND_BAR_MAX_CARD_W * HAND_CARD_ASPECT, HAND_ARC_MAX_RISE_PX), 10)
    expect(arc[0].rise).toBeCloseTo(0, 10)
  })

  it('the total spread is clamped for very large hands', () => {
    const arc = computeHandArc(20, HAND_BAR_MAX_CARD_W)
    expect(arc[19].rot - arc[0].rot).toBeLessThanOrEqual(HAND_ARC_MAX_ROT_DEG + 1e-9)
    arc.forEach((e) => expect(Math.abs(e.rot)).toBeLessThanOrEqual(HAND_ARC_MAX_ROT_DEG / 2 + 1e-9))
  })

  it('rise scales with the card width and never lifts the edges', () => {
    const small = computeHandArc(7, HAND_BAR_MIN_CARD_W)
    const big = computeHandArc(7, HAND_BAR_MAX_CARD_W)
    expect(big[3].rise).toBeGreaterThan(small[3].rise)
    for (const arc of [small, big]) {
      expect(arc[0].rise).toBe(0)
      expect(arc[6].rise).toBe(0)
      arc.forEach((e) => expect(e.rise).toBeGreaterThanOrEqual(0))
    }
  })
})

describe('computeHandHoverScale', () => {
  it('HND-3: grows the hovered card to the legible target width on a tall viewport', () => {
    expect(computeHandHoverScale(130, 1000) * 130).toBeCloseTo(HAND_HOVER_TARGET_W, 6)
  })

  it('HND-3: caps the grown card height on short viewports', () => {
    const scale = computeHandHoverScale(100, 500)
    expect(scale * 100 * HAND_CARD_ASPECT).toBeLessThanOrEqual(500 * 0.55 + 1e-6)
  })

  it('HND-3: always grows at least a little, even when the card is already large', () => {
    expect(computeHandHoverScale(HAND_BAR_MAX_CARD_W * 2, 1000)).toBe(HAND_HOVER_MIN_SCALE)
    expect(computeHandHoverScale(0, 1000)).toBe(HAND_HOVER_MIN_SCALE)
  })
})

describe('cost bubbles', () => {
  it('HND-6: uses one size proportional to the card, bounded by the visible strip', () => {
    expect(computeCostPipSize(200, 156)).toBe(Math.round(156 * HAND_COST_PIP_CARD_RATIO))
    expect(computeCostPipSize(30, 156)).toBe(Math.round(30 * HAND_COST_PIP_STRIP_RATIO))
    expect(computeCostPipSize(5, 156)).toBe(HAND_COST_PIP_MIN_PX)
  })

  it('keeps short costs spread and stacks long ones inside the strip', () => {
    const size = 18
    expect(computeCostPipLayout(200, size, 3).step).toBe(size + HAND_COST_PIP_GAP_PX)
    const strip = 50
    const { step } = computeCostPipLayout(strip, size, 4)
    expect(step).toBeLessThan(size)
    expect(size + 3 * step).toBeLessThanOrEqual(strip - 2 * HAND_COST_INSET_PX + 0.1)
  })

  it('never stacks beyond the minimum visible share of each bubble', () => {
    expect(computeCostPipLayout(20, 18, 8).step).toBeCloseTo(18 * HAND_COST_MIN_STEP_RATIO, 5)
  })

  it('the rest strip is the distance to the next card', () => {
    expect(handRestStripWidth(100, -10)).toBe(100 * 0.5 - 10)
  })
})

describe('hand rest reserve', () => {
  it('BRD-16: a flat card shows what is left above the band after the rest sink, plus the bar padding', () => {
    const cardH = 100 * HAND_CARD_ASPECT
    expect(handRestHeight(100, [{ rot: 0, rise: 0 }], 6)).toBe(Math.ceil(6 + cardH * (1 - HAND_BAR_PEEK_RATIO * HAND_BAR_REST_SINK_K)))
  })

  it('BRD-16: the arc rise and the rotated top corner raise the reserve, an empty hand reserves nothing', () => {
    const flat = handRestHeight(100, [{ rot: 0, rise: 0 }], 0)
    expect(handRestHeight(100, [{ rot: 0, rise: 10 }], 0)).toBe(flat + 10)
    expect(handRestHeight(100, [{ rot: -8, rise: 0 }], 0)).toBeGreaterThan(flat)
    expect(handRestHeight(100, [{ rot: 8, rise: 0 }, { rot: 0, rise: 12 }], 0)).toBeGreaterThanOrEqual(flat + 12)
    expect(handRestHeight(100, [], 6)).toBe(0)
  })

  it('BRD-16: the gap to the battlefield scales with the viewport height between 6 and 16 px', () => {
    expect(handLandsGap(300)).toBe(6)
    expect(handLandsGap(800)).toBe(12)
    expect(handLandsGap(1440)).toBe(16)
  })

  it('BRD-16: HandBar.css sinks a resting card by the same factor the reserve assumes', () => {
    const css = readFileSync(fileURLToPath(new URL('./HandBar.css', import.meta.url)), 'utf8')
    expect(css).toContain(`var(--hand-sink-k, ${HAND_BAR_REST_SINK_K})`)
  })
})
