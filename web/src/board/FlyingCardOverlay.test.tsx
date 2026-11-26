import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, cleanup } from '@testing-library/react'
import FlyingCardOverlay from './FlyingCardOverlay'
import { clearFlights, startCardFlight, CAST_FLIGHT_MS, ENTER_FLIGHT_MS } from './flightManager'
import { soundManager } from '../audio/soundManager'
import { getFxDiagnostics, gsap, resetFxContext } from '../fx/fxEngine'
import { vfx } from '../fx/vfxEngine'
import type { CardView } from '../net/types'

const rect = (left: number, top: number, width = 100, height = 140) =>
  ({ left, top, width, height, right: left + width, bottom: top + height, x: left, y: top, toJSON: () => {} }) as DOMRect

describe('FlyingCardOverlay', () => {
  const dummyCard: CardView = {
    id: 'card-bolt',
    name: 'Lightning Bolt',
    manaValue: 1,
    expansionSetCode: 'LEA',
    cardNumber: '161',
  }

  beforeEach(() => {
    clearFlights()
    resetFxContext()
  })

  afterEach(() => {
    cleanup()
    clearFlights()
    resetFxContext()
  })

  it('renders nothing when there are no active flights', () => {
    const { container } = render(<FlyingCardOverlay />)
    expect(container.firstChild).toBeNull()
  })

  it('renders flying card overlay and starts a GSAP timeline when a flight is triggered', () => {
    startCardFlight(dummyCard, rect(50, 600), rect(500, 250), 300)

    const { getAllByText } = render(<FlyingCardOverlay />)
    expect(getAllByText(/Lightning Bolt/i).length).toBeGreaterThan(0)
    expect(getFxDiagnostics().activeTimelines()).toBeGreaterThanOrEqual(1)
  })

  it('triggers shatter VFX on destroy and exileVortex on exile', () => {
    startCardFlight(dummyCard, rect(50, 600), rect(500, 250), 300, undefined, { variant: 'destroy' })
    render(<FlyingCardOverlay />)
    expect(vfx.hasActiveEffects()).toBe(true)

    cleanup()
    clearFlights()
    resetFxContext()
    expect(vfx.hasActiveEffects()).toBe(false)

    startCardFlight(dummyCard, rect(50, 600), rect(500, 250), 300, undefined, { variant: 'exile' })
    render(<FlyingCardOverlay />)
    expect(vfx.hasActiveEffects()).toBe(true)
  })
})

describe('FlyingCardOverlay retarget', () => {
  const card: CardView = { id: 'card-retarget', name: 'Lightning Bolt', manaValue: 1, expansionSetCode: 'LEA', cardNumber: '161' }
  const fromRect = rect(50, 600)
  const restRect = rect(500, 250)

  let frames: FrameRequestCallback[]
  let target: HTMLElement
  let realGetComputedStyle: typeof window.getComputedStyle

  function mockTarget(left: number, top: number, translate: string) {
    vi.spyOn(target, 'getBoundingClientRect').mockReturnValue(rect(left, top))
    vi.spyOn(window, 'getComputedStyle').mockImplementation((el: Element) =>
      el === target ? ({ translate } as CSSStyleDeclaration) : realGetComputedStyle(el),
    )
  }

  function runFrames() {
    frames.splice(0).forEach((cb) => cb(0))
  }

  beforeEach(() => {
    clearFlights()
    resetFxContext()
    frames = []
    realGetComputedStyle = window.getComputedStyle.bind(window)
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => frames.push(cb))
    vi.stubGlobal('cancelAnimationFrame', vi.fn())
    target = document.createElement('div')
    target.setAttribute('data-card-id', 'slot-1')
    document.body.appendChild(target)
  })

  afterEach(() => {
    cleanup()
    clearFlights()
    resetFxContext()
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
    target.remove()
  })

  it('ignores the slot translate when re-anchoring the landing segment', () => {
    const toSpy = vi.spyOn(gsap, 'to')
    mockTarget(700, 250, '200px 0px')
    startCardFlight(card, fromRect, restRect, 300, '[data-card-id="slot-1"]')
    render(<FlyingCardOverlay />)
    toSpy.mockClear()
    runFrames()
    expect(toSpy).not.toHaveBeenCalled()
  })

  it('re-anchors the landing segment to the resting destination when it really moved', () => {
    const toSpy = vi.spyOn(gsap, 'to')
    mockTarget(600, 250, '0px 0px')
    startCardFlight(card, fromRect, restRect, 300, '[data-card-id="slot-1"]')
    render(<FlyingCardOverlay />)
    toSpy.mockClear()
    runFrames()
    expect(toSpy).toHaveBeenCalledTimes(1)
    expect(toSpy.mock.calls[0]?.[1]).toMatchObject({ x: 600, y: 250 })
  })
})

describe('FlyingCardOverlay lift', () => {
  const card: CardView = { id: 'card-cast', name: 'Lightning Bolt', manaValue: 1, expansionSetCode: 'LEA', cardNumber: '161' }
  const fromRect = rect(50, 600)
  const restRect = rect(500, 250)

  beforeEach(() => {
    clearFlights()
    resetFxContext()
  })

  afterEach(() => {
    cleanup()
    clearFlights()
    resetFxContext()
    vi.restoreAllMocks()
  })

  it('a cast spell runs a GSAP lift timeline and makes no card_land sound', () => {
    const play = vi.spyOn(soundManager, 'play')
    startCardFlight(card, fromRect, restRect, CAST_FLIGHT_MS, undefined, { lift: true })
    render(<FlyingCardOverlay />)
    play.mockClear()
    expect(getFxDiagnostics().activeTimelines()).toBe(1)

    gsap.globalTimeline.progress(1)
    expect(play).not.toHaveBeenCalledWith('card_land', 'game')
  })

  it('a creature entering runs a GSAP enter timeline', () => {
    startCardFlight(card, fromRect, restRect, ENTER_FLIGHT_MS, undefined, { variant: 'enter' })
    render(<FlyingCardOverlay />)
    expect(getFxDiagnostics().activeTimelines()).toBe(1)
  })

  it('a tapped card bouncing to hand or milling to graveyard straightens to 0deg on arrival', () => {
    const tappedCard = { ...card, tapped: true }
    startCardFlight(tappedCard, fromRect, restRect, 350, '.hand-bar .hand-card-slot:last-child')
    const { container } = render(<FlyingCardOverlay />)
    const el = container.querySelector<HTMLElement>('.flying-card-item')!
    gsap.globalTimeline.progress(1)
    expect(Number(gsap.getProperty(el, 'rotation'))).toBe(0)
  })
})
