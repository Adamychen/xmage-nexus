import { fireEvent, render } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import StackPile from './StackPile'
import { BOARD_RELAYOUT_EVENT } from './useBandFit'

function relayoutEvents(spy: { mock: { calls: unknown[][] } }): number {
  return spy.mock.calls.filter(([event]) => (event as Event).type === BOARD_RELAYOUT_EVENT).length
}

describe('StackPile', () => {
  let offsetWidth: PropertyDescriptor | undefined

  beforeEach(() => {
    vi.useFakeTimers()
    offsetWidth = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'offsetWidth')
    Object.defineProperty(HTMLElement.prototype, 'offsetWidth', { configurable: true, get: () => 100 })
  })

  afterEach(() => {
    vi.useRealTimers()
    if (offsetWidth) Object.defineProperty(HTMLElement.prototype, 'offsetWidth', offsetWidth)
    else delete (HTMLElement.prototype as unknown as { offsetWidth?: number }).offsetWidth
  })

  it('announces a relayout when the pile fans out so arrows re-anchor to the moved cards', () => {
    const { container } = render(
      <div className="permanents-band">
        <StackPile className="stack-group" name="Forest" count={2} cardIds={['a', 'b']}>
          <div className="card-slot" />
          <div className="card-slot" />
        </StackPile>
      </div>,
    )
    const spy = vi.spyOn(window, 'dispatchEvent')
    fireEvent.pointerEnter(container.querySelector('.stack-group')!)
    expect(relayoutEvents(spy)).toBeGreaterThan(0)
  })

  it('announces again once the pushed neighbours finish their 0.25s slide', () => {
    const { container } = render(
      <div className="permanents-band">
        <StackPile className="stack-group" name="Forest" count={2} cardIds={['a', 'b']}>
          <div className="card-slot" />
          <div className="card-slot" />
        </StackPile>
      </div>,
    )
    const spy = vi.spyOn(window, 'dispatchEvent')
    fireEvent.pointerEnter(container.querySelector('.stack-group')!)
    const immediate = relayoutEvents(spy)
    vi.advanceTimersByTime(300)
    expect(relayoutEvents(spy)).toBeGreaterThan(immediate)
  })

  it('announces a relayout when the pile collapses', () => {
    const { container } = render(
      <div className="permanents-band">
        <StackPile className="stack-group" name="Forest" count={2} cardIds={['a', 'b']}>
          <div className="card-slot" />
          <div className="card-slot" />
        </StackPile>
      </div>,
    )
    const pile = container.querySelector<HTMLElement>('.stack-group')!
    fireEvent.pointerEnter(pile)
    const spy = vi.spyOn(window, 'dispatchEvent')
    fireEvent.pointerLeave(pile)
    expect(relayoutEvents(spy)).toBeGreaterThan(0)
  })

  it('collapses on mouseleave when the pointerleave never arrives, and announces only once', () => {
    const { container } = render(
      <div className="permanents-band">
        <StackPile className="stack-group" name="Forest" count={2} cardIds={['a', 'b']}>
          <div className="card-slot" />
          <div className="card-slot" />
        </StackPile>
      </div>,
    )
    const pile = container.querySelector<HTMLElement>('.stack-group')!
    fireEvent.pointerEnter(pile)
    expect(pile.dataset.spread).toBeDefined()
    const spy = vi.spyOn(window, 'dispatchEvent')
    fireEvent.mouseLeave(pile)
    expect(pile.dataset.spread).toBeUndefined()
    const announced = relayoutEvents(spy)
    fireEvent.pointerLeave(pile)
    expect(relayoutEvents(spy)).toBe(announced)
  })

  it('does not re-measure the fanned pile on renders that leave its cards unchanged', () => {
    const cards = (
      <>
        <div className="card-slot" />
        <div className="card-slot" />
      </>
    )
    const { container, rerender } = render(
      <div className="permanents-band">
        <StackPile className="stack-group" name="Forest" count={2} cardIds={['a', 'b']}>{cards}</StackPile>
      </div>,
    )
    const pile = container.querySelector<HTMLElement>('.stack-group')!
    fireEvent.pointerEnter(pile)
    expect(pile.dataset.spread).toBeDefined()
    const measure = vi.spyOn(pile, 'getBoundingClientRect')
    rerender(
      <div className="permanents-band">
        <StackPile className="stack-group" name="Forest" count={2} cardIds={['a', 'b']}>{cards}</StackPile>
      </div>,
    )
    expect(measure).not.toHaveBeenCalled()
  })

  it('re-measures the fanned pile when the same number of different cards is swapped in', () => {
    const { container, rerender } = render(
      <div className="permanents-band">
        <StackPile className="stack-group" name="Forest" count={2} cardIds={['a', 'b']}>
          <div className="card-slot" />
          <div className="card-slot" />
        </StackPile>
      </div>,
    )
    const pile = container.querySelector<HTMLElement>('.stack-group')!
    fireEvent.pointerEnter(pile)
    const measure = vi.spyOn(pile, 'getBoundingClientRect')
    rerender(
      <div className="permanents-band">
        <StackPile className="stack-group" name="Forest" count={2} cardIds={['c', 'd']}>
          <div className="card-slot" />
          <div className="card-slot" />
        </StackPile>
      </div>,
    )
    expect(measure).toHaveBeenCalled()
  })
})
