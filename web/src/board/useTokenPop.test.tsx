import { renderHook } from '@testing-library/react'
import type { PlayerView } from '../net/types'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useTokenPop } from './useTokenPop'
import { getState, setState } from '../state/state'
import { makePermanent, makePlayer } from '../__fixtures__/gameViews'
import { getFxDiagnostics, resetFxContext } from '../fx/fxEngine'
import { vfx } from '../fx/vfxEngine'

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
  beforeEach(() => {
    resetFxContext()
    setFx(true)
    setReducedMotion(false)
  })

  afterEach(() => {
    resetFxContext()
    delete (window as { matchMedia?: unknown }).matchMedia
    document.body.innerHTML = ''
  })

  it('FX-5: does not pop the existing tokens at mount', () => {
    const scope = board(['t1', 't2'])
    const player = playerWith({
      t1: makePermanent({ name: 'Soldier', isToken: true }),
      t2: makePermanent({ name: 'Soldier', isToken: true }),
    })
    renderHook(({ p }: { p: PlayerView }) => useTokenPop([scope], p), { initialProps: { p: player } })
    expect(getFxDiagnostics().activeTimelines()).toBe(0)
  })

  it('FX-5: pops a token that appears after mount with a GSAP timeline and Canvas VFX', () => {
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
    expect(getFxDiagnostics().activeTimelines()).toBe(1)
    expect(vfx.hasActiveEffects()).toBe(true)
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
    expect(getFxDiagnostics().activeTimelines()).toBe(0)
  })

  it('FX-5: does not pop on a re-render where the token already existed', () => {
    const scope = board(['t1'])
    const player = playerWith({ t1: makePermanent({ name: 'Soldier', isToken: true }) })
    const { rerender } = renderHook(({ p }: { p: PlayerView }) => useTokenPop([scope], p), { initialProps: { p: player } })
    rerender({ p: playerWith({ t1: makePermanent({ name: 'Soldier', isToken: true }) }) })
    expect(getFxDiagnostics().activeTimelines()).toBe(0)
  })

  it('FX-5: records the battlefield of a different player without popping its tokens', () => {
    const scope = board(['t1'])
    const first = playerWith({}, 'p1')
    const { rerender } = renderHook(({ p }: { p: PlayerView }) => useTokenPop([scope], p), { initialProps: { p: first } })
    rerender({ p: playerWith({ t1: makePermanent({ name: 'Soldier', isToken: true }) }, 'p2') })
    expect(getFxDiagnostics().activeTimelines()).toBe(0)
  })

  it('FX-2: fades only (no VFX burst) under reduced motion', () => {
    setReducedMotion(true)
    const scope = board(['t1'])
    const { rerender } = renderHook(({ p }: { p: PlayerView }) => useTokenPop([scope], p), {
      initialProps: { p: playerWith({}) },
    })
    rerender({ p: playerWith({ t1: makePermanent({ name: 'Soldier', isToken: true }) }) })
    expect(getFxDiagnostics().activeTimelines()).toBe(1)
    expect(vfx.hasActiveEffects()).toBe(false)
  })

  it('FX-1: does nothing when effects are off', () => {
    setFx(false)
    const scope = board(['t1'])
    const { rerender } = renderHook(({ p }: { p: PlayerView }) => useTokenPop([scope], p), {
      initialProps: { p: playerWith({}) },
    })
    rerender({ p: playerWith({ t1: makePermanent({ name: 'Soldier', isToken: true }) }) })
    expect(getFxDiagnostics().activeTimelines()).toBe(0)
    expect(vfx.hasActiveEffects()).toBe(false)
  })
})
