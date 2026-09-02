import { describe, expect, it } from 'vitest'
import {
  computeHandArc,
  computeHandBarSizing,
  HAND_ARC_MAX_RISE_PX,
  HAND_ARC_MAX_RISE_RATIO,
  HAND_ARC_MAX_ROT_DEG,
  HAND_BAR_MAX_CARD_W,
  HAND_BAR_MAX_GAP,
  HAND_BAR_MAX_SPAN,
  HAND_BAR_MIN_CARD_W,
  HAND_BAR_MIN_VISIBLE_RATIO,
  HAND_BAR_PEEK_RATIO,
  HAND_CARD_ASPECT,
  HAND_BAR_PADDING_Y,
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
    const maxOverlap = -(1 - HAND_BAR_MIN_VISIBLE_RATIO) * HAND_BAR_MAX_CARD_W
    expect(s.gap).toBeGreaterThanOrEqual(maxOverlap)
    expect(s.gap).toBeLessThanOrEqual(HAND_BAR_MAX_GAP)
    expect(s.barHeight).toBe(bandHeight(s.cardW))
  })

  it('very wide screens: the hand never spans beyond the max span', () => {
    for (const availW of [1286, 1686, 2400]) {
      const s = computeHandBarSizing(availW, 7)
      const span = 7 * s.cardW + 6 * s.gap
      expect(span).toBeLessThanOrEqual(HAND_BAR_MAX_SPAN + 1e-9)
    }
  })

  it('tight width: cards shrink keeping the min visible ratio', () => {
    const s = computeHandBarSizing(400, 7)
    expect(s.cardW).toBeGreaterThan(HAND_BAR_MIN_CARD_W)
    expect(s.cardW).toBeLessThan(HAND_BAR_MAX_CARD_W)
    const visible = s.cardW + s.gap
    expect(visible).toBeGreaterThanOrEqual(s.cardW * HAND_BAR_MIN_VISIBLE_RATIO - 1e-9)
  })

  it('very narrow width: clamps at min card width and still respects the ratio', () => {
    const s = computeHandBarSizing(200, 7)
    expect(s.cardW).toBe(HAND_BAR_MIN_CARD_W)
    const visible = s.cardW + s.gap
    expect(visible).toBeGreaterThanOrEqual(s.cardW * HAND_BAR_MIN_VISIBLE_RATIO - 1e-9)
    expect(s.barHeight).toBe(bandHeight(s.cardW))
  })

  it('cards never grow when the hand gets bigger', () => {
    let prev = HAND_BAR_MAX_CARD_W + 1
    for (let count = 1; count <= 12; count++) {
      const s = computeHandBarSizing(640, count)
      expect(s.cardW).toBeLessThanOrEqual(prev)
      prev = s.cardW
    }
  })

  it('bar height is the visible band (half-sunken hand)', () => {
    for (const [w, c] of [[1600, 4], [900, 8], [420, 10]] as const) {
      const s = computeHandBarSizing(w, c)
      expect(s.barHeight).toBe(bandHeight(s.cardW))
    }
  })

  it('peek ratios keep the hand half-visible at rest and ~90% on hover', () => {
    expect(HAND_BAR_PEEK_RATIO).toBeGreaterThan(0.25)
    expect(HAND_BAR_PEEK_RATIO).toBeLessThan(0.75)
  })
})

describe('computeHandArc', () => {
  it('returns empty for a zero-count hand', () => {
    expect(computeHandArc(0, HAND_BAR_MAX_CARD_W)).toEqual([])
  })

  it('single card is straight and centered', () => {
    expect(computeHandArc(1, HAND_BAR_MAX_CARD_W)).toEqual([{ rot: 0, rise: 0 }])
  })

  it('the arc is symmetric around the center card', () => {
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

  it('edges rotate outward and only the center rises to the max', () => {
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
