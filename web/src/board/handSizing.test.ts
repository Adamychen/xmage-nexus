import { describe, expect, it } from 'vitest'
import {
  computeHandBarSizing,
  HAND_BAR_MAX_CARD_W,
  HAND_BAR_MIN_CARD_W,
  HAND_BAR_MIN_VISIBLE_RATIO,
  HAND_CARD_ASPECT,
  HAND_BAR_PADDING_Y,
} from './handSizing'

describe('computeHandBarSizing', () => {
  it('returns defaults for empty hand or zero width', () => {
    for (const [w, c] of [[800, 0], [0, 5]] as const) {
      const s = computeHandBarSizing(w, c)
      expect(s.cardW).toBe(HAND_BAR_MAX_CARD_W)
      expect(s.gap).toBe(0)
      expect(s.barHeight).toBe(HAND_BAR_MAX_CARD_W * HAND_CARD_ASPECT + HAND_BAR_PADDING_Y)
    }
  })

  it('single card: max width, no gap', () => {
    const s = computeHandBarSizing(800, 1)
    expect(s.cardW).toBe(HAND_BAR_MAX_CARD_W)
    expect(s.gap).toBe(0)
    expect(s.barHeight).toBe(s.cardW * HAND_CARD_ASPECT + HAND_BAR_PADDING_Y)
  })

  it('ample width: max card size, gap capped for a centered hand', () => {
    const s = computeHandBarSizing(1286, 7)
    expect(s.cardW).toBe(HAND_BAR_MAX_CARD_W)
    expect(s.gap).toBeGreaterThan(0)
    expect(s.gap).toBeLessThanOrEqual(24)
    expect(s.barHeight).toBe(s.cardW * HAND_CARD_ASPECT + HAND_BAR_PADDING_Y)
  })

  it('tight width: cards shrink keeping the min visible ratio', () => {
    const s = computeHandBarSizing(500, 7)
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
    expect(s.barHeight).toBe(s.cardW * HAND_CARD_ASPECT + HAND_BAR_PADDING_Y)
  })

  it('cards never grow when the hand gets bigger', () => {
    let prev = HAND_BAR_MAX_CARD_W + 1
    for (let count = 1; count <= 12; count++) {
      const s = computeHandBarSizing(640, count)
      expect(s.cardW).toBeLessThanOrEqual(prev)
      prev = s.cardW
    }
  })

  it('bar height always derives from card width', () => {
    for (const [w, c] of [[1600, 4], [900, 8], [420, 10]] as const) {
      const s = computeHandBarSizing(w, c)
      expect(s.barHeight).toBe(s.cardW * HAND_CARD_ASPECT + HAND_BAR_PADDING_Y)
    }
  })
})
