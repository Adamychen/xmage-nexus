import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, renderHook, waitFor } from '@testing-library/react'
import { getState, setState } from '../state/state'

const xmageImplemented = vi.fn()
vi.mock('./xmageCatalog', () => ({ xmageImplemented: (names: string[]) => xmageImplemented(names) }))

const { useXmageUnimplemented } = await import('./useXmageImplemented')

const initialWsAlive = getState().wsAlive

beforeEach(() => {
  xmageImplemented.mockReset()
  xmageImplemented.mockResolvedValue(null)
  setState({ wsAlive: true })
})

afterEach(() => {
  cleanup()
  setState({ wsAlive: initialWsAlive })
})

describe('useXmageUnimplemented', () => {
  it('returns the lowercase names XMage does not implement', async () => {
    xmageImplemented.mockResolvedValue(new Map([['lightning bolt', true], ['unfinity card', false]]))
    const { result } = renderHook(() => useXmageUnimplemented(['Lightning Bolt', 'Unfinity Card']))

    await waitFor(() => expect(result.current).toEqual(new Set(['unfinity card'])))
    // Unique, sorted names: the query does not depend on the search order.
    expect(xmageImplemented).toHaveBeenCalledWith(['Lightning Bolt', 'Unfinity Card'])
  })

  it('without a websocket it neither asks nor flags', () => {
    setState({ wsAlive: false })
    const { result } = renderHook(() => useXmageUnimplemented(['Unfinity Card']))
    expect(result.current.size).toBe(0)
    expect(xmageImplemented).not.toHaveBeenCalled()
  })

  it('asks as soon as the websocket is back', async () => {
    setState({ wsAlive: false })
    xmageImplemented.mockResolvedValue(new Map([['unfinity card', false]]))
    const { result } = renderHook(() => useXmageUnimplemented(['Unfinity Card']))

    act(() => setState({ wsAlive: true }))
    await waitFor(() => expect(result.current).toEqual(new Set(['unfinity card'])))
  })

  it('does not ask for an empty list', () => {
    renderHook(() => useXmageUnimplemented([]))
    expect(xmageImplemented).not.toHaveBeenCalled()
  })

  it('flags nothing without proxy data (null)', async () => {
    xmageImplemented.mockResolvedValue(null)
    const { result } = renderHook(() => useXmageUnimplemented(['Unfinity Card']))
    await waitFor(() => expect(xmageImplemented).toHaveBeenCalled())
    expect(result.current.size).toBe(0)
  })

  it('does not repeat the query on reorder or duplicates', async () => {
    xmageImplemented.mockResolvedValue(new Map([['a', true], ['b', true]]))
    const { rerender } = renderHook(({ names }) => useXmageUnimplemented(names), { initialProps: { names: ['A', 'B'] } })
    await waitFor(() => expect(xmageImplemented).toHaveBeenCalledTimes(1))

    rerender({ names: ['B', 'A', 'A'] })
    await act(async () => {})
    expect(xmageImplemented).toHaveBeenCalledTimes(1)
  })

  it('keeps the same reference when the result does not change', async () => {
    xmageImplemented.mockResolvedValue(new Map([['b', false]]))
    const { result, rerender } = renderHook(({ names }) => useXmageUnimplemented(names), { initialProps: { names: ['B'] } })
    await waitFor(() => expect(result.current).toEqual(new Set(['b'])))
    const first = result.current

    xmageImplemented.mockResolvedValue(new Map([['a', true], ['b', false]]))
    rerender({ names: ['A', 'B'] })
    await waitFor(() => expect(xmageImplemented).toHaveBeenCalledTimes(2))
    await act(async () => {})
    expect(result.current).toBe(first)
  })

  it('drops the answer to a search that was already replaced', async () => {
    let resolveOld!: (m: Map<string, boolean>) => void
    xmageImplemented.mockReturnValueOnce(new Promise((r) => { resolveOld = r }))
    xmageImplemented.mockResolvedValueOnce(new Map([['new card', true]]))

    const { result, rerender } = renderHook(({ names }) => useXmageUnimplemented(names), { initialProps: { names: ['Old Card'] } })
    rerender({ names: ['New Card'] })
    await waitFor(() => expect(xmageImplemented).toHaveBeenCalledTimes(2))

    await act(async () => resolveOld(new Map([['old card', false]])))
    expect(result.current.size).toBe(0)
  })
})
