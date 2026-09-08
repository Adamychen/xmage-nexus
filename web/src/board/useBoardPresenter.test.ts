import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { PREVIEW_LEAVE_MS, useBoardPresenter } from './useBoardPresenter'
import type { CardView } from '../net/types'

describe('useBoardPresenter preview leaving', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  const card = { name: 'Lightning Bolt', manaValue: 1 } as CardView
  const rect = { left: 0, top: 0, right: 90, bottom: 126, width: 90, height: 126 } as DOMRect

  it('keeps the preview mounted in leaving phase, then clears it', () => {
    const { result } = renderHook(() => useBoardPresenter({ game: null }))

    act(() => {
      result.current.handleCardHover(card, rect)
    })
    expect(result.current.floatingCard).toBe(card)
    expect(result.current.previewLeaving).toBe(false)

    act(() => {
      result.current.handleCardHover(null)
    })
    expect(result.current.previewLeaving).toBe(true)
    expect(result.current.floatingCard).toBe(card)
    expect(result.current.anchorRect).toBe(rect)

    act(() => {
      vi.advanceTimersByTime(PREVIEW_LEAVE_MS)
    })
    expect(result.current.floatingCard).toBeNull()
    expect(result.current.anchorRect).toBeNull()
    expect(result.current.previewLeaving).toBe(false)
  })

  it('cancels leaving when hovering again before the timeout', () => {    const onCardHover = vi.fn()
    const { result } = renderHook(() => useBoardPresenter({ game: null, onCardHover }))

    act(() => {
      result.current.handleCardHover(card, rect)
    })
    act(() => {
      result.current.handleCardHover(null)
    })
    expect(result.current.previewLeaving).toBe(true)

    act(() => {
      result.current.handleCardHover(card, rect)
    })
    expect(result.current.previewLeaving).toBe(false)

    act(() => {
      vi.advanceTimersByTime(PREVIEW_LEAVE_MS)
    })
    expect(result.current.floatingCard).toBe(card)
    expect(onCardHover).not.toHaveBeenCalledWith(null)
  })

  it('tracks whether the hover comes from the hand', () => {
    const { result } = renderHook(() => useBoardPresenter({ game: null }))
    expect(result.current.previewFromHand).toBe(false)

    act(() => {
      result.current.handleCardHover(card, rect)
    })
    expect(result.current.previewFromHand).toBe(false)

    act(() => {
      result.current.handleCardHover(card, rect, { fromHand: true })
    })
    expect(result.current.previewFromHand).toBe(true)

    act(() => {
      result.current.handleCardHover(null)
    })
    expect(result.current.previewFromHand).toBe(true)

    act(() => {
      vi.advanceTimersByTime(PREVIEW_LEAVE_MS)
    })
    expect(result.current.previewFromHand).toBe(false)
  })
})
