import { describe, expect, it } from 'vitest'
import { seatNodePosition } from './seatLayout'
import { radioNavIndex } from './radioNav'

describe('seatNodePosition', () => {
  it('puts the first seat at the bottom centre and the opposite seat at the top', () => {
    expect(seatNodePosition(0, 2)).toEqual({ x: 50, y: 80 })
    expect(seatNodePosition(1, 2)).toEqual({ x: 50, y: 20 })
  })

  it('keeps every seat inside the table box for any seat count', () => {
    for (let count = 1; count <= 8; count++) {
      for (let i = 0; i < count; i++) {
        const { x, y } = seatNodePosition(i, count)
        expect(x).toBeGreaterThanOrEqual(0)
        expect(x).toBeLessThanOrEqual(100)
        expect(y).toBeGreaterThanOrEqual(0)
        expect(y).toBeLessThanOrEqual(100)
      }
    }
  })

  it('spreads seats evenly, so no two seats share a position', () => {
    const keys = Array.from({ length: 4 }, (_, i) => {
      const { x, y } = seatNodePosition(i, 4)
      return `${x},${y}`
    })
    expect(new Set(keys).size).toBe(4)
  })
})

describe('radioNavIndex', () => {
  it('wraps around with the arrow keys', () => {
    expect(radioNavIndex('ArrowRight', 2, 3)).toBe(0)
    expect(radioNavIndex('ArrowLeft', 0, 3)).toBe(2)
    expect(radioNavIndex('ArrowDown', 1, 3)).toBe(2)
    expect(radioNavIndex('ArrowUp', 1, 3)).toBe(0)
  })

  it('jumps to the ends with Home and End', () => {
    expect(radioNavIndex('Home', 2, 4)).toBe(0)
    expect(radioNavIndex('End', 0, 4)).toBe(3)
  })

  it('ignores other keys and empty groups', () => {
    expect(radioNavIndex('Enter', 0, 3)).toBeNull()
    expect(radioNavIndex('ArrowRight', 0, 0)).toBeNull()
  })
})
