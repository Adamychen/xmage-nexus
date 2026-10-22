import { renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useUntapWave } from './useUntapWave'
import { getState, setState } from '../state/state'

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

  it('FX-5: does not wave at mount, even with cards already untapped or tapped', () => {
    const scope = board([{ id: 'a', tapped: true }, { id: 'b', tapped: true }, { id: 'c', tapped: false }])
    renderWave(scope)
    expect(animate).not.toHaveBeenCalled()
  })

  it('FX-5: does not wave on a re-render without tap changes', () => {
    const scope = board([{ id: 'a', tapped: true }, { id: 'b', tapped: true }])
    const { rerender } = renderWave(scope)
    rerender({ t: false })
    expect(animate).not.toHaveBeenCalled()
  })

  it('plays no wave when only one card untaps', () => {
    const scope = board([{ id: 'a', tapped: true }, { id: 'b', tapped: true }])
    const { rerender } = renderWave(scope)
    setTapped(scope, 'a', false)
    rerender({ t: false })
    expect(animate).not.toHaveBeenCalled()
  })

  it('cascades when two cards untap in the same commit, delayed by index x 40 ms', () => {
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
    expect(animate).toHaveBeenCalledTimes(3)
    const delays = animate.mock.calls.map((call) => (call[1] as { delay: number }).delay)
    expect(delays).toEqual([0, 40, 80])
    const options = animate.mock.calls[0][1] as { duration: number; fill: string }
    expect(options.duration).toBe(250)
    expect(options.fill).toBe('backwards')
  })

  it('starts each card from the normal tapped pose (rotate 90deg) and unrotates it', () => {
    const scope = board([{ id: 'a', tapped: true }, { id: 'b', tapped: true }])
    const { rerender } = renderWave(scope)
    setTapped(scope, 'a', false)
    setTapped(scope, 'b', false)
    rerender({ t: false })
    const frames = animate.mock.calls[0][0] as Array<{ rotate: string; scale: string }>
    expect(frames[0]).toMatchObject({ rotate: '90deg' })
    expect(frames[frames.length - 1]).toMatchObject({ rotate: '0deg', scale: '1' })
  })

  it('uses the tilted pose (45deg) when tapStyle is tilted', () => {
    const scope = board([{ id: 'a', tapped: true }, { id: 'b', tapped: true }])
    const { rerender } = renderWave(scope, true)
    setTapped(scope, 'a', false)
    setTapped(scope, 'b', false)
    rerender({ t: true })
    const frames = animate.mock.calls[0][0] as Array<{ rotate: string; scale: string }>
    expect(frames[0]).toMatchObject({ rotate: '45deg', scale: '0.825' })
  })

  it('keeps the compact scale in the starting pose', () => {
    const scope = board([{ id: 'a', tapped: true, compact: true }, { id: 'b', tapped: true, compact: true }])
    const { rerender } = renderWave(scope)
    setTapped(scope, 'a', false)
    setTapped(scope, 'b', false)
    rerender({ t: false })
    const frames = animate.mock.calls[0][0] as Array<{ rotate: string; scale: string }>
    expect(frames[0]).toMatchObject({ rotate: '90deg', scale: '0.75' })
  })

  it('FX-2: does nothing under reduced motion', () => {
    setReducedMotion(true)
    const scope = board([{ id: 'a', tapped: true }, { id: 'b', tapped: true }])
    const { rerender } = renderWave(scope)
    setTapped(scope, 'a', false)
    setTapped(scope, 'b', false)
    rerender({ t: false })
    expect(animate).not.toHaveBeenCalled()
  })

  it('FX-1: does nothing when effects are off', () => {
    setFx(false)
    const scope = board([{ id: 'a', tapped: true }, { id: 'b', tapped: true }])
    const { rerender } = renderWave(scope)
    setTapped(scope, 'a', false)
    setTapped(scope, 'b', false)
    rerender({ t: false })
    expect(animate).not.toHaveBeenCalled()
  })

  it('cancels the running transform transition so the wave owns the pose', () => {
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
