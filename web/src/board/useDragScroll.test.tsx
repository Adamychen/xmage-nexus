import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { cleanup, render } from '@testing-library/react'
import { useDragScroll } from './useDragScroll'

if (typeof window.PointerEvent === 'undefined') {
  window.PointerEvent = window.MouseEvent as any
}

function TestBand() {
  const ref = useDragScroll<HTMLDivElement>()
  return (
    <div
      ref={ref}
      data-testid="band"
      style={{ width: 200, overflowX: 'auto' }}
    >
      <div style={{ width: 600 }}>Inner content</div>
    </div>
  )
}

describe('useDragScroll', () => {
  afterEach(() => {
    cleanup()
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
})
