import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { priorityMove, usePriorityOrbs } from './usePriorityOrbs'
import { getState, setState } from '../state/state'

function setFx(effects: boolean) {
  setState({ settings: { ...getState().settings, effects } })
}

function setReducedMotion(reduce: boolean) {
  window.matchMedia = vi.fn().mockReturnValue({ matches: reduce }) as unknown as typeof window.matchMedia
}

function mountAvatar(playerId: string, left: number) {
  const el = document.createElement('div')
  el.dataset.playerAnchor = playerId
  el.getBoundingClientRect = () => ({ left, top: 40, width: 30, height: 30, right: left + 30, bottom: 70, x: left, y: 40, toJSON: () => ({}) }) as DOMRect
  document.body.append(el)
}

describe('priorityMove', () => {
  it('reports a holder change within the same game', () => {
    expect(priorityMove({ gameId: 'g', holderId: 'p1' }, { gameId: 'g', holderId: 'p2' })).toEqual({ from: 'p1', to: 'p2' })
  })

  it('reports nothing on the first frame, on the same holder, or without a holder', () => {
    expect(priorityMove(null, { gameId: 'g', holderId: 'p1' })).toBeNull()
    expect(priorityMove({ gameId: 'g', holderId: 'p1' }, { gameId: 'g', holderId: 'p1' })).toBeNull()
    expect(priorityMove({ gameId: 'g', holderId: 'p1' }, { gameId: 'g', holderId: null })).toBeNull()
    expect(priorityMove({ gameId: 'g', holderId: null }, { gameId: 'g', holderId: 'p1' })).toBeNull()
  })

  it('reports nothing when a new game starts', () => {
    expect(priorityMove({ gameId: 'g1', holderId: 'p1' }, { gameId: 'g2', holderId: 'p2' })).toBeNull()
  })
})

describe('usePriorityOrbs', () => {
  beforeEach(() => {
    setFx(true)
    mountAvatar('p1', 100)
    mountAvatar('p2', 400)
  })

  afterEach(() => {
    document.body.innerHTML = ''
    delete (window as { matchMedia?: unknown }).matchMedia
  })

  it('does not fire on the first frame of a game', () => {
    const { result, rerender } = renderHook(({ g, h }) => usePriorityOrbs(g, h), { initialProps: { g: null as string | null, h: null as string | null } })
    rerender({ g: 'g', h: 'p1' })
    expect(result.current.orbs).toHaveLength(0)
  })

  it('fires once per holder change and not on repeated updates', () => {
    const { result, rerender } = renderHook(({ g, h }) => usePriorityOrbs(g, h), { initialProps: { g: 'g', h: 'p1' as string | null } })
    expect(result.current.orbs).toHaveLength(0)
    rerender({ g: 'g', h: 'p2' })
    expect(result.current.orbs).toHaveLength(1)
    expect(result.current.orbs[0]).toMatchObject({ x0: 115, x1: 415, ms: 400 })
    rerender({ g: 'g', h: 'p2' })
    rerender({ g: 'g', h: 'p2' })
    expect(result.current.orbs).toHaveLength(1)
    rerender({ g: 'g', h: 'p1' })
    expect(result.current.orbs).toHaveLength(2)
  })

  it('removes an orb when it reports done', () => {
    const { result, rerender } = renderHook(({ g, h }) => usePriorityOrbs(g, h), { initialProps: { g: 'g', h: 'p1' as string | null } })
    rerender({ g: 'g', h: 'p2' })
    const id = result.current.orbs[0].id
    act(() => result.current.done(id))
    expect(result.current.orbs).toHaveLength(0)
  })

  it('skips the orb under reduced motion and with effects off', () => {
    setReducedMotion(true)
    const reduced = renderHook(({ g, h }) => usePriorityOrbs(g, h), { initialProps: { g: 'g', h: 'p1' as string | null } })
    reduced.rerender({ g: 'g', h: 'p2' })
    expect(reduced.result.current.orbs).toHaveLength(0)
    reduced.unmount()
    delete (window as { matchMedia?: unknown }).matchMedia
    setFx(false)
    const off = renderHook(({ g, h }) => usePriorityOrbs(g, h), { initialProps: { g: 'g', h: 'p1' as string | null } })
    off.rerender({ g: 'g', h: 'p2' })
    expect(off.result.current.orbs).toHaveLength(0)
  })
})
