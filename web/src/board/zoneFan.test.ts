import { describe, expect, it } from 'vitest'
import { FAN_SLICE, FAN_STEP_DEG, PILE_DEPTH, PILE_STEP_DEG, clampFanScroll, fanDrop, fanMaxScroll, fanRadius, fanSlot, fanWindow, pileWidth, scrollFromThumb, thumbLeft } from './zoneFan'

describe('fan window', () => {
  it('BRD-24: shows as many cards as fit at the resting overlap, never squeezing them', () => {
    expect(fanWindow(3, 200, 1200)).toBe(3)
    expect(fanWindow(20, 200, 1200)).toBe(Math.floor((1200 - 2 * pileWidth(200) - 200) / (200 * FAN_SLICE)) + 1)
    expect(fanWindow(0, 200, 1200)).toBe(0)
    expect(fanWindow(5, 0, 1200)).toBe(5)
  })

  it('BRD-24: the arc radius makes neighbouring cards overlap by the resting slice', () => {
    const r = fanRadius(200)
    const chord = 2 * r * Math.sin((FAN_STEP_DEG * Math.PI) / 360)
    expect(chord).toBeCloseTo(200 * FAN_SLICE, 5)
    expect(fanDrop(200, 1)).toBe(0)
    expect(fanDrop(200, 7)).toBeGreaterThan(0)
  })
})

describe('fan slots', () => {
  it('BRD-24: the window is a symmetric arc around its middle card', () => {
    expect(fanSlot(3, 0, 7)).toEqual({ angleDeg: 0, shown: true, piled: false })
    expect(fanSlot(0, 0, 7).angleDeg).toBe(-3 * FAN_STEP_DEG)
    expect(fanSlot(6, 0, 7).angleDeg).toBe(3 * FAN_STEP_DEG)
    expect(fanSlot(7, 0, 7).shown).toBe(false)
  })

  it('BRD-24: the cards past the window gather in a tight pile at each side, a few deep', () => {
    const edge = 3 * FAN_STEP_DEG
    expect(fanSlot(7, 0, 7)).toEqual({ angleDeg: edge + PILE_STEP_DEG, shown: false, piled: true })
    expect(fanSlot(6 + PILE_DEPTH, 0, 7).piled).toBe(true)
    expect(fanSlot(7 + PILE_DEPTH, 0, 7)).toMatchObject({ shown: false, piled: false })
    expect(fanSlot(7 + PILE_DEPTH, 0, 7).angleDeg).toBeCloseTo(edge + PILE_DEPTH * PILE_STEP_DEG)
    expect(fanSlot(0, 2, 7)).toEqual({ angleDeg: -(edge + 2 * PILE_STEP_DEG), shown: false, piled: true })
    expect(fanWindow(10, 200, 1200)).toBe(10)
    expect(fanDrop(200, 7, true)).toBeGreaterThan(fanDrop(200, 7))
  })

  it('BRD-24: scrolling slides the cards along the arc and shows the next ones', () => {
    expect(fanSlot(7, 1, 7)).toEqual({ angleDeg: 3 * FAN_STEP_DEG, shown: true, piled: false })
    expect(fanSlot(0, 1, 7).shown).toBe(false)
    expect(fanMaxScroll(12, 7)).toBe(5)
    expect(clampFanScroll(9, 12, 7)).toBe(5)
    expect(clampFanScroll(-1, 12, 7)).toBe(0)
  })
})

describe('fan thumb', () => {
  it('BRD-24: travels its line end to end and maps back onto the scroll', () => {
    expect(thumbLeft(0, 5, 400, 52)).toBe(0)
    expect(thumbLeft(5, 5, 400, 52)).toBe(348)
    expect(thumbLeft(3, 0, 400, 52)).toBe(0)
    expect(scrollFromThumb(174, 5, 400, 52)).toBeCloseTo(2.5)
    expect(scrollFromThumb(999, 5, 400, 52)).toBe(5)
    expect(scrollFromThumb(-9, 5, 400, 52)).toBe(0)
  })
})
