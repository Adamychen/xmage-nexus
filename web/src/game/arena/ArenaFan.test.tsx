import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render } from '@testing-library/react'
import ArenaFan, { fanIndexAt, fanSplitAt } from './ArenaFan'
import type { CardView } from '../../net/types'

vi.mock('../../board/cardPositionRegistry', () => ({
  getPreviousCardPosition: vi.fn(() => undefined),
  getPreviousCardZone: vi.fn(() => undefined),
  recordCardPosition: vi.fn(),
}))

afterEach(cleanup)

const card = (id: string, name: string): CardView =>
  ({ id, name, expansionSetCode: 'M10', cardNumber: '1', cardTypes: ['Instant'] }) as unknown as CardView

const CARDS = [card('c1', 'Lightning Bolt'), card('c2', 'Counterspell'), card('c3', 'Forest')]

const lane = (width: number) => ({ left: 0, top: 0, right: width, bottom: 300, width, height: 300, x: 0, y: 0, toJSON: () => ({}) }) as DOMRect

describe('fanIndexAt', () => {
  const cardW = 100
  const slice = 44
  const centre = 1000

  it('maps the pointer at the lane centre of a 3-card fan to index 1', () => {
    expect(fanIndexAt(centre, lane(2000), cardW, 3, false)).toBe(1)
  })

  it('maps the far left to 0 and the far right to the slot after the last card', () => {
    expect(fanIndexAt(0, lane(2000), cardW, 3, false)).toBe(0)
    expect(fanIndexAt(2000, lane(2000), cardW, 3, false)).toBe(3)
  })

  it('accounts for a leading face-down card', () => {
    expect(fanIndexAt(centre + slice * 0.25, lane(2000), cardW, 3, false)).toBe(2)
    expect(fanIndexAt(centre + slice * 0.25, lane(2000), cardW, 3, true)).toBe(1)
    expect(fanIndexAt(0, lane(2000), cardW, 3, true)).toBe(0)
    expect(fanIndexAt(2000, lane(2000), cardW, 3, true)).toBe(3)
  })

  it('is offset by the lane left edge', () => {
    const shifted = { ...lane(2000), left: 500 } as DOMRect
    expect(fanIndexAt(centre + 500, shifted, cardW, 3, false)).toBe(1)
  })

  it('adds the scroll offset when the fan is windowed', () => {
    // 16 cards with a 6-card visible window scrolled to index 5 (slots 5..10): centre lands on 7.
    expect(fanIndexAt(centre, lane(2000), cardW, 16, false, 5, 6)).toBe(7)
    expect(fanIndexAt(0, lane(2000), cardW, 16, false, 5, 6)).toBe(0)
    expect(fanIndexAt(2000, lane(2000), cardW, 16, false, 5, 6)).toBe(16)
  })
})

describe('fanSplitAt', () => {
  const cardW = 100
  const centre = 1000

  it('splits left of the deck back to under and right of the deck back to over', () => {
    expect(fanSplitAt(0, lane(2000), cardW, 0, 2)).toEqual({ side: 'under', index: 0 })
    expect(fanSplitAt(centre, lane(2000), cardW, 0, 2)).toEqual({ side: 'over', index: 0 })
    expect(fanSplitAt(centre + 44, lane(2000), cardW, 0, 2)).toEqual({ side: 'over', index: 1 })
    expect(fanSplitAt(2000, lane(2000), cardW, 0, 2)).toEqual({ side: 'over', index: 2 })
  })

  it('maps slots across both sides when under cards are present', () => {
    expect(fanSplitAt(0, lane(2000), cardW, 2, 1)).toEqual({ side: 'under', index: 0 })
    expect(fanSplitAt(centre, lane(2000), cardW, 2, 1)).toEqual({ side: 'under', index: 2 })
    expect(fanSplitAt(2000, lane(2000), cardW, 2, 1)).toEqual({ side: 'over', index: 1 })
  })
})

function renderFan(props: Partial<Parameters<typeof ArenaFan>[0]> = {}) {
  return render(
    <ArenaFan
      zoneId="top"
      cards={CARDS}
      gapIndex={null}
      dealing={false}
      onCardPointerDown={() => {}}
      laneRef={() => {}}
      {...props}
    />,
  )
}

const rotation = (el: Element) => parseFloat((el as HTMLElement).style.rotate)

describe('ArenaFan', () => {
  it('renders one [data-arena-card] per card with a rotation that grows from left to right', () => {
    const { container } = renderFan()
    const slots = [...container.querySelectorAll('[data-arena-card]')]
    expect(slots.map((s) => s.getAttribute('data-arena-card'))).toEqual(['c1', 'c2', 'c3'])
    const angles = slots.map(rotation)
    expect(angles[0]).toBeLessThan(angles[1])
    expect(angles[1]).toBeLessThan(angles[2])
  })

  it('draws a leading back as the first slot that takes no pointer events', () => {
    const { container } = renderFan({ leadingBack: card('deck', 'Library') })
    const back = container.querySelector<HTMLElement>('.arena-fan-back')
    expect(back).not.toBeNull()
    expect(back!.getAttribute('aria-hidden')).toBe('true')
    expect(back!.hasAttribute('data-arena-card')).toBe(false)
    expect(back!.classList.contains('arena-fan-slot')).toBe(true)
    const first = container.querySelector('[data-arena-card]')!
    expect(rotation(back!)).toBeLessThan(rotation(first))
    const onDown = vi.fn()
    cleanup()
    const again = renderFan({ leadingBack: card('deck', 'Library'), onCardPointerDown: onDown })
    fireEvent.pointerDown(again.container.querySelector('.arena-fan-back .arena-fan-card')!)
    expect(onDown).not.toHaveBeenCalled()
  })

  it('reports a pointer down on a card with its id', () => {
    const onDown = vi.fn()
    const { container } = renderFan({ onCardPointerDown: onDown })
    fireEvent.pointerDown(container.querySelector('[data-arena-card="c2"] .arena-fan-card')!)
    expect(onDown).toHaveBeenCalledTimes(1)
    expect(onDown.mock.calls[0][1]).toBe('c2')
  })

  it('opens a gap slot at gapIndex and marks the fan hot', () => {
    const { container } = renderFan({ gapIndex: 1 })
    expect(container.querySelector('.arena-fan')!.classList.contains('is-hot')).toBe(true)
    const gap = container.querySelector('.arena-fan-gap')!
    const slots = [...container.querySelectorAll('[data-arena-card]')]
    expect(rotation(slots[0])).toBeLessThan(rotation(gap))
    expect(rotation(gap)).toBeLessThan(rotation(slots[1]))
  })

  it('hovering a card lifts a clone above it, and the next card takes the lift over', () => {
    const { container } = renderFan()
    const c1 = container.querySelector('[data-arena-card="c1"]')!
    const c2 = container.querySelector('[data-arena-card="c2"]')!
    fireEvent.pointerOver(c1.querySelector('.arena-fan-card')!)
    expect(c1.classList.contains('is-lifted')).toBe(true)
    let clones = container.querySelectorAll('.arena-lift')
    expect(clones).toHaveLength(1)
    expect((clones[0] as HTMLElement).hasAttribute('data-arena-card')).toBe(false)
    expect(clones[0].getAttribute('aria-hidden')).toBe('true')
    expect(container.querySelectorAll('[data-arena-card]')).toHaveLength(3)
    fireEvent.pointerOver(c2.querySelector('.arena-fan-card')!)
    expect(c1.classList.contains('is-lifted')).toBe(false)
    expect(c2.classList.contains('is-lifted')).toBe(true)
    clones = container.querySelectorAll('.arena-lift')
    expect(clones).toHaveLength(1)
    fireEvent.pointerLeave(container.querySelector('.arena-fan-lane')!)
    expect(c2.classList.contains('is-lifted')).toBe(false)
    expect(container.querySelectorAll('.arena-lift')).toHaveLength(0)
  })

  it('gives a card that re-enters the fan a fresh CardSlot cardId', () => {
    const { container, rerender } = renderFan()
    const idOf = (id: string) => container.querySelector(`[data-arena-card="${id}"] [data-card-id]`)?.getAttribute('data-card-id')
    const before = idOf('c2')
    const stay = idOf('c1')
    expect(before).toMatch(/^arena:top:c2:\d+$/)
    const props = { zoneId: 'top', gapIndex: null, dealing: false, onCardPointerDown: () => {}, laneRef: () => {} }
    rerender(<ArenaFan {...props} cards={[CARDS[0], CARDS[2]]} />)
    rerender(<ArenaFan {...props} cards={CARDS} />)
    const after = idOf('c2')
    expect(after).toMatch(/^arena:top:c2:\d+$/)
    expect(after).not.toBe(before)
    expect(idOf('c1')).toBe(stay)
  })

  it('staggers the deal only while dealing', () => {
    const { container, rerender } = renderFan({ dealing: true })
    expect(container.querySelector('.arena-fan')!.classList.contains('is-dealing')).toBe(true)
    const faces = [...container.querySelectorAll<HTMLElement>('[data-arena-card] .arena-fan-card')]
    expect(faces.map((f) => f.style.animationDelay)).toEqual(['0ms', '80ms', '160ms'])
    rerender(<ArenaFan zoneId="top" cards={CARDS} gapIndex={null} dealing={false} onCardPointerDown={() => {}} laneRef={() => {}} />)
    expect(container.querySelector('.arena-fan')!.classList.contains('is-dealing')).toBe(false)
  })

  it('hands the lane element to laneRef', () => {
    const laneRef = vi.fn()
    renderFan({ laneRef })
    expect(laneRef).toHaveBeenCalledWith(expect.any(HTMLDivElement))
    expect((laneRef.mock.calls[0][0] as HTMLElement).classList.contains('arena-fan-lane')).toBe(true)
  })

  it('tucks underCards behind the deck back and places over cards in front of it', () => {
    const onUnder = vi.fn()
    const onOver = vi.fn()
    const { container } = renderFan({
      splitZoneId: 'away',
      underCards: [CARDS[0]],
      cards: [CARDS[1], CARDS[2]],
      leadingBack: card('deck', 'Library'),
      onCardPointerDown: onOver,
      onUnderCardPointerDown: onUnder,
    })
    const fan = container.querySelector('.arena-fan')!
    expect(fan.getAttribute('data-arena-split')).toBe('away')
    const under = container.querySelector<HTMLElement>('[data-arena-card="c1"]')!
    const back = container.querySelector<HTMLElement>('.arena-fan-back')!
    const over = container.querySelector<HTMLElement>('[data-arena-card="c2"]')!
    expect(under.classList.contains('is-under')).toBe(true)
    expect(under.getAttribute('data-arena-side')).toBe('away')
    expect(over.getAttribute('data-arena-side')).toBe('top')
    expect(rotation(under)).toBeLessThan(rotation(back))
    expect(rotation(back)).toBeLessThan(rotation(over))
    expect(Number(under.style.zIndex)).toBeLessThan(Number(back.style.zIndex))
    expect(Number(back.style.zIndex)).toBeLessThan(Number(over.style.zIndex))
    fireEvent.pointerDown(under.querySelector('.arena-fan-card')!)
    expect(onUnder).toHaveBeenCalledTimes(1)
    expect(onUnder.mock.calls[0][1]).toBe('c1')
    expect(onOver).not.toHaveBeenCalled()
  })

  it('opens a gap on the under side to the left of the deck back', () => {
    const { container } = renderFan({
      splitZoneId: 'away',
      underCards: [CARDS[0]],
      cards: [CARDS[1]],
      leadingBack: card('deck', 'Library'),
      underGapIndex: 1,
    })
    expect(container.querySelector('.arena-fan')!.classList.contains('is-hot')).toBe(true)
    const under = container.querySelector('[data-arena-card="c1"]')!
    const gap = container.querySelector('.arena-fan-gap')!
    const back = container.querySelector('.arena-fan-back')!
    expect(rotation(under)).toBeLessThan(rotation(gap))
    expect(rotation(gap)).toBeLessThan(rotation(back))
  })

  it('shows no scrollbar when all cards fit, and renders a working horizontal scrollbar on overflow', () => {
    const small = renderFan()
    expect(small.container.querySelector('[data-testid="arena-fan-scrollbar"]')).toBeNull()
    small.unmount()

    const many = Array.from({ length: 16 }, (_, i) => card(`m${i + 1}`, `Card ${i + 1}`))
    const { container } = renderFan({ cards: many, startAtEnd: true })
    const fan = container.querySelector('.arena-fan')!
    expect(fan.classList.contains('is-scrollable')).toBe(true)
    const bar = container.querySelector('[data-testid="arena-fan-scrollbar"]')!
    const thumb = bar.querySelector('[role="scrollbar"]')!
    const max = Number(thumb.getAttribute('aria-valuemax'))
    expect(max).toBeGreaterThan(0)
    expect(Number(thumb.getAttribute('aria-valuenow'))).toBe(max)

    fireEvent.keyDown(thumb, { key: 'ArrowLeft' })
    expect(Number(thumb.getAttribute('aria-valuenow'))).toBe(max - 1)
    fireEvent.keyDown(thumb, { key: 'Home' })
    expect(Number(thumb.getAttribute('aria-valuenow'))).toBe(0)
  })
})
