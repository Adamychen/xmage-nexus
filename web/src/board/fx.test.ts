import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { applyFxRoot, fxDuration, fxMotionAllowed, fxMotionDuration, fxOpacityDuration } from './fx'
import { getState, setState } from '../state/state'

function setFx(effects: boolean, animationSpeed = 1) {
  setState({ settings: { ...getState().settings, effects, animationSpeed } })
}

function setReducedMotion(reduce: boolean) {
  window.matchMedia = vi.fn().mockReturnValue({ matches: reduce }) as unknown as typeof window.matchMedia
}

describe('fx helpers', () => {
  beforeEach(() => {
    setFx(true, 1)
  })

  afterEach(() => {
    delete (window as { matchMedia?: unknown }).matchMedia
    document.documentElement.classList.remove('fx-off')
    document.documentElement.style.removeProperty('--fx-speed')
  })

  it('fxDuration only scales by the speed setting', () => {
    expect(fxDuration(400)).toBe(400)
    setFx(true, 0.5)
    expect(fxDuration(400)).toBe(800)
    setFx(true, 1.5)
    expect(fxDuration(400)).toBe(267)
    expect(fxDuration(10)).toBe(60)
  })

  it('fxDuration ignores the effects switch and reduced motion', () => {
    setFx(false)
    expect(fxDuration(400)).toBe(400)
    setFx(true)
    setReducedMotion(true)
    expect(fxDuration(400)).toBe(400)
  })

  it('fxMotionDuration keeps the scaled duration when motion is allowed', () => {
    expect(fxMotionDuration(400)).toBe(400)
    setFx(true, 0.5)
    expect(fxMotionDuration(400)).toBe(800)
  })

  it('fxMotionDuration returns 0 with effects off or reduced motion', () => {
    setFx(false)
    expect(fxMotionDuration(400)).toBe(0)
    setFx(true)
    setReducedMotion(true)
    expect(fxMotionDuration(400)).toBe(0)
    expect(fxMotionAllowed()).toBe(false)
  })

  it('fxOpacityDuration keeps opacity feedback under reduced motion, capped at 150 ms', () => {
    setReducedMotion(true)
    expect(fxOpacityDuration(400)).toBe(150)
    expect(fxOpacityDuration(100)).toBe(100)
  })

  it('fxOpacityDuration returns 0 only when effects are off', () => {
    setFx(false)
    expect(fxOpacityDuration(400)).toBe(0)
  })

  it('applyFxRoot mirrors the effects switch and speed on the root', () => {
    setFx(false, 1.5)
    applyFxRoot()
    expect(document.documentElement.classList.contains('fx-off')).toBe(true)
    expect(document.documentElement.style.getPropertyValue('--fx-speed')).toBe('1.5')
    setFx(true, 0.5)
    applyFxRoot()
    expect(document.documentElement.classList.contains('fx-off')).toBe(false)
    expect(document.documentElement.style.getPropertyValue('--fx-speed')).toBe('0.5')
  })
})
