import { describe, expect, it } from 'vitest'
import { resolveBadgeLayout, type BadgeBox } from './badgeLayout'

const box = (zone: string, edge: 'top' | 'bottom', left: number, top: number, w: number, h: number): BadgeBox => ({ id: zone, zone, edge, left, right: left + w, top, bottom: top + h })
const roomy = { top: 0, bottom: 200 }

describe('resolveBadgeLayout', () => {
  it('leaves zones that do not overlap where they are', () => {
    const { shifts, hidden } = resolveBadgeLayout([box('sickness', 'top', 4, 4, 18, 18), box('designation', 'top', 60, 4, 36, 12)], roomy)
    expect(shifts.get('sickness')).toBe(0)
    expect(shifts.get('designation')).toBe(0)
    expect(hidden.size).toBe(0)
  })

  it('pushes the lower priority zone below the higher priority one', () => {
    const { shifts } = resolveBadgeLayout([box('designation', 'top', 40, 4, 56, 40), box('keyword', 'top', 50, 22, 40, 20)], roomy)
    expect(shifts.get('designation')).toBe(0)
    expect(shifts.get('keyword')).toBe(44 - 22 + 2)
  })

  it('chains: a shifted zone can no longer collide with the next one', () => {
    const boxes = [box('designation', 'top', 40, 4, 56, 30), box('keyword', 'top', 40, 10, 50, 16), box('stats', 'top', 40, 20, 40, 10)]
    const { shifts } = resolveBadgeLayout(boxes, roomy)
    const placed = boxes.map((b) => ({ ...b, top: b.top + (shifts.get(b.zone) ?? 0), bottom: b.bottom + (shifts.get(b.zone) ?? 0) }))
    for (let i = 0; i < placed.length; i++) {
      for (let j = i + 1; j < placed.length; j++) {
        expect(placed[i].bottom <= placed[j].top || placed[j].bottom <= placed[i].top, `${placed[i].zone} vs ${placed[j].zone}`).toBe(true)
      }
    }
  })

  it('moves bottom zones up and treats the two edges independently', () => {
    const { shifts } = resolveBadgeLayout([box('stats', 'bottom', 60, 80, 30, 14), box('counters', 'bottom', 50, 82, 40, 14), box('mana', 'top', 4, 4, 20, 14)], roomy)
    expect(shifts.get('stats')).toBe(0)
    expect(shifts.get('counters')).toBe(80 - 96 - 2)
    expect(shifts.get('mana')).toBe(0)
  })

  it('hides the lowest priority top zone that no longer fits above the bottom zones', () => {
    const boxes = [
      box('designation', 'top', 20, 4, 40, 30),
      box('keyword', 'top', 20, 10, 40, 16),
      box('stats', 'bottom', 20, 40, 30, 14),
    ]
    const { shifts, hidden } = resolveBadgeLayout(boxes, { top: 0, bottom: 70 })
    expect(hidden.has('keyword')).toBe(true)
    expect(hidden.has('designation')).toBe(false)
    expect(shifts.get('keyword')).toBe(0)
  })

  it('a hidden zone does not push the ones after it', () => {
    const boxes = [box('designation', 'top', 20, 4, 40, 60), box('keyword', 'top', 20, 4, 40, 16), box('stats', 'top', 20, 4, 10, 6)]
    const { hidden, shifts } = resolveBadgeLayout(boxes, { top: 0, bottom: 80 })
    expect(hidden.has('keyword')).toBe(true)
    expect(shifts.get('stats')).toBe(64 - 4 + 2)
    expect(hidden.has('stats')).toBe(false)
  })
})
