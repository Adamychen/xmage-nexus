import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, act } from '@testing-library/react'
import { useZoneScale } from './useZoneScale'
import { useState } from 'react'

function TestZone({ initialAttach = true }: { initialAttach?: boolean }) {
  const { cardW, ref } = useZoneScale()
  const [attached, setAttached] = useState(initialAttach)

  return (
    <div>
      <button type="button" onClick={() => setAttached(!attached)}>
        toggle
      </button>
      {attached && (
        <div
          ref={ref}
          className="board-zone player-zone"
          data-testid="zone"
          style={{ height: 400, width: 800 }}
        >
          <div className="bz-status-row" style={{ height: 44 }} />
          <span data-testid="card-w">{cardW}</span>
        </div>
      )}
    </div>
  )
}

describe('useZoneScale', () => {
  afterEach(() => {
    cleanup()
  })

  beforeEach(() => {
    Element.prototype.getBoundingClientRect = function () {
      if (this.classList?.contains('board-zone')) {
        return {
          width: 800,
          height: 400,
          top: 0,
          left: 0,
          right: 800,
          bottom: 400,
          x: 0,
          y: 0,
          toJSON: () => {},
        } as DOMRect
      }
      return {
        width: 100,
        height: 44,
        top: 0,
        left: 0,
        right: 100,
        bottom: 44,
        x: 0,
        y: 0,
        toJSON: () => {},
      } as DOMRect
    }
  })

  it('measures card width when initially attached', () => {
    const { getByTestId } = render(<TestZone initialAttach={true} />)
    const cardWText = getByTestId('card-w').textContent
    const cardW = Number(cardWText)
    expect(cardW).toBeGreaterThan(100)
  })

  it('reactively measures card width when mounted after delay (e.g. game loaded after mount)', () => {
    const { getByTestId, getByRole, queryByTestId } = render(<TestZone initialAttach={false} />)
    expect(queryByTestId('zone')).toBeNull()

    // Attach the element now
    act(() => {
      getByRole('button', { name: 'toggle' }).click()
    })

    expect(queryByTestId('zone')).not.toBeNull()
    const cardWText = getByTestId('card-w').textContent
    const cardW = Number(cardWText)
    expect(cardW).toBeGreaterThan(100)
  })

  it('BRD-6: a zone is sized from its layout box, not its scaled box', () => {
    const offsetW = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'offsetWidth')
    const offsetH = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'offsetHeight')
    Object.defineProperty(HTMLElement.prototype, 'offsetWidth', { configurable: true, get() { return this.classList?.contains('board-zone') ? 800 : 0 } })
    Object.defineProperty(HTMLElement.prototype, 'offsetHeight', { configurable: true, get() { return this.classList?.contains('board-zone') ? 400 : 0 } })
    Element.prototype.getBoundingClientRect = function () {
      if (this.classList?.contains('board-zone')) {
        return { width: 200, height: 100, top: 0, left: 0, right: 200, bottom: 100, x: 0, y: 0, toJSON: () => {} } as DOMRect
      }
      return { width: 100, height: 44, top: 0, left: 0, right: 100, bottom: 44, x: 0, y: 0, toJSON: () => {} } as DOMRect
    }
    try {
      const { getByTestId } = render(<TestZone initialAttach />)
      const layoutCardW = Number(getByTestId('card-w').textContent)
      cleanup()
      Object.defineProperty(HTMLElement.prototype, 'offsetWidth', { configurable: true, get() { return this.classList?.contains('board-zone') ? 200 : 0 } })
      Object.defineProperty(HTMLElement.prototype, 'offsetHeight', { configurable: true, get() { return this.classList?.contains('board-zone') ? 100 : 0 } })
      const scaled = render(<TestZone initialAttach />)
      const scaledCardW = Number(scaled.getByTestId('card-w').textContent)
      expect(layoutCardW).toBeGreaterThan(scaledCardW)
    } finally {
      if (offsetW) Object.defineProperty(HTMLElement.prototype, 'offsetWidth', offsetW)
      if (offsetH) Object.defineProperty(HTMLElement.prototype, 'offsetHeight', offsetH)
    }
  })

  it('stops re-queuing layout frames while the zone never gets a height', () => {
    const frames: FrameRequestCallback[] = []
    const request = vi.spyOn(window, 'requestAnimationFrame').mockImplementation((cb) => {
      frames.push(cb)
      return frames.length
    })
    vi.spyOn(window, 'cancelAnimationFrame').mockImplementation(() => {})
    Element.prototype.getBoundingClientRect = function () {
      return { width: 0, height: 0, top: 0, left: 0, right: 0, bottom: 0, x: 0, y: 0, toJSON: () => {} } as DOMRect
    }
    try {
      render(<TestZone initialAttach />)
      for (let i = 0; i < 1000 && frames.length > 0; i++) {
        const cb = frames.shift()!
        act(() => cb(0))
      }
      expect(frames).toHaveLength(0)
      expect(request.mock.calls.length).toBeLessThanOrEqual(64)
    } finally {
      request.mockRestore()
      vi.restoreAllMocks()
    }
  })
})
