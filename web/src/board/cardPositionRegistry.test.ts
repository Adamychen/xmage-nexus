import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  blindCardPositions,
  clearCardPositionRegistry,
  getPreviousCardImage,
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

describe('FX-13: a card in flight wears the picture it had on the board', () => {
  it('FX-13: the registry keeps the picture a card was showing when it left', () => {
    const rect = { width: 100, height: 140 } as DOMRect
    recordCardPosition('bolt-1', rect, 'stack-zone', { w: 100, h: 140 }, 'https://img/bolt.jpg')
    expect(getPreviousCardImage('bolt-1')).toBe('https://img/bolt.jpg')
  })

  it('FX-13: a card recorded without a picture reports none, it does not invent one', () => {
    const rect = { width: 100, height: 140 } as DOMRect
    recordCardPosition('bolt-2', rect, 'stack-zone')
    expect(getPreviousCardImage('bolt-2')).toBeNull()
    expect(getPreviousCardImage('never-seen')).toBeNull()
  })
})

describe('FX-15: two unrelated views are never diffed', () => {
  const rect = { width: 100, height: 140 } as DOMRect

  beforeEach(() => {
    vi.useFakeTimers()
    clearCardPositionRegistry()
  })

  afterEach(() => {
    blindCardPositions(0)
    vi.useRealTimers()
  })

  it('FX-15: a blind registry forgets where the cards of the view being left behind stood', () => {
    recordCardPosition('forest-1', rect, 'board-zone')
    blindCardPositions(160)
    expect(getPreviousCardPosition('forest-1')).toBeNull()
  })

  it('FX-15: nothing is written while it is blind, so the board being left behind cannot fill it', () => {
    blindCardPositions(160)
    recordCardPosition('forest-1', rect, 'board-zone')
    vi.advanceTimersByTime(200)
    expect(getPreviousCardPosition('forest-1')).toBeNull()
  })

  it('FX-15: the window is a moment, not a mode: the board records again once it has passed', () => {
    blindCardPositions(160)
    vi.advanceTimersByTime(200)
    recordCardPosition('forest-1', rect, 'board-zone')
    expect(getPreviousCardPosition('forest-1')).not.toBeNull()
  })
})
