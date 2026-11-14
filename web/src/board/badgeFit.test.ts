import { describe, expect, it } from 'vitest'
import { visibleBadges } from './badgeFit'

describe('visibleBadges', () => {
  it('shows everything when the row has room', () => {
    expect(visibleBadges(3, 100, 20, 2)).toBe(3)
  })

  it('keeps one slot for the +N chip when badges are hidden', () => {
    expect(visibleBadges(5, 64, 20, 2)).toBe(2)
  })

  it('falls back to the +N chip alone when only one slot fits', () => {
    expect(visibleBadges(5, 10, 20, 2)).toBe(0)
  })

  it('shows all of them when the row cannot be measured', () => {
    expect(visibleBadges(5, 0, 0, 0)).toBe(5)
  })

  it('never exceeds the row: n badges plus gaps fit the width', () => {
    for (let width = 20; width <= 140; width += 7) {
      const n = visibleBadges(5, width, 18, 2)
      const slots = n < 5 ? n + 1 : n
      expect(slots * 18 + (slots - 1) * 2 <= Math.max(width, 18), `width ${width}`).toBe(true)
    }
  })
})

describe('BRD-52: badges in several lanes', () => {
  it('BRD-52: a strip in two lanes holds twice as many badges before it needs the "+N" chip', () => {
    // Room for four in a lane: four fit in one lane, eight in two.
    expect(visibleBadges(4, 70, 16, 2)).toBe(4)
    expect(visibleBadges(5, 70, 16, 2)).toBe(3)
    expect(visibleBadges(8, 70, 16, 2, 2)).toBe(8)
    expect(visibleBadges(9, 70, 16, 2, 2)).toBe(7)
    expect(visibleBadges(4, 70, 16, 2, 2)).toBe(4)
  })
})
