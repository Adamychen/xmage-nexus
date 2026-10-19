import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, cleanup } from '@testing-library/react'
import FlyingCardOverlay from './FlyingCardOverlay'
import { clearFlights, startCardFlight, CAST_FLIGHT_MS, ENTER_FLIGHT_MS } from './flightManager'
import { soundManager } from '../audio/soundManager'
import type { CardView } from '../net/types'

describe('FlyingCardOverlay', () => {
  const dummyCard: CardView = {
    id: 'card-bolt',
    name: 'Lightning Bolt',
    manaValue: 1,
    expansionSetCode: 'LEA',
    cardNumber: '161',
  }

  const fromRect = {
    left: 50,
    top: 600,
    right: 150,
    bottom: 740,
    width: 100,
    height: 140,
    x: 50,
    y: 600,
    toJSON: () => {},
  } as DOMRect

  const toRect = {
    left: 500,
    top: 250,
    right: 600,
    bottom: 390,
    width: 100,
    height: 140,
    x: 500,
    y: 250,
    toJSON: () => {},
  } as DOMRect

  beforeEach(() => {
    vi.clearAllTimers()
  })

  afterEach(() => {
    cleanup()
  })

  it('renders nothing when there are no active flights', () => {
    const { container } = render(<FlyingCardOverlay />)
    expect(container.firstChild).toBeNull()
  })

  it('renders flying card overlay when a flight is triggered', () => {
    startCardFlight(dummyCard, fromRect, toRect, 300)

    const { getAllByText } = render(<FlyingCardOverlay />)
    expect(getAllByText(/Lightning Bolt/i).length).toBeGreaterThan(0)
  })
})

describe('FlyingCardOverlay retarget', () => {
  const card: CardView = { id: 'card-retarget', name: 'Lightning Bolt', manaValue: 1, expansionSetCode: 'LEA', cardNumber: '161' }
  const fromRect = { left: 50, top: 600, width: 100, height: 140, right: 150, bottom: 740, x: 50, y: 600, toJSON: () => {} } as DOMRect
  const restRect = { left: 500, top: 250, width: 100, height: 140, right: 600, bottom: 390, x: 500, y: 250, toJSON: () => {} } as DOMRect

  let frames: FrameRequestCallback[]
  let keyframeEffects: Keyframe[][]
  let target: HTMLElement
  let realGetComputedStyle: typeof window.getComputedStyle

  function mockTarget(left: number, top: number, translate: string) {
    vi.spyOn(target, 'getBoundingClientRect').mockReturnValue({
      left, top, width: 100, height: 140, right: left + 100, bottom: top + 140, x: left, y: top, toJSON: () => {},
    } as DOMRect)
    vi.spyOn(window, 'getComputedStyle').mockImplementation((el: Element) =>
      el === target ? ({ translate } as CSSStyleDeclaration) : realGetComputedStyle(el)
    )
  }

  function runFrames() {
    frames.splice(0).forEach((cb) => cb(0))
  }

  beforeEach(() => {
    clearFlights()
    frames = []
    keyframeEffects = []
    realGetComputedStyle = window.getComputedStyle.bind(window)
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => frames.push(cb))
    vi.stubGlobal('cancelAnimationFrame', vi.fn())
    vi.stubGlobal('KeyframeEffect', class {
      constructor(_el: Element, keyframes: Keyframe[]) {
        keyframeEffects.push(keyframes)
      }
    })
    Object.defineProperty(HTMLElement.prototype, 'animate', {
      configurable: true,
      value: vi.fn(() => ({ playState: 'running', effect: null, finished: new Promise(() => {}), cancel: vi.fn() })),
    })
    target = document.createElement('div')
    target.setAttribute('data-card-id', 'slot-1')
    document.body.appendChild(target)
  })

  afterEach(() => {
    cleanup()
    clearFlights()
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
    delete (HTMLElement.prototype as { animate?: unknown }).animate
    target.remove()
  })

  it('ignores the slot translate when re-anchoring the landing segment', () => {
    mockTarget(700, 250, '200px 0px')
    startCardFlight(card, fromRect, restRect, 300, '[data-card-id="slot-1"]')
    render(<FlyingCardOverlay />)
    runFrames()
    expect(keyframeEffects).toHaveLength(0)
  })

  it('re-anchors the landing segment to the resting destination when it really moved', () => {
    mockTarget(600, 250, '0px 0px')
    startCardFlight(card, fromRect, restRect, 300, '[data-card-id="slot-1"]')
    render(<FlyingCardOverlay />)
    runFrames()
    expect(keyframeEffects).toHaveLength(1)
    const last = keyframeEffects[0][keyframeEffects[0].length - 1]
    expect(String(last.transform)).toContain('translate3d(600px, ')
  })
})

describe('FlyingCardOverlay lift', () => {
  const card: CardView = { id: 'card-cast', name: 'Lightning Bolt', manaValue: 1, expansionSetCode: 'LEA', cardNumber: '161' }
  const fromRect = { left: 50, top: 600, width: 100, height: 140, right: 150, bottom: 740, x: 50, y: 600, toJSON: () => {} } as DOMRect
  const restRect = { left: 500, top: 250, width: 100, height: 140, right: 600, bottom: 390, x: 500, y: 250, toJSON: () => {} } as DOMRect

  let animated: Keyframe[][]

  beforeEach(() => {
    vi.useFakeTimers()
    clearFlights()
    animated = []
    Object.defineProperty(HTMLElement.prototype, 'animate', {
      configurable: true,
      value: vi.fn((keyframes: Keyframe[]) => {
        animated.push(keyframes)
        return { playState: 'running', effect: null, finished: new Promise(() => {}), cancel: vi.fn(), currentTime: 0 }
      }),
    })
  })

  afterEach(() => {
    cleanup()
    clearFlights()
    vi.useRealTimers()
    vi.restoreAllMocks()
    delete (HTMLElement.prototype as { animate?: unknown }).animate
  })

  it('a cast spell rises to the middle of the screen, holds, then flies to its destination', () => {
    startCardFlight(card, fromRect, restRect, CAST_FLIGHT_MS, undefined, { lift: true })
    render(<FlyingCardOverlay />)

    const frames = animated[0]
    expect(frames.map((f) => f.offset)).toEqual([0, 0.27, 0.5, 1])
    expect(frames[1].width).not.toBe('100px')
    expect(String(frames[2].transform)).toBe(String(frames[1].transform))
    expect(String(frames[3].transform)).toContain('translate3d(500px, 250px, 0)')
    expect(frames[3].width).toBe('100px')
  })

  it('a creature entering keeps the drop with its settle frame', () => {
    startCardFlight(card, fromRect, restRect, ENTER_FLIGHT_MS, undefined, { variant: 'enter' })
    render(<FlyingCardOverlay />)

    expect(animated[0].map((f) => f.offset)).toEqual([0, 0.27, 0.5, 0.8, 1])
  })

  it('a cast spell makes no landing sound, the stack already plays its cast sound', () => {
    const play = vi.spyOn(soundManager, 'play')
    startCardFlight(card, fromRect, restRect, CAST_FLIGHT_MS, undefined, { lift: true })
    render(<FlyingCardOverlay />)
    play.mockClear()

    vi.advanceTimersByTime(CAST_FLIGHT_MS)

    expect(play).not.toHaveBeenCalledWith('card_land', 'game')
  })
})
