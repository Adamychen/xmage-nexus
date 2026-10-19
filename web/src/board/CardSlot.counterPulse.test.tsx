import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act } from 'react'
import { render } from '@testing-library/react'
import CardSlot from './CardSlot'
import { COUNTER_PULSE_MS, COUNTER_TICK_MS } from './useCounterPulse'
import type { PermanentView } from '../net/types'
import { getState, setState } from '../state/state'

vi.mock('./cardPositionRegistry', () => ({
  getPreviousCardPosition: vi.fn(() => undefined),
  getPreviousCardZone: vi.fn(() => undefined),
  recordCardPosition: vi.fn(),
}))

vi.mock('../cards/cardImages', async (importOriginal) => {
  const mod = await importOriginal<typeof import('../cards/cardImages')>()
  return { ...mod, awaitImageUrl: vi.fn(async () => 'https://cards.scryfall.io/normal/front/a/b/ab.jpg?1') }
})

function setReducedMotion(reduce: boolean) {
  window.matchMedia = vi.fn().mockReturnValue({ matches: reduce }) as unknown as typeof window.matchMedia
}

function bear(count: number, extra: Record<string, unknown> = {}): PermanentView {
  return {
    id: 'bear-1',
    name: 'Grizzly Bears',
    cardTypes: ['Creature'],
    subTypes: ['Bear'],
    power: '2',
    toughness: '2',
    counters: [{ name: '+1/+1', count }],
    ...extra,
  } as unknown as PermanentView
}

function badge(container: HTMLElement): HTMLElement | null {
  return container.querySelector<HTMLElement>('.counter-badge')
}

describe('CardSlot counter change pulse', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    setState({ settings: { ...getState().settings, effects: true } })
    setReducedMotion(false)
  })

  afterEach(() => {
    vi.useRealTimers()
    delete (window as { matchMedia?: unknown }).matchMedia
    document.documentElement.classList.remove('fx-off')
  })

  it('a count increase adds the changed class and the number tick for the change window', () => {
    const { container, rerender } = render(<CardSlot card={bear(1)} showCounters />)
    const first = badge(container)
    expect(first?.classList.contains('counter-badge-changed')).toBe(false)

    rerender(<CardSlot card={bear(2)} showCounters />)
    const after = badge(container)
    expect(after).toBe(first)
    expect(after?.textContent).toContain('+2')
    expect(after?.classList.contains('counter-badge-changed')).toBe(true)
    expect(after?.classList.contains('counter-badge-up')).toBe(true)
    expect(after?.classList.contains('counter-badge-pulse')).toBe(true)
    expect(after?.querySelector('.counter-text-val')?.classList.contains('counter-tick')).toBe(true)
  })

  it('a count decrease marks the badge as down', () => {
    const { container, rerender } = render(<CardSlot card={bear(3)} showCounters />)
    rerender(<CardSlot card={bear(2)} showCounters />)
    expect(badge(container)?.classList.contains('counter-badge-down')).toBe(true)
    expect(badge(container)?.classList.contains('counter-badge-up')).toBe(false)
  })

  it('a first appearance of a counter does not add the changed class', () => {
    const { container, rerender } = render(<CardSlot card={bear(1, { counters: [] })} showCounters />)
    expect(badge(container)).toBeNull()
    rerender(<CardSlot card={bear(2)} showCounters />)
    expect(badge(container)?.classList.contains('counter-badge-changed')).toBe(false)
    expect(badge(container)?.querySelector('.counter-tick')).toBeNull()
  })

  it('a card that is mounted with a counter does not pulse', () => {
    const { container } = render(<CardSlot card={bear(2)} showCounters />)
    expect(badge(container)?.classList.contains('counter-badge-changed')).toBe(false)
  })

  it('under reduced motion the change keeps the colour but adds no scale, ring or rise', () => {
    setReducedMotion(true)
    const { container, rerender } = render(<CardSlot card={bear(1)} showCounters />)
    rerender(<CardSlot card={bear(2)} showCounters />)
    const el = badge(container)
    expect(el?.classList.contains('counter-badge-changed')).toBe(true)
    expect(el?.classList.contains('counter-badge-pulse')).toBe(false)
    expect(el?.querySelector('.counter-change-ring')).toBeNull()
    const label = el?.querySelector('.counter-change-label')
    expect(label?.textContent).toBe('+1')
    expect(label?.classList.contains('counter-change-rise')).toBe(false)
  })

  it('a count increase shows a +delta label that rises and is removed after its window', () => {
    const { container, rerender } = render(<CardSlot card={bear(1)} showCounters />)
    rerender(<CardSlot card={bear(2)} showCounters />)
    const el = badge(container)!
    const label = el.querySelector('.counter-change-label')
    expect(label?.textContent).toBe('+1')
    expect(label?.classList.contains('is-up')).toBe(true)
    expect(label?.classList.contains('counter-change-rise')).toBe(true)
    expect(el.querySelector('.counter-change-ring')).not.toBeNull()
    act(() => { vi.advanceTimersByTime(COUNTER_PULSE_MS) })
    expect(el.querySelector('.counter-change-label')).toBeNull()
    expect(el.querySelector('.counter-change-ring')).toBeNull()
  })

  it('a count decrease shows a -delta label', () => {
    const { container, rerender } = render(<CardSlot card={bear(3)} showCounters />)
    rerender(<CardSlot card={bear(1)} showCounters />)
    const label = badge(container)?.querySelector('.counter-change-label')
    expect(label?.textContent).toBe('-2')
    expect(label?.classList.contains('is-down')).toBe(true)
  })

  it('a first appearance of a counter shows no change label', () => {
    const { container, rerender } = render(<CardSlot card={bear(1, { counters: [] })} showCounters />)
    rerender(<CardSlot card={bear(2)} showCounters />)
    expect(badge(container)?.querySelector('.counter-change-label')).toBeNull()
    expect(badge(container)?.querySelector('.counter-change-ring')).toBeNull()
  })

  it('with effects off the change shows no label or ring', () => {
    setState({ settings: { ...getState().settings, effects: false } })
    const { container, rerender } = render(<CardSlot card={bear(1)} showCounters />)
    rerender(<CardSlot card={bear(2)} showCounters />)
    expect(badge(container)?.querySelector('.counter-change-label')).toBeNull()
    expect(badge(container)?.querySelector('.counter-change-ring')).toBeNull()
  })

  it('with effects off the change keeps the colour but adds no scale', () => {
    setState({ settings: { ...getState().settings, effects: false } })
    const { container, rerender } = render(<CardSlot card={bear(1)} showCounters />)
    rerender(<CardSlot card={bear(2)} showCounters />)
    expect(badge(container)?.classList.contains('counter-badge-changed')).toBe(true)
    expect(badge(container)?.classList.contains('counter-badge-pulse')).toBe(false)
  })

  it('the tick ends after about 300 ms and the changed class after about 800 ms', () => {
    const { container, rerender } = render(<CardSlot card={bear(1)} showCounters />)
    rerender(<CardSlot card={bear(2)} showCounters />)
    const el = badge(container)!
    act(() => { vi.advanceTimersByTime(COUNTER_TICK_MS - 1) })
    expect(el.querySelector('.counter-tick')).not.toBeNull()
    act(() => { vi.advanceTimersByTime(1) })
    expect(el.querySelector('.counter-tick')).toBeNull()
    expect(el.classList.contains('counter-badge-changed')).toBe(true)
    act(() => { vi.advanceTimersByTime(COUNTER_PULSE_MS - COUNTER_TICK_MS) })
    expect(el.classList.contains('counter-badge-changed')).toBe(false)
    expect(el.classList.contains('counter-badge-pulse')).toBe(false)
    expect(badge(container)).toBe(el)
  })
})

function walker(loyalty: number): PermanentView {
  return {
    id: 'walker-1',
    name: 'Jace',
    cardTypes: ['Planeswalker'],
    subTypes: ['Jace'],
    loyalty: String(loyalty),
  } as unknown as PermanentView
}

function loyaltyBadge(container: HTMLElement): HTMLElement | null {
  return container.querySelector<HTMLElement>('.loyalty-badge')
}

describe('CardSlot loyalty change pulse', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    setState({ settings: { ...getState().settings, effects: true } })
    setReducedMotion(false)
  })

  afterEach(() => {
    vi.useRealTimers()
    delete (window as { matchMedia?: unknown }).matchMedia
    document.documentElement.classList.remove('fx-off')
  })

  it('a planeswalker mounted with loyalty does not pulse', () => {
    const { container } = render(<CardSlot card={walker(4)} />)
    expect(loyaltyBadge(container)?.classList.contains('counter-badge-changed')).toBe(false)
  })

  it('a loyalty decrease pulses down with a -delta label and a ticking number', () => {
    const { container, rerender } = render(<CardSlot card={walker(4)} />)
    const first = loyaltyBadge(container)
    rerender(<CardSlot card={walker(2)} />)
    const el = loyaltyBadge(container)!
    expect(el).toBe(first)
    expect(el.classList.contains('counter-badge-down')).toBe(true)
    expect(el.classList.contains('counter-badge-pulse')).toBe(true)
    expect(el.querySelector('.loyalty-val')?.textContent).toBe('2')
    expect(el.querySelector('.loyalty-val')?.classList.contains('counter-tick')).toBe(true)
    expect(el.querySelector('.counter-change-label')?.textContent).toBe('-2')
    expect(el.querySelector('.counter-change-ring')).not.toBeNull()
  })

  it('a loyalty increase pulses up and clears after the change window', () => {
    const { container, rerender } = render(<CardSlot card={walker(3)} />)
    rerender(<CardSlot card={walker(4)} />)
    const el = loyaltyBadge(container)!
    expect(el.classList.contains('counter-badge-up')).toBe(true)
    expect(el.querySelector('.counter-change-label')?.textContent).toBe('+1')
    act(() => { vi.advanceTimersByTime(COUNTER_PULSE_MS) })
    expect(el.classList.contains('counter-badge-changed')).toBe(false)
    expect(el.querySelector('.counter-change-label')).toBeNull()
  })

  it('under reduced motion the loyalty change adds no scale or ring', () => {
    setReducedMotion(true)
    const { container, rerender } = render(<CardSlot card={walker(4)} />)
    rerender(<CardSlot card={walker(3)} />)
    const el = loyaltyBadge(container)!
    expect(el.classList.contains('counter-badge-changed')).toBe(true)
    expect(el.classList.contains('counter-badge-pulse')).toBe(false)
    expect(el.querySelector('.counter-change-ring')).toBeNull()
  })
})
