import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { CardView } from '../net/types'
import { clearStackHold, enqueueStackResolve, stackHoldSnapshot, useDisplayedStack } from './stackHold'
import { isStackReplacement } from './stackLinks'

const card = (id: string) => ({ id, name: id }) as unknown as CardView
const stackOf = (...ids: string[]) => Object.fromEntries(ids.map((id) => [id, card(id)]))

describe('useDisplayedStack', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    clearStackHold()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('FX-7: keeps a spell that left the stack on display until its resolution is done', () => {
    const { result, rerender } = renderHook(({ game }) => useDisplayedStack(game, 'g1'), {
      initialProps: { game: { stack: stackOf('a', 'b') } },
    })
    rerender({ game: { stack: stackOf('b') } })
    expect(Object.keys(result.current)).toEqual(['a', 'b'])

    let finish = () => {}
    act(() => {
      enqueueStackResolve('a', (done) => {
        finish = done
      })
    })
    act(() => {
      finish()
      vi.advanceTimersByTime(120)
    })
    expect(Object.keys(result.current)).toEqual(['b'])
  })

  it('FX-7: a spell that is still on the stack is never released by its resolution', () => {
    const { result, rerender } = renderHook(({ game }) => useDisplayedStack(game, 'g1'), {
      initialProps: { game: { stack: stackOf('a') } },
    })
    rerender({ game: { stack: {} } })
    rerender({ game: { stack: stackOf('a') } })
    let finish = () => {}
    act(() => {
      enqueueStackResolve('a', (done) => {
        finish = done
      })
    })
    act(() => {
      finish()
    })
    expect(Object.keys(result.current)).toEqual(['a'])
  })

  it('FX-7: a resolution that never reports back is released by the watchdog', () => {
    const { result, rerender } = renderHook(({ game }) => useDisplayedStack(game, 'g1'), {
      initialProps: { game: { stack: stackOf('a') } as { stack?: Record<string, CardView> } | null },
    })
    rerender({ game: { stack: {} } })
    expect(Object.keys(result.current)).toEqual(['a'])

    act(() => {
      enqueueStackResolve('a', () => {})
    })
    expect(Object.keys(result.current)).toEqual(['a'])

    act(() => {
      vi.advanceTimersByTime(2500)
    })
    expect(Object.keys(result.current)).toEqual([])
  })

  it('FX-7: a burst beyond the queue cap drops the extra spells instead of replaying them', () => {
    const ids = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h']
    const { result, rerender } = renderHook(({ game }) => useDisplayedStack(game, 'g1'), {
      initialProps: { game: { stack: stackOf(...ids) } as { stack?: Record<string, CardView> } | null },
    })
    rerender({ game: { stack: {} } })
    expect(Object.keys(result.current)).toEqual(ids)

    act(() => {
      for (const id of ids) enqueueStackResolve(id, () => {})
    })

    expect(Object.keys(result.current)).toEqual(['a', 'b', 'c', 'd', 'e', 'f', 'g'])
    expect(stackHoldSnapshot().queued).toBe(6)
  })

  it('FX-7: the snapshot tells the displayed stack apart from what is still held', () => {
    renderHook(({ game }) => useDisplayedStack(game, 'g1'), {
      initialProps: { game: { stack: stackOf('a') } as { stack?: Record<string, CardView> } | null },
    }).rerender({ game: { stack: {} } })

    expect(stackHoldSnapshot()).toEqual({
      shown: [{ id: 'a', name: 'a' }],
      held: [{ id: 'a', name: 'a' }],
      queued: 0,
      busy: false,
    })
  })

  it('FX-7: shows nothing held once the game changes', () => {
    const { result, rerender } = renderHook(({ game, id }) => useDisplayedStack(game, id), {
      initialProps: { game: { stack: stackOf('a') } as { stack?: Record<string, CardView> } | null, id: 'g1' as string | null },
    })
    rerender({ game: { stack: {} }, id: 'g1' })
    expect(Object.keys(result.current)).toEqual(['a'])
    rerender({ game: { stack: {} }, id: 'g2' })
    expect(Object.keys(result.current)).toEqual([])
  })

  it('FX-7: a fresh screen drops what the previous one held, even with the same game id', () => {
    const first = renderHook(({ game }) => useDisplayedStack(game, 'g1'), {
      initialProps: { game: { stack: stackOf('a') } as { stack?: Record<string, CardView> } | null },
    })
    first.rerender({ game: { stack: {} } })
    expect(Object.keys(first.result.current)).toEqual(['a'])
    first.unmount()

    const second = renderHook(() => useDisplayedStack({ stack: {} }, 'g1'))
    expect(Object.keys(second.result.current)).toEqual([])
  })
})

describe('enqueueStackResolve', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    clearStackHold()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('FX-7: runs one resolution at a time, the next one after the previous one is done and a beat has passed', () => {
    const { rerender } = renderHook(({ game }) => useDisplayedStack(game, 'g1'), {
      initialProps: { game: { stack: stackOf('a', 'b') } as { stack?: Record<string, CardView> } | null },
    })
    rerender({ game: { stack: {} } })
    const started: string[] = []
    let finishA = () => {}
    enqueueStackResolve('a', (done) => {
      started.push('a')
      finishA = done
    })
    enqueueStackResolve('b', (done) => {
      started.push('b')
      done()
    })
    expect(started).toEqual(['a'])
    vi.advanceTimersByTime(1000)
    expect(started).toEqual(['a'])
    act(() => {
      finishA()
    })
    expect(started).toEqual(['a'])
    act(() => {
      vi.advanceTimersByTime(120)
    })
    expect(started).toEqual(['a', 'b'])
  })
})

describe('FX-7: a stack that was replaced resolved nothing', () => {
  it('FX-7: a non-empty stack sharing no id with the one before it holds nothing back', () => {
    expect(isStackReplacement({ a: 1 }, { b: 2 })).toBe(true)
  })

  it('FX-7: a resolution leaves one of the previous ids behind, so it is not a replacement', () => {
    expect(isStackReplacement({ a: 1, b: 2 }, { b: 2 })).toBe(false)
  })

  it('FX-7: the last object resolving empties the stack, which is a resolution, not a replacement', () => {
    expect(isStackReplacement({ a: 1 }, {})).toBe(false)
    expect(isStackReplacement({}, { a: 1 })).toBe(false)
  })
})
