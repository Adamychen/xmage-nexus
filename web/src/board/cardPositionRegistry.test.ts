import { describe, expect, it } from 'vitest'
import {
  getFallbackSourceRect,
  getPreviousCardPosition,
  getPreviousCardSize,
  recordCardPosition,
  consumePreviousCardPosition,
} from './cardPositionRegistry'

describe('cardPositionRegistry', () => {
  it('records and retrieves card positions correctly', () => {
    const dummyRect = {
      left: 100,
      top: 200,
      width: 80,
      height: 112,
      right: 180,
      bottom: 312,
      x: 100,
      y: 200,
      toJSON: () => ({}),
    } as DOMRect

    recordCardPosition('c123', dummyRect, 'hand-zone')
    const result = getPreviousCardPosition('c123')
    expect(result).not.toBeNull()
    expect(result?.left).toBe(100)
    expect(result?.top).toBe(200)

    const consumed = consumePreviousCardPosition('c123')
    expect(consumed).not.toBeNull()
    expect(consumed?.zone).toBe('hand-zone')
    expect(consumePreviousCardPosition('c123')).toBeNull()
  })

  it('returns null for unknown card ids', () => {
    expect(getPreviousCardPosition('unknown-999')).toBeNull()
    expect(consumePreviousCardPosition('unknown-999')).toBeNull()
  })

  it('stores and returns the real card size', () => {
    const dummyRect = {
      left: 10, top: 20, width: 140, height: 100, right: 150, bottom: 120, x: 10, y: 20, toJSON: () => ({}),
    } as DOMRect

    recordCardPosition('c-size', dummyRect, 'battlefield', { w: 100, h: 140 })
    expect(getPreviousCardSize('c-size')).toEqual({ w: 100, h: 140 })

    const consumed = consumePreviousCardPosition('c-size')
    expect(consumed?.size).toEqual({ w: 100, h: 140 })
  })

  it('ignores invalid sizes', () => {
    const dummyRect = {
      left: 10, top: 20, width: 80, height: 112, right: 90, bottom: 132, x: 10, y: 20, toJSON: () => ({}),
    } as DOMRect

    recordCardPosition('c-bad-size', dummyRect, 'battlefield', { w: 0, h: 140 })
    expect(getPreviousCardSize('c-bad-size')).toBeNull()
    expect(getPreviousCardSize('unknown-size')).toBeNull()
  })

  it('handles getFallbackSourceRect gracefully without DOM root', () => {
    const div = document.createElement('div')
    expect(getFallbackSourceRect(div)).toBeNull()
  })
})
