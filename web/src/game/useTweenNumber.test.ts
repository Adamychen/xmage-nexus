import { act } from 'react'
import { renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useTweenNumber } from './useTweenNumber'
import { getState, setState } from '../state/state'

function setEffects(enabled: boolean) {
  setState({ settings: { ...getState().settings, effects: enabled } })
}

describe('useTweenNumber', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['requestAnimationFrame', 'cancelAnimationFrame', 'performance'] })
    setEffects(true)
  })

  afterEach(() => {
    vi.useRealTimers()
    setEffects(true)
  })

  it('shows the initial value without animating', () => {
    const { result } = renderHook(() => useTweenNumber(20))
    expect(result.current).toBe(20)
  })

  it('tweens towards the new value and lands exactly on it', () => {
    const { result, rerender } = renderHook(({ v }) => useTweenNumber(v), {
      initialProps: { v: 20 },
    })

    rerender({ v: 12 })
    expect(result.current).toBe(20)

    act(() => {
      vi.advanceTimersByTime(120)
    })
    const midway = result.current
    expect(midway).toBeGreaterThan(12)
    expect(midway).toBeLessThan(20)

    act(() => {
      vi.advanceTimersByTime(400)
    })
    expect(result.current).toBe(12)
  })

  it('jumps straight to the value when effects are disabled', () => {
    setEffects(false)
    const { result, rerender } = renderHook(({ v }) => useTweenNumber(v), {
      initialProps: { v: 20 },
    })

    rerender({ v: 12 })
    expect(result.current).toBe(12)
  })
})
