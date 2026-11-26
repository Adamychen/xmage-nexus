import { beforeEach, describe, expect, it } from 'vitest'
import { setState } from '../state/state'
import { fxRun, fxShake, fxTimeline, getFxDiagnostics, gsap, onFxReset, resetFxContext, syncFxClock } from './fxEngine'

describe('fxEngine', () => {
  beforeEach(() => {
    resetFxContext()
    setState({
      settings: {
        effects: true,
        animationSpeed: 1,
      } as ReturnType<typeof import('../state/state').getState>['settings'],
    })
    syncFxClock()
  })

  it('scales globalTimeline timeScale to match animationSpeed', () => {
    setState({ settings: { effects: true, animationSpeed: 1.5 } as never })
    syncFxClock()
    expect(gsap.globalTimeline.timeScale()).toBe(1.5)

    setState({ settings: { effects: true, animationSpeed: 0.5 } as never })
    syncFxClock()
    expect(gsap.globalTimeline.timeScale()).toBe(0.5)
  })

  it('refuses to start timelines when effects are off', () => {
    setState({ settings: { effects: false, animationSpeed: 1 } as never })
    const tl = fxTimeline()
    expect(tl).toBeNull()
    expect(getFxDiagnostics().activeTimelines()).toBe(0)
  })

  it('tracks active timelines and clears them atomically on resetFxContext', () => {
    let resetCalled = 0
    const off = onFxReset(() => { resetCalled++ })
    try {
      const target = { x: 0 }
      const tl = fxTimeline()
      expect(tl).not.toBeNull()
      tl!.to(target, { x: 100, duration: 1 })
      expect(getFxDiagnostics().activeTimelines()).toBe(1)

      resetFxContext()
      expect(getFxDiagnostics().activeTimelines()).toBe(0)
      expect(resetCalled).toBe(1)
    } finally {
      off()
    }
  })

  it('fxRun executes inside context and fxShake creates a damped timeline', () => {
    const target = { x: 0, y: 0 }
    const ran = fxRun(() => 42)
    expect(ran).toBe(42)
    const shake = fxShake(target, 'heavy')
    expect(shake).not.toBeNull()
    expect(getFxDiagnostics().activeTimelines()).toBe(1)
    resetFxContext()
  })
})
