import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { CardView } from '../net/types'
import { clearStackHold, enqueueStackResolve, useDisplayedStack } from './stackHold'

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

  it('FX-7: shows nothing held once the game changes', () => {
    const { result, rerender } = renderHook(({ game, id }) => useDisplayedStack(game, id), {
      initialProps: { game: { stack: stackOf('a') } as { stack?: Record<string, CardView> } | null, id: 'g1' as string | null },
    })
    rerender({ game: { stack: {} }, id: 'g1' })
    expect(Object.keys(result.current)).toEqual(['a'])
    rerender({ game: { stack: {} }, id: 'g2' })
    expect(Object.keys(result.current)).toEqual([])
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
