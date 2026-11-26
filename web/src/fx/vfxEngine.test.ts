import { beforeEach, describe, expect, it, vi } from 'vitest'
import { setState } from '../state/state'
import { VfxEngine } from './vfxEngine'

describe('VfxEngine', () => {
  let engine: VfxEngine

  beforeEach(() => {
    engine = new VfxEngine()
    setState({
      settings: {
        effects: true,
        animationSpeed: 1,
      } as ReturnType<typeof import('../state/state').getState>['settings'],
    })
  })

  it('spawns spark bursts, shockwaves, slashes, shatter, exile vortex and mythic bursts and drains cleanly', () => {
    engine.sparkBurst(100, 100, 'R', { count: 10, life: 0.2 })
    engine.shockwave(100, 100, 'gold', { duration: 0.2 })
    engine.slash(120, 120, -0.5, 'ember')
    engine.shatter({ left: 50, top: 50, width: 80, height: 110 }, 'ember', 8)
    engine.exileVortex({ left: 50, top: 50, width: 80, height: 110 }, 'W', 8)
    engine.mythicBurst(200, 200, 'gold')

    expect(engine.hasActiveEffects()).toBe(true)
    expect(engine.activeCount()).toBeGreaterThan(20)

    // Advance well past all max lifetimes
    for (let i = 0; i < 30; i++) engine.step(0.05)
    expect(engine.hasActiveEffects()).toBe(false)
    expect(engine.activeCount()).toBe(0)
  })

  it('fires projectile onImpact callback on arrival', () => {
    const onImpact = vi.fn()
    engine.projectile({ x: 0, y: 0 }, { x: 200, y: 100 }, 'R', 0.2, onImpact)
    expect(onImpact).not.toHaveBeenCalled()

    engine.step(0.1)
    expect(onImpact).not.toHaveBeenCalled()

    engine.step(0.15)
    expect(onImpact).toHaveBeenCalledTimes(1)
  })

  it('fires projectile onImpact immediately and spawns no particles when effects are off', () => {
    setState({ settings: { effects: false, animationSpeed: 1 } as never })
    const onImpact = vi.fn()
    engine.projectile({ x: 0, y: 0 }, { x: 200, y: 100 }, 'R', 0.3, onImpact)
    engine.sparkBurst(100, 100, 'R')
    expect(onImpact).toHaveBeenCalledTimes(1)
    expect(engine.hasActiveEffects()).toBe(false)
  })

  it('clear empties all active effects immediately', () => {
    engine.mythicBurst(100, 100, 'gold')
    expect(engine.hasActiveEffects()).toBe(true)
    engine.clear()
    expect(engine.hasActiveEffects()).toBe(false)
  })
})
