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
