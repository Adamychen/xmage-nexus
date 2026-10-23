import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, render } from '@testing-library/react'
import ScaledCopy, { copyScale } from './ScaledCopy'

class FakeResizeObserver {
  static instances: FakeResizeObserver[] = []
  constructor(readonly cb: ResizeObserverCallback) {
    FakeResizeObserver.instances.push(this)
  }
  observe() {}
  unobserve() {}
  disconnect() {}
  trigger(width: number, height: number) {
    this.cb([{ contentRect: { width, height } } as ResizeObserverEntry], this as unknown as ResizeObserver)
  }
}

describe('ScaledCopy', () => {
  beforeEach(() => {
    FakeResizeObserver.instances = []
    vi.stubGlobal('ResizeObserver', FakeResizeObserver)
  })
  afterEach(() => {
    cleanup()
    vi.unstubAllGlobals()
  })

  it('BRD-6: a copy is scaled by the smaller of the width and height ratios, so it keeps the main area proportions', () => {
    expect(copyScale(200, 100, 400, 400)).toBeCloseTo(0.25)
    expect(copyScale(100, 300, 400, 400)).toBeCloseTo(0.25)
    expect(copyScale(0, 100, 400, 400)).toBe(0)
    expect(copyScale(100, 100, 0, 400)).toBe(0)

    const { getByTestId, container } = render(
      <ScaledCopy refWidth={400} refHeight={300} testId="copy" playerId="p2">
        <span>board</span>
      </ScaledCopy>,
    )
    const outer = getByTestId('copy')
    expect(outer.getAttribute('data-copy-player')).toBe('p2')
    expect(outer.getAttribute('data-scale')).toBeNull()
    const frame = container.querySelector<HTMLElement>('.spotlight-copy-frame')!
    expect(frame.style.visibility).toBe('hidden')
    expect(frame.textContent).toBe('board')

    act(() => FakeResizeObserver.instances[0].trigger(200, 200))
    expect(outer.getAttribute('data-scale')).toBe('0.5')
    expect(frame.style.transform).toBe('scale(0.5)')
    expect(frame.style.width).toBe('400px')
    expect(frame.style.height).toBe('300px')
    expect(frame.style.left).toBe('0px')
    expect(frame.style.visibility).toBe('')

    act(() => FakeResizeObserver.instances[0].trigger(400, 150))
    expect(outer.getAttribute('data-scale')).toBe('0.5')
    expect(frame.style.left).toBe('100px')
  })
})
