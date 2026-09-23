import { describe, expect, it } from 'vitest'
import { heartbeatCount, heartbeatIntervalMs, lowLifeLevel } from './lowLife'

describe('lowLifeLevel', () => {
  it('is calm above five life', () => {
    expect(lowLifeLevel({ life: 20, counters: [] })).toBe(0)
    expect(lowLifeLevel({ life: 6, counters: [] })).toBe(0)
  })

  it('warns at five or less and turns critical at two or less', () => {
    expect(lowLifeLevel({ life: 5, counters: [] })).toBe(1)
    expect(lowLifeLevel({ life: 2, counters: [] })).toBe(2)
    expect(lowLifeLevel({ life: -3, counters: [] })).toBe(2)
  })

  it('also reacts to poison counters', () => {
    expect(lowLifeLevel({ life: 20, counters: [{ name: 'poison', count: 7 }] })).toBe(1)
    expect(lowLifeLevel({ life: 20, counters: [{ name: 'Poison', count: 9 }] })).toBe(2)
  })

  it('handles missing players', () => {
    expect(lowLifeLevel(null)).toBe(0)
    expect(lowLifeLevel(undefined)).toBe(0)
  })

  it('beats faster and longer when critical', () => {
    expect(heartbeatCount(0)).toBe(0)
    expect(heartbeatCount(2)).toBeGreaterThan(heartbeatCount(1))
    expect(heartbeatIntervalMs(2)).toBeLessThan(heartbeatIntervalMs(1))
  })
})
