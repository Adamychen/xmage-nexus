import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  announceBanner,
  clearFeedbackFx,
  getFeedbackFxState,
  spawnFloater,
} from './feedbackFx'
import { setState, getState } from '../state/state'

function rect(left = 100, top = 200): DOMRect {
  return {
    left,
    top,
    right: left + 100,
    bottom: top + 140,
    width: 100,
    height: 140,
    x: left,
    y: top,
    toJSON: () => {},
  } as DOMRect
}

function setEffects(enabled: boolean) {
  setState({ settings: { ...getState().settings, effects: enabled } })
}

describe('feedbackFx', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    clearFeedbackFx()
    setEffects(true)
  })

  afterEach(() => {
    vi.useRealTimers()
    clearFeedbackFx()
    setEffects(true)
  })

  it('spawns a floater at the element position', () => {
    spawnFloater('card:c1', rect(), '-3', 'bad')
    const { floaters } = getFeedbackFxState()
    expect(floaters).toHaveLength(1)
    expect(floaters[0].text).toBe('-3')
    expect(floaters[0].tone).toBe('bad')
    expect(floaters[0].x).toBe(150)
  })

  it('throttles repeated floaters for the same key', () => {
    spawnFloater('card:c1', rect(), '-3', 'bad')
    spawnFloater('card:c1', rect(), '-2', 'bad')
    expect(getFeedbackFxState().floaters).toHaveLength(1)

    vi.advanceTimersByTime(200)
    spawnFloater('card:c1', rect(), '-2', 'bad')
    expect(getFeedbackFxState().floaters).toHaveLength(2)
  })

  it('allows different keys simultaneously', () => {
    spawnFloater('card:c1', rect(), '-3', 'bad')
    spawnFloater('life:p1', rect(), '-5', 'bad')
    expect(getFeedbackFxState().floaters).toHaveLength(2)
  })

  it('removes floaters after their duration', () => {
    spawnFloater('card:c1', rect(), '-3', 'bad')
    vi.advanceTimersByTime(1300)
    expect(getFeedbackFxState().floaters).toHaveLength(0)
  })

  it('ignores null or empty rects', () => {
    spawnFloater('card:c1', null, '-3', 'bad')
    spawnFloater('card:c2', { ...rect(), width: 0 } as DOMRect, '-3', 'bad')
    expect(getFeedbackFxState().floaters).toHaveLength(0)
  })

  it('does nothing when effects are disabled', () => {
    setEffects(false)
    spawnFloater('card:c1', rect(), '-3', 'bad')
    announceBanner('Turn 2')
    expect(getFeedbackFxState().floaters).toHaveLength(0)
    expect(getFeedbackFxState().banner).toBeNull()
  })

  it('does nothing when prefers-reduced-motion is set', () => {
    const matchMedia = vi.fn().mockReturnValue({ matches: true })
    vi.stubGlobal('matchMedia', matchMedia)
    window.matchMedia = matchMedia as unknown as typeof window.matchMedia

    spawnFloater('card:c1', rect(), '-3', 'bad')
    announceBanner('Turn 2')
    expect(getFeedbackFxState().floaters).toHaveLength(0)
    expect(getFeedbackFxState().banner).toBeNull()

    vi.unstubAllGlobals()
    delete (window as { matchMedia?: unknown }).matchMedia
  })

  it('announces a banner and auto-clears it', () => {
    announceBanner('Turn 2 · Alice', 'PRECOMBAT_MAIN')
    const { banner } = getFeedbackFxState()
    expect(banner).not.toBeNull()
    expect(banner?.text).toBe('Turn 2 · Alice')

    vi.advanceTimersByTime(2000)
    expect(getFeedbackFxState().banner).toBeNull()
  })

  it('replaces a previous banner with the newest one', () => {
    announceBanner('Turn 2')
    announceBanner('Turn 3')
    expect(getFeedbackFxState().banner?.text).toBe('Turn 3')

    vi.advanceTimersByTime(2000)
    expect(getFeedbackFxState().banner).toBeNull()
  })
})
