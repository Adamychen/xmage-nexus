import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from 'vitest'
import { createElement as h, type PointerEvent } from 'react'
import { act, cleanup, fireEvent, render } from '@testing-library/react'
import { useFanDrag } from './useFanDrag'
import type { CardView } from '../../net/types'

vi.mock('../../board/cardPositionRegistry', () => ({
  getPreviousCardPosition: vi.fn(() => undefined),
  getPreviousCardZone: vi.fn(() => undefined),
  recordCardPosition: vi.fn(),
}))

type Api = ReturnType<typeof useFanDrag>

const CARD = { id: 'c1', name: 'Lightning Bolt', expansionSetCode: 'M10', cardNumber: '1', cardTypes: ['Instant'] } as unknown as CardView

const ZONE_X: Record<string, number> = { top: 0, away: 1200 }

function rect(left: number, top: number, width: number, height: number): DOMRect {
  return { left, top, width, height, right: left + width, bottom: top + height, x: left, y: top, toJSON: () => ({}) } as DOMRect
}

function rectOf(el: Element): DOMRect {
  const zone = el.closest('[data-arena-zone]')?.getAttribute('data-arena-zone')
  const x = zone ? ZONE_X[zone] : 0
  if (el.classList.contains('arena-fan') || el.classList.contains('arena-fan-lane')) return rect(x, 0, 1000, 400)
  const slot = el.closest('[data-arena-card]')
  if (slot) {
    const ids = [...slot.parentElement!.querySelectorAll('[data-arena-card]')]
    return rect(x + 300 + ids.indexOf(slot) * 100, 100, 100, 139)
  }
  return rect(0, 0, 0, 0)
}

let latest: Api
let zones: Record<string, string[]>
let onDrop: Mock<(id: string, zone: string, index: number) => void>
let onClick: Mock<(id: string, from: string) => void>

function Harness({ canDrag }: { canDrag: boolean }) {
  const api = useFanDrag({ zones: ['top', 'away'], canDrag, onDrop, onClick })
  latest = api
  return h(
    'div',
    { ...api.bindRoot, 'data-testid': 'root' },
    ...['top', 'away'].map((zone) =>
      h(
        'div',
        { key: zone, className: 'arena-fan', 'data-arena-zone': zone },
        h(
          'div',
          { className: 'arena-fan-lane' },
          ...zones[zone]
            .filter((id) => !(api.drag?.started && api.drag.id === id))
            .map((id) =>
              h(
                'div',
                { key: id, 'data-arena-card': id },
                h('div', { className: 'arena-fan-land' }, h('div', { className: 'arena-fan-card', 'data-testid': `card-${id}`, onPointerDown: (e: PointerEvent) => api.startDrag(e, id, zone) })),
              ),
            ),
        ),
      ),
    ),
    api.dragLayer(api.drag?.started ? CARD : null),
  )
}

function mount(canDrag = true) {
  return render(h(Harness, { canDrag }))
}

class TestPointerEvent extends MouseEvent {
  pointerId: number
  constructor(type: string, init: PointerEventInit = {}) {
    super(type, init)
    this.pointerId = init.pointerId ?? 0
  }
}

beforeEach(() => {
  vi.stubGlobal('PointerEvent', TestPointerEvent)
  zones = { top: ['c1', 'c2', 'c3'], away: [] }
  onDrop = vi.fn()
  onClick = vi.fn()
  vi.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(function (this: Element) {
    return rectOf(this)
  })
})

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

describe('useFanDrag', () => {
  it('a press released in place is a click on the card, not a drop', () => {
    const { getByTestId } = mount()
    fireEvent.pointerDown(getByTestId('card-c1'), { button: 0, pointerId: 1, clientX: 350, clientY: 150 })
    expect(latest.drag).toEqual({ id: 'c1', from: 'top', started: false })
    fireEvent.pointerMove(getByTestId('root'), { pointerId: 1, clientX: 352, clientY: 151 })
    expect(latest.drag?.started).toBe(false)
    fireEvent.pointerUp(getByTestId('root'), { pointerId: 1, clientX: 352, clientY: 151 })
    expect(onClick).toHaveBeenCalledWith('c1', 'top')
    expect(onDrop).not.toHaveBeenCalled()
    expect(latest.drag).toBeNull()
  })

  it('moving past the threshold starts a drag drawn in the drag layer and hovers the zone under the pointer', () => {
    const { getByTestId, container } = mount()
    fireEvent.pointerDown(getByTestId('card-c1'), { button: 0, pointerId: 1, clientX: 350, clientY: 150 })
    fireEvent.pointerMove(getByTestId('root'), { pointerId: 1, clientX: 1700, clientY: 200 })
    expect(latest.drag).toEqual({ id: 'c1', from: 'top', started: true })
    expect(latest.hover).toEqual({ zone: 'away', index: 0 })
    const layer = container.querySelector<HTMLElement>('.arena-drag')
    expect(layer).not.toBeNull()
    expect(layer!.style.transform).toContain('translate3d(')
    expect(container.querySelector('.arena-drag [data-card-id]')?.getAttribute('data-card-id')).toMatch(/^arena:drag:c1:\d+$/)
    fireEvent.pointerUp(getByTestId('root'), { pointerId: 1, clientX: 1700, clientY: 200 })
    expect(onDrop).toHaveBeenCalledWith('c1', 'away', 0)
    expect(onClick).not.toHaveBeenCalled()
    expect(latest.drag).toBeNull()
    expect(latest.hover).toBeNull()
    expect(container.querySelector('.arena-drag')).toBeNull()
  })

  it('a drop inside the origin fan reports the insertion index among the other cards', () => {
    const { getByTestId } = mount()
    fireEvent.pointerDown(getByTestId('card-c1'), { button: 0, pointerId: 1, clientX: 350, clientY: 150 })
    fireEvent.pointerMove(getByTestId('root'), { pointerId: 1, clientX: 990, clientY: 150 })
    expect(latest.hover).toEqual({ zone: 'top', index: 2 })
    fireEvent.pointerUp(getByTestId('root'), { pointerId: 1, clientX: 990, clientY: 150 })
    expect(onDrop).toHaveBeenCalledWith('c1', 'top', 2)
  })

  it('a drop away from every fan puts the card back without reporting a move', () => {
    const { getByTestId } = mount()
    fireEvent.pointerDown(getByTestId('card-c1'), { button: 0, pointerId: 1, clientX: 350, clientY: 150 })
    fireEvent.pointerMove(getByTestId('root'), { pointerId: 1, clientX: 600, clientY: 900 })
    expect(latest.drag?.started).toBe(true)
    expect(latest.hover).toBeNull()
    fireEvent.pointerUp(getByTestId('root'), { pointerId: 1, clientX: 600, clientY: 900 })
    expect(onDrop).not.toHaveBeenCalled()
    expect(onClick).not.toHaveBeenCalled()
    expect(latest.drag).toBeNull()
  })

  it('ignores other pointers, secondary buttons and a locked prompt', () => {
    const { getByTestId, unmount } = mount()
    fireEvent.pointerDown(getByTestId('card-c1'), { button: 2, pointerId: 1, clientX: 350, clientY: 150 })
    expect(latest.drag).toBeNull()
    fireEvent.pointerDown(getByTestId('card-c1'), { button: 0, pointerId: 1, clientX: 350, clientY: 150 })
    fireEvent.pointerMove(getByTestId('root'), { pointerId: 2, clientX: 1700, clientY: 200 })
    expect(latest.drag?.started).toBe(false)
    unmount()
    const locked = mount(false)
    fireEvent.pointerDown(locked.getByTestId('card-c1'), { button: 0, pointerId: 1, clientX: 350, clientY: 150 })
    expect(latest.drag).toBeNull()
  })

  it('losing the pointer capture mid-drag ends the drag with the card where it was', () => {
    const { getByTestId } = mount()
    fireEvent.pointerDown(getByTestId('card-c1'), { button: 0, pointerId: 1, clientX: 350, clientY: 150 })
    fireEvent.pointerMove(getByTestId('root'), { pointerId: 1, clientX: 1700, clientY: 200 })
    fireEvent.lostPointerCapture(getByTestId('root'), { pointerId: 1 })
    expect(onDrop).not.toHaveBeenCalled()
    expect(onClick).not.toHaveBeenCalled()
    expect(latest.drag).toBeNull()
    expect(latest.hover).toBeNull()
  })

  it('a cancelled or lost pointer before the threshold is not a click', () => {
    const { getByTestId } = mount()
    fireEvent.pointerDown(getByTestId('card-c1'), { button: 0, pointerId: 1, clientX: 350, clientY: 150 })
    fireEvent.pointerCancel(getByTestId('root'), { pointerId: 1, clientX: 351, clientY: 150 })
    expect(latest.drag).toBeNull()
    fireEvent.pointerDown(getByTestId('card-c2'), { button: 0, pointerId: 2, clientX: 450, clientY: 150 })
    fireEvent.lostPointerCapture(getByTestId('root'), { pointerId: 2 })
    expect(latest.drag).toBeNull()
    fireEvent.pointerDown(getByTestId('card-c3'), { button: 0, pointerId: 3, clientX: 550, clientY: 150 })
    fireEvent.pointerMove(getByTestId('root'), { pointerId: 3, clientX: 1700, clientY: 200 })
    fireEvent.pointerCancel(getByTestId('root'), { pointerId: 3, clientX: 1700, clientY: 200 })
    expect(onClick).not.toHaveBeenCalled()
    expect(onDrop).not.toHaveBeenCalled()
    expect(latest.drag).toBeNull()
  })

  it('a click flies the card from where it was to its new slot', () => {
    const { getByTestId, rerender } = mount()
    onClick.mockImplementation((id: string) => {
      zones = { top: zones.top.filter((c) => c !== id), away: [...zones.away, id] }
    })
    fireEvent.pointerDown(getByTestId('card-c1'), { button: 0, pointerId: 1, clientX: 350, clientY: 150 })
    act(() => {
      fireEvent.pointerUp(getByTestId('root'), { pointerId: 1, clientX: 350, clientY: 150 })
    })
    rerender(h(Harness, { canDrag: true }))
    const land = getByTestId('card-c1').parentElement as HTMLElement
    expect(land.closest('[data-arena-zone]')?.getAttribute('data-arena-zone')).toBe('away')
    expect(land.style.transition).toContain('360ms')
  })
})
