import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, act } from '@testing-library/react'
import { useState } from 'react'
import { useDragScroll } from './useDragScroll'

if (typeof window.PointerEvent === 'undefined') {
  window.PointerEvent = window.MouseEvent as any
}

function TestBand({ mounted = true }: { mounted?: boolean }) {
  const [band, setBand] = useState<HTMLDivElement | null>(null)
  useDragScroll<HTMLDivElement>(band)
  return mounted ? (
    <div
      ref={setBand}
      data-testid="band"
      style={{ width: 200, overflowX: 'auto' }}
    >
      <div style={{ width: 600 }}>Inner content</div>
    </div>
  ) : null
}

describe('useDragScroll', () => {
  const originalRect = Element.prototype.getBoundingClientRect

  afterEach(() => {
    cleanup()
    Element.prototype.getBoundingClientRect = originalRect
    vi.useRealTimers()
  })

  beforeEach(() => {
    // In JSDOM layout is not computed, so mock properties
    Element.prototype.getBoundingClientRect = () => ({
      width: 200,
      height: 100,
      top: 0,
      left: 0,
      right: 200,
      bottom: 100,
      x: 0,
      y: 0,
      toJSON: () => {},
    })
  })

  it('renders and detects drag interaction when overflowing', () => {
    const { getByTestId } = render(<TestBand />)
    const band = getByTestId('band')

    Object.defineProperty(band, 'clientWidth', { value: 200, configurable: true })
    Object.defineProperty(band, 'scrollWidth', { value: 600, configurable: true })
    Object.defineProperty(band, 'scrollLeft', { value: 0, writable: true, configurable: true })

    const pDown = new MouseEvent('pointerdown', { button: 0 })
    Object.defineProperty(pDown, 'pageX', { value: 100 })
    band.dispatchEvent(pDown)

    const pMove = new MouseEvent('pointermove', {})
    Object.defineProperty(pMove, 'pageX', { value: 50 })
    window.dispatchEvent(pMove)

    expect(band.classList.contains('is-dragging')).toBe(true)
    expect(band.scrollLeft).toBe(50)

    window.dispatchEvent(new MouseEvent('pointerup'))
    expect(band.classList.contains('is-dragging')).toBe(false)
  })

  it('cancels the post-drag click guard on unmount (no timer outlives the component)', () => {
    vi.useFakeTimers()
    const { getByTestId, unmount } = render(<TestBand />)
    const band = getByTestId('band')
    Object.defineProperty(band, 'clientWidth', { value: 200, configurable: true })
    Object.defineProperty(band, 'scrollWidth', { value: 600, configurable: true })
    Object.defineProperty(band, 'scrollLeft', { value: 0, writable: true, configurable: true })

    const pDown = new MouseEvent('pointerdown', { button: 0 })
    Object.defineProperty(pDown, 'pageX', { value: 100 })
    band.dispatchEvent(pDown)
    const pMove = new MouseEvent('pointermove', {})
    Object.defineProperty(pMove, 'pageX', { value: 50 })
    window.dispatchEvent(pMove)
    window.dispatchEvent(new MouseEvent('pointerup'))

    expect(vi.getTimerCount()).toBe(1)
    unmount()
    expect(vi.getTimerCount()).toBe(0)

    const click = new MouseEvent('click', { bubbles: true, cancelable: true })
    document.body.dispatchEvent(click)
    expect(click.defaultPrevented).toBe(false)
  })

  it('translates vertical wheel to horizontal scroll when overflowing', () => {
    const { getByTestId } = render(<TestBand />)
    const band = getByTestId('band')

    Object.defineProperty(band, 'clientWidth', { value: 200, configurable: true })
    Object.defineProperty(band, 'scrollWidth', { value: 600, configurable: true })
    Object.defineProperty(band, 'scrollLeft', { value: 0, writable: true, configurable: true })

    const wheelEvt = new WheelEvent('wheel', { deltaY: 45, deltaX: 0, cancelable: true })
    band.dispatchEvent(wheelEvt)

    expect(band.scrollLeft).toBe(45)
  })

  it('wires up a band that mounts after the first render', () => {
    const { queryByTestId, rerender } = render(<TestBand mounted={false} />)
    expect(queryByTestId('band')).toBeNull()
    rerender(<TestBand mounted />)
    const band = queryByTestId('band')!
    Object.defineProperty(band, 'clientWidth', { value: 200, configurable: true })
    Object.defineProperty(band, 'scrollWidth', { value: 600, configurable: true })
    Object.defineProperty(band, 'scrollLeft', { value: 0, writable: true, configurable: true })

    const wheel = new WheelEvent('wheel', { deltaY: 45, deltaX: 0, cancelable: true })
    act(() => {
      band.dispatchEvent(wheel)
    })
    expect(wheel.defaultPrevented).toBe(true)
    expect(band.scrollLeft).toBe(45)
  })

  it('detaches from a band that unmounts', () => {
    const { queryByTestId, rerender } = render(<TestBand />)
    const band = queryByTestId('band')!
    Object.defineProperty(band, 'clientWidth', { value: 200, configurable: true })
    Object.defineProperty(band, 'scrollWidth', { value: 600, configurable: true })
    Object.defineProperty(band, 'scrollLeft', { value: 0, writable: true, configurable: true })
    rerender(<TestBand mounted={false} />)

    const wheel = new WheelEvent('wheel', { deltaY: 45, deltaX: 0, cancelable: true })
    band.dispatchEvent(wheel)
    expect(wheel.defaultPrevented).toBe(false)
    expect(band.scrollLeft).toBe(0)
  })
})
