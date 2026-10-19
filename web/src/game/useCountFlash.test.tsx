import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useCountFlash } from './useCountFlash'

describe('useCountFlash', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it('does not flash for the first value', () => {
    const { result } = renderHook(({ n }) => useCountFlash(n), { initialProps: { n: 7 } })
    expect(result.current).toBeNull()
  })

  it('reports the signed change, then clears itself', () => {
    const { result, rerender } = renderHook(({ n }) => useCountFlash(n), { initialProps: { n: 7 } })
    rerender({ n: 5 })
    expect(result.current?.delta).toBe(-2)
    rerender({ n: 8 })
    expect(result.current?.delta).toBe(3)
    act(() => {
      vi.advanceTimersByTime(3000)
    })
    expect(result.current).toBeNull()
  })

  it('stays quiet when the count is unchanged', () => {
    const { result, rerender } = renderHook(({ n }) => useCountFlash(n), { initialProps: { n: 3 } })
    rerender({ n: 3 })
    expect(result.current).toBeNull()
  })
})
