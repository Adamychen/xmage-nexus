import { renderHook } from '@testing-library/react'
import type { PlayerView } from '../net/types'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useTokenPop } from './useTokenPop'
import { getState, setState } from '../state/state'
import { makePermanent, makePlayer } from '../__fixtures__/gameViews'

function setFx(effects: boolean) {
  setState({ settings: { ...getState().settings, effects } })
}

function setReducedMotion(reduce: boolean) {
  window.matchMedia = vi.fn().mockReturnValue({ matches: reduce }) as unknown as typeof window.matchMedia
}

function playerWith(battlefield: Record<string, ReturnType<typeof makePermanent>>, playerId = 'p1'): PlayerView {
  return makePlayer({ playerId, name: 'Alice', battlefield })
}

function board(ids: string[]): HTMLElement {
  const scope = document.createElement('div')
  for (const id of ids) {
    const node = document.createElement('div')
    node.dataset.cardId = id
    node.dataset.tapped = '0'
    scope.appendChild(node)
  }
  document.body.appendChild(scope)
  return scope
}

describe('useTokenPop', () => {
  let animate: ReturnType<typeof vi.fn>

  beforeEach(() => {
    setFx(true)
    setReducedMotion(false)
    animate = vi.fn(() => ({ cancel: vi.fn() }))
    Object.defineProperty(HTMLElement.prototype, 'animate', { value: animate, configurable: true, writable: true })
  })

  afterEach(() => {
    delete (window as { matchMedia?: unknown }).matchMedia
    delete (HTMLElement.prototype as { animate?: unknown }).animate
    document.body.innerHTML = ''
  })

  it('FX-5: does not pop the existing tokens at mount', () => {
    const scope = board(['t1', 't2'])
    const player = playerWith({
      t1: makePermanent({ name: 'Soldier', isToken: true }),
      t2: makePermanent({ name: 'Soldier', isToken: true }),
    })
    renderHook(({ p }: { p: PlayerView }) => useTokenPop([scope], p), { initialProps: { p: player } })
    expect(animate).not.toHaveBeenCalled()
  })

  it('FX-5: pops a token that appears after mount', () => {
    const scope = board(['t1'])
    const first = playerWith({ t1: makePermanent({ name: 'Soldier', isToken: true }) })
    const { rerender } = renderHook(({ p }: { p: PlayerView }) => useTokenPop([scope], p), { initialProps: { p: first } })
    const node = document.createElement('div')
    node.dataset.cardId = 't2'
    scope.appendChild(node)
    rerender({
      p: playerWith({
        t1: makePermanent({ name: 'Soldier', isToken: true }),
        t2: makePermanent({ name: 'Soldier', isToken: true }),
      }),
    })
    expect(animate).toHaveBeenCalledTimes(1)
    expect(animate.mock.instances[0]).toBe(node)
    const frames = animate.mock.calls[0][0] as Array<{ scale: string; rotate: string }>
    expect(frames[0]).toMatchObject({ scale: '0', rotate: '5deg' })
    expect(frames[1]).toMatchObject({ scale: '1.2' })
    expect(frames[2]).toMatchObject({ scale: '1', rotate: '0deg' })
    expect((animate.mock.calls[0][1] as { duration: number }).duration).toBe(300)
  })

  it('does not pop a new card that is not a token', () => {
    const scope = board(['t1'])
    const first = playerWith({ t1: makePermanent({ name: 'Soldier', isToken: true }) })
    const { rerender } = renderHook(({ p }: { p: PlayerView }) => useTokenPop([scope], p), { initialProps: { p: first } })
    rerender({
      p: playerWith({
        t1: makePermanent({ name: 'Soldier', isToken: true }),
        c1: makePermanent({ name: 'Bear' }),
      }),
    })
    expect(animate).not.toHaveBeenCalled()
  })

  it('FX-5: does not pop on a re-render where the token already existed', () => {
    const scope = board(['t1'])
    const player = playerWith({ t1: makePermanent({ name: 'Soldier', isToken: true }) })
    const { rerender } = renderHook(({ p }: { p: PlayerView }) => useTokenPop([scope], p), { initialProps: { p: player } })
    rerender({ p: playerWith({ t1: makePermanent({ name: 'Soldier', isToken: true }) }) })
    expect(animate).not.toHaveBeenCalled()
  })

  it('FX-5: records the battlefield of a different player without popping its tokens', () => {
    const scope = board(['t1'])
    const first = playerWith({}, 'p1')
    const { rerender } = renderHook(({ p }: { p: PlayerView }) => useTokenPop([scope], p), { initialProps: { p: first } })
    rerender({ p: playerWith({ t1: makePermanent({ name: 'Soldier', isToken: true }) }, 'p2') })
    expect(animate).not.toHaveBeenCalled()
  })

  it('FX-2: fades only, under reduced motion', () => {
    setReducedMotion(true)
    const scope = board(['t1'])
    const { rerender } = renderHook(({ p }: { p: PlayerView }) => useTokenPop([scope], p), {
      initialProps: { p: playerWith({}) },
    })
    rerender({ p: playerWith({ t1: makePermanent({ name: 'Soldier', isToken: true }) }) })
    expect(animate).toHaveBeenCalledTimes(1)
    const frames = animate.mock.calls[0][0] as Array<Record<string, unknown>>
    expect(frames.every((frame) => !('scale' in frame))).toBe(true)
    expect(frames[0]).toMatchObject({ opacity: 0 })
  })

  it('FX-1: does nothing when effects are off', () => {
    setFx(false)
    const scope = board(['t1'])
    const { rerender } = renderHook(({ p }: { p: PlayerView }) => useTokenPop([scope], p), {
      initialProps: { p: playerWith({}) },
    })
    rerender({ p: playerWith({ t1: makePermanent({ name: 'Soldier', isToken: true }) }) })
    expect(animate).not.toHaveBeenCalled()
  })

  it('bursts dots from a token that appears after mount, not from the existing ones', () => {
    document.body.innerHTML = ''
    const scope = board(['t1'])
    const first = playerWith({ t1: makePermanent({ name: 'Soldier', isToken: true }) })
    const { rerender } = renderHook(({ p }: { p: PlayerView }) => useTokenPop([scope], p), { initialProps: { p: first } })
    const node = document.createElement('div')
    node.dataset.cardId = 't2'
    node.getBoundingClientRect = () => ({ left: 10, top: 10, width: 60, height: 80, right: 70, bottom: 90, x: 10, y: 10, toJSON: () => ({}) }) as DOMRect
    scope.appendChild(node)
    rerender({
      p: playerWith({
        t1: makePermanent({ name: 'Soldier', isToken: true }),
        t2: makePermanent({ name: 'Soldier', isToken: true }),
      }),
    })
    expect(document.querySelectorAll('.token-burst-dot').length).toBe(6)
  })

  it('measures the token before the pop shrinks it to scale 0', () => {
    document.body.innerHTML = ''
    const scope = board(['t1'])
    const first = playerWith({ t1: makePermanent({ name: 'Soldier', isToken: true }) })
    const { rerender } = renderHook(({ p }: { p: PlayerView }) => useTokenPop([scope], p), { initialProps: { p: first } })
    const node = document.createElement('div')
    node.dataset.cardId = 't2'
    let popped = false
    const open = { left: 10, top: 10, width: 60, height: 80, right: 70, bottom: 90, x: 10, y: 10, toJSON: () => ({}) } as DOMRect
    const shrunk = { ...open, width: 0, height: 0, right: 10, bottom: 10 } as DOMRect
    node.getBoundingClientRect = () => (popped ? shrunk : open)
    node.animate = () => {
      popped = true
      return { cancel: () => {} } as unknown as Animation
    }
    scope.appendChild(node)
    rerender({
      p: playerWith({
        t1: makePermanent({ name: 'Soldier', isToken: true }),
        t2: makePermanent({ name: 'Soldier', isToken: true }),
      }),
    })
    expect(document.querySelectorAll('.token-burst-dot').length).toBe(6)
  })
})
