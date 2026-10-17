import { cleanup, render } from '@testing-library/react'
import { useRef } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { usePointerTilt } from './usePointerTilt'

function Board() {
  const ref = useRef<HTMLDivElement>(null)
  usePointerTilt(ref, '.tile')
  return (
    <div ref={ref} data-testid="board">
      <button className="tile" data-testid="a" type="button">a</button>
      <button className="tile" data-testid="b" type="button">b</button>
    </div>
  )
}

function pointer(el: Element, type: string, clientX = 0, clientY = 0) {
  el.dispatchEvent(new MouseEvent(type, { bubbles: true, clientX, clientY }))
}

describe('usePointerTilt', () => {
  afterEach(() => {
    cleanup()
    vi.restoreAllMocks()
  })

  it('tracks the pointer on the hovered tile only, and resets it when the pointer leaves', () => {
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue(
      { left: 0, top: 0, width: 100, height: 50, right: 100, bottom: 50, x: 0, y: 0, toJSON: () => ({}) } as DOMRect,
    )
    const { getByTestId } = render(<Board />)
    const a = getByTestId('a')
    const b = getByTestId('b')

    pointer(a, 'pointermove', 25, 10)
    expect(a.style.getPropertyValue('--px')).toBe('0.250')
    expect(a.style.getPropertyValue('--py')).toBe('0.200')

    pointer(b, 'pointermove', 50, 25)
    expect(a.style.getPropertyValue('--px')).toBe('0.5')
    expect(b.style.getPropertyValue('--px')).toBe('0.500')
    expect(b.style.getPropertyValue('--py')).toBe('0.500')

    pointer(getByTestId('board'), 'pointerleave')
    expect(b.style.getPropertyValue('--px')).toBe('0.5')
  })

  it('ignores pointer moves over the container that are not on a tile', () => {
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue(
      { left: 0, top: 0, width: 100, height: 50, right: 100, bottom: 50, x: 0, y: 0, toJSON: () => ({}) } as DOMRect,
    )
    const { getByTestId } = render(<Board />)
    pointer(getByTestId('board'), 'pointermove', 10, 10)
    expect(getByTestId('a').style.getPropertyValue('--px')).toBe('')
    expect(getByTestId('b').style.getPropertyValue('--px')).toBe('')
  })
})
