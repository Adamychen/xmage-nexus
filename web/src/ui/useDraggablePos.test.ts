import { describe, expect, it } from 'vitest'
import { clampDragPos, sanitizeDragPos } from './useDraggablePos'

describe('clampDragPos', () => {
  it('keeps an inside position untouched', () => {
    expect(clampDragPos(100, 60, 320, 36, 1024, 768)).toEqual({ left: 100, top: 60 })
  })

  it('pulls an off-screen saved position back into view', () => {
    expect(clampDragPos(5000, 5000, 320, 36, 1024, 768)).toEqual({ left: 696, top: 724 })
  })

  it('clamps negative positions to the margin', () => {
    expect(clampDragPos(-50, -20, 320, 36, 1024, 768)).toEqual({ left: 8, top: 8 })
  })

  it('pins to the margin when the viewport is smaller than the element', () => {
    expect(clampDragPos(400, 300, 320, 36, 200, 20)).toEqual({ left: 8, top: 8 })
  })
})

describe('sanitizeDragPos', () => {
  it('accepts finite pairs', () => {
    expect(sanitizeDragPos({ left: 10, top: 20 })).toEqual({ left: 10, top: 20 })
  })

  it('rejects non-finite and malformed values', () => {
    expect(sanitizeDragPos({ left: NaN, top: 20 })).toBeNull()
    expect(sanitizeDragPos({ left: Infinity, top: 20 })).toBeNull()
    expect(sanitizeDragPos({ left: '10', top: 20 })).toBeNull()
    expect(sanitizeDragPos(null)).toBeNull()
  })
})
