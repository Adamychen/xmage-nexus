import { renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useUntapWave } from './useUntapWave'
import { getState, setState } from '../state/state'
import { getFxDiagnostics, resetFxContext } from '../fx/fxEngine'

function setFx(effects: boolean) {
  setState({ settings: { ...getState().settings, effects } })
}

function setReducedMotion(reduce: boolean) {
  window.matchMedia = vi.fn().mockReturnValue({ matches: reduce }) as unknown as typeof window.matchMedia
}

function board(cards: Array<{ id: string; tapped: boolean; compact?: boolean }>): HTMLElement {
  const scope = document.createElement('div')
  for (const card of cards) {
    const node = document.createElement('div')
    node.dataset.cardId = card.id
    node.dataset.tapped = card.tapped ? '1' : '0'
    if (card.compact) node.classList.add('is-compact')
    scope.appendChild(node)
  }
  document.body.appendChild(scope)
  return scope
}

function setTapped(scope: HTMLElement, id: string, tapped: boolean) {
  const node = scope.querySelector<HTMLElement>(`[data-card-id="${id}"]`)
  if (node) node.dataset.tapped = tapped ? '1' : '0'
}

function renderWave(scope: HTMLElement, tilted = false) {
  return renderHook(({ t }: { t: boolean }) => useUntapWave([scope], t), { initialProps: { t: tilted } })
}

describe('useUntapWave', () => {
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

  it('FX-5: does not wave at mount, even with cards already untapped or tapped', () => {
    const scope = board([{ id: 'a', tapped: true }, { id: 'b', tapped: true }, { id: 'c', tapped: false }])
    renderWave(scope)
    expect(getFxDiagnostics().activeTimelines()).toBe(0)
  })

  it('FX-5: does not wave on a re-render without tap changes', () => {
    const scope = board([{ id: 'a', tapped: true }, { id: 'b', tapped: true }])
    const { rerender } = renderWave(scope)
    rerender({ t: false })
    expect(getFxDiagnostics().activeTimelines()).toBe(0)
  })

  it('plays no wave when only one card untaps', () => {
    const scope = board([{ id: 'a', tapped: true }, { id: 'b', tapped: true }])
    const { rerender } = renderWave(scope)
    setTapped(scope, 'a', false)
    rerender({ t: false })
    expect(getFxDiagnostics().activeTimelines()).toBe(0)
  })

  it('cascades a GSAP timeline when two or more cards untap in the same commit', () => {
    const scope = board([
      { id: 'a', tapped: true },
      { id: 'b', tapped: true },
      { id: 'c', tapped: true },
      { id: 'd', tapped: false },
    ])
    const { rerender } = renderWave(scope)
    setTapped(scope, 'a', false)
    setTapped(scope, 'b', false)
    setTapped(scope, 'c', false)
    rerender({ t: false })
    expect(getFxDiagnostics().activeTimelines()).toBe(1)
  })

  it('FX-2: does nothing under reduced motion', () => {
    setReducedMotion(true)
    const scope = board([{ id: 'a', tapped: true }, { id: 'b', tapped: true }])
    const { rerender } = renderWave(scope)
    setTapped(scope, 'a', false)
    setTapped(scope, 'b', false)
    rerender({ t: false })
    expect(getFxDiagnostics().activeTimelines()).toBe(0)
  })

  it('FX-1: does nothing when effects are off', () => {
    setFx(false)
    const scope = board([{ id: 'a', tapped: true }, { id: 'b', tapped: true }])
    const { rerender } = renderWave(scope)
    setTapped(scope, 'a', false)
    setTapped(scope, 'b', false)
    rerender({ t: false })
    expect(getFxDiagnostics().activeTimelines()).toBe(0)
  })

  it('cancels the running transform transition so the GSAP wave owns the pose', () => {
    const cancel = vi.fn()
    const transform = { transitionProperty: 'transform', cancel }
    const other = { transitionProperty: 'margin', cancel: vi.fn() }
    const scope = board([{ id: 'a', tapped: true }, { id: 'b', tapped: true }])
    const nodeA = scope.querySelector<HTMLElement>('[data-card-id="a"]') as HTMLElement
    Object.defineProperty(nodeA, 'getAnimations', { value: () => [transform, other], configurable: true })
    const { rerender } = renderWave(scope)
    setTapped(scope, 'a', false)
    setTapped(scope, 'b', false)
    rerender({ t: false })
    expect(cancel).toHaveBeenCalledTimes(1)
    expect(other.cancel).not.toHaveBeenCalled()
  })
})
