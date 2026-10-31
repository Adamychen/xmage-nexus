import { createEvent, fireEvent, render } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import StackPile from './StackPile'
import { BOARD_RELAYOUT_EVENT } from './useBandFit'

function relayoutEvents(spy: { mock: { calls: unknown[][] } }): number {
  return spy.mock.calls.filter(([event]) => (event as Event).type === BOARD_RELAYOUT_EVENT).length
}

function pointerEnter(el: HTMLElement, pointerType: string): void {
  const event = createEvent.pointerOver(el)
  Object.defineProperty(event, 'pointerType', { value: pointerType })
  fireEvent(el, event)
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

  it('BRD-20: closes when the pointer moves onto another permanent even if no leave event arrives', () => {
    const { container } = render(
      <div className="permanents-band">
        <StackPile className="stack-group" name="Plains" count={2} cardIds={['a', 'b']}>
          <div className="card-slot" />
          <div className="card-slot" />
        </StackPile>
        <div className="card-slot rock" />
      </div>,
    )
    const pile = container.querySelector<HTMLElement>('.stack-group')!
    fireEvent.pointerEnter(pile)
    expect(pile.dataset.spread).toBeDefined()
    fireEvent.pointerMove(pile.querySelector('.card-slot')!)
    expect(pile.dataset.spread).toBeDefined()
    fireEvent.pointerMove(container.querySelector('.rock')!)
    expect(pile.dataset.spread).toBeUndefined()
    expect(container.querySelector<HTMLElement>('.rock')!.dataset.spreadPushed).toBeUndefined()
  })

  it('BRD-20: stops watching the pointer once closed or unmounted', () => {
    const remove = vi.spyOn(document, 'removeEventListener')
    const { container, unmount } = render(
      <div className="permanents-band">
        <StackPile className="stack-group" name="Plains" count={2} cardIds={['a', 'b']}>
          <div className="card-slot" />
          <div className="card-slot" />
        </StackPile>
      </div>,
    )
    const pile = container.querySelector<HTMLElement>('.stack-group')!
    fireEvent.pointerEnter(pile)
    fireEvent.pointerLeave(pile)
    expect(remove.mock.calls.filter(([type]) => type === 'pointermove')).toHaveLength(1)
    fireEvent.pointerEnter(pile)
    unmount()
    expect(remove.mock.calls.filter(([type]) => type === 'pointermove')).toHaveLength(2)
    remove.mockRestore()
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

  describe('BRD-20: a token pile fans out after the mouse rests on it', () => {
    function renderTokenPile() {
      const { container } = render(
        <div className="permanents-band">
          <StackPile className="stack-group" name="Treasure" count={2} cardIds={['a', 'b']} fanDelayMs={1000}>
            <div className="card-slot" />
            <div className="card-slot" />
          </StackPile>
        </div>,
      )
      return container.querySelector<HTMLElement>('.stack-group')!
    }

    it('BRD-20: stays collapsed until the mouse has rested for the delay', () => {
      const pile = renderTokenPile()
      pointerEnter(pile, 'mouse')
      vi.advanceTimersByTime(900)
      expect(pile.dataset.spread).toBeUndefined()
      vi.advanceTimersByTime(100)
      expect(pile.dataset.spread).toBeDefined()
    })

    it('BRD-20: a mouse that leaves before the delay never fans it out', () => {
      const pile = renderTokenPile()
      pointerEnter(pile, 'mouse')
      vi.advanceTimersByTime(500)
      fireEvent.pointerLeave(pile)
      vi.advanceTimersByTime(1000)
      expect(pile.dataset.spread).toBeUndefined()
    })

    it('BRD-20: reports when it fans out and closes, so the board can hide the preview', () => {
      const onFanChange = vi.fn()
      const { container } = render(
        <div className="permanents-band">
          <StackPile className="stack-group" name="Treasure" count={2} cardIds={['a', 'b']} fanDelayMs={1000} onFanChange={onFanChange}>
            <div className="card-slot" />
            <div className="card-slot" />
          </StackPile>
        </div>,
      )
      const pile = container.querySelector<HTMLElement>('.stack-group')!
      pointerEnter(pile, 'mouse')
      expect(onFanChange).not.toHaveBeenCalled()
      vi.advanceTimersByTime(1000)
      expect(onFanChange).toHaveBeenLastCalledWith(true)
      fireEvent.pointerLeave(pile)
      expect(onFanChange).toHaveBeenLastCalledWith(false)
      fireEvent.mouseLeave(pile)
      expect(onFanChange).toHaveBeenCalledTimes(2)
    })

    it('BRD-20: a touch fans it out at once', () => {
      const pile = renderTokenPile()
      pointerEnter(pile, 'touch')
      expect(pile.dataset.spread).toBeDefined()
    })
  })
})
