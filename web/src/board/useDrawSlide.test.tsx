import type { RefObject } from 'react'
import { renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useDrawSlide } from './useDrawSlide'
import { getState, setState } from '../state/state'

const ANCHOR = { scope: '.board-shell', select: '.resource-bar.my .library-chip' }

function setFx(effects: boolean) {
  setState({ settings: { ...getState().settings, effects } })
}

function setReducedMotion(reduce: boolean) {
  window.matchMedia = vi.fn().mockReturnValue({ matches: reduce }) as unknown as typeof window.matchMedia
}

function renderDraws(initialIds: string[], enabled = true) {
  const scope = { current: document.createElement('div') } as RefObject<HTMLElement>
  const hook = renderHook(
    ({ ids, on }: { ids: string[]; on: boolean }) => useDrawSlide(scope, ids, on, ANCHOR),
    { initialProps: { ids: initialIds, on: enabled } },
  )
  return { ...hook, rerenderIds: (ids: string[], on = enabled) => hook.rerender({ ids, on }) }
}

describe('useDrawSlide', () => {
  beforeEach(() => {
    setFx(true)
  })

  afterEach(() => {
    delete (window as { matchMedia?: unknown }).matchMedia
  })

  it('FX-5: does not animate the opening hand', () => {
    const { result } = renderDraws(['a', 'b', 'c'])
    expect(result.current.size).toBe(0)
  })

  it('FX-5: marks a card added during the game as a slide', () => {
    const { result, rerenderIds } = renderDraws(['a', 'b'])
    rerenderIds(['a', 'b', 'c'])
    expect(result.current.get('c')).toBe('slide')
    expect(result.current.has('a')).toBe(false)
  })

  it('drops the mark once the card is no longer in the hand', () => {
    const { result, rerenderIds } = renderDraws(['a', 'b'])
    rerenderIds(['a', 'b', 'c'])
    rerenderIds(['a', 'b'])
    expect(result.current.size).toBe(0)
  })

  it('FX-5: does not animate a full hand refresh', () => {
    const { result, rerenderIds } = renderDraws(['a', 'b'])
    rerenderIds(['x', 'y', 'z'])
    expect(result.current.size).toBe(0)
  })

  it('FX-5: does nothing while disabled (mulligan)', () => {
    const { result, rerenderIds } = renderDraws(['a', 'b'], false)
    rerenderIds(['a', 'b', 'c'], false)
    expect(result.current.size).toBe(0)
  })

  it('FX-2: falls back to an opacity-only fade under reduced motion', () => {
    setReducedMotion(true)
    const { result, rerenderIds } = renderDraws(['a'])
    rerenderIds(['a', 'b'])
    expect(result.current.get('b')).toBe('fade')
  })

  it('FX-1: does nothing with effects turned off', () => {
    setFx(false)
    const { result, rerenderIds } = renderDraws(['a'])
    rerenderIds(['a', 'b'])
    expect(result.current.size).toBe(0)
  })
})
