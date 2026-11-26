import gsap from 'gsap'
import { Flip } from 'gsap/Flip'
import { MotionPathPlugin } from 'gsap/MotionPathPlugin'
import { fxEnabled, fxMotionAllowed, getFxPrefs, onFxRootApplied, prefersReducedMotion } from '../board/fx'

gsap.registerPlugin(Flip, MotionPathPlugin)

export { gsap, Flip, MotionPathPlugin }

/** Arena-inspired easing presets: snappy anticipation, weighty impact, clean settle. */
export const ARENA_EASE = {
  /** Fast launch, crisp deceleration (draw, hover, UI reveal). */
  snapOut: 'power3.out',
  /** Heavy drop onto the table (land/permanent slam). */
  slamIn: 'power4.in',
  /** Punchy pop-in with subtle overshoot (token materialization, badges). */
  pop: 'back.out(1.7)',
  /** Elastic recoil after a combat strike. */
  recoil: 'power2.out',
  /** Smooth curved travel (cast to stack, bounce, reattach). */
  arc: 'power2.inOut',
  /** Combat lunge: brief pull-back then violent strike forward. */
  lunge: 'back.in(2.2)',
} as const

let currentContext: gsap.Context | null = null
const activeTimelines = new Set<gsap.core.Timeline>()
const resetListeners = new Set<() => void>()

export function onFxReset(listener: () => void): () => void {
  resetListeners.add(listener)
  return () => resetListeners.delete(listener)
}

/** Syncs GSAP's global timeline timeScale with the player's animationSpeed preference. */
export function syncFxClock(): void {
  const { enabled, speed } = getFxPrefs()
  gsap.globalTimeline.timeScale(enabled ? speed : 100)
}

onFxRootApplied(syncFxClock)

/** Returns (or lazily creates) the active game-scoped GSAP context. */
export function getFxContext(): gsap.Context {
  if (!currentContext) {
    currentContext = gsap.context(() => {})
  }
  return currentContext
}

/** Atomically kills and reverts every active GSAP animation and notifies VFX listeners. */
export function resetFxContext(): void {
  activeTimelines.forEach((tl) => tl.kill())
  activeTimelines.clear()
  if (currentContext) {
    currentContext.revert()
    currentContext = null
  }
  resetListeners.forEach((fn) => fn())
}

/** Runs animation setup inside the active game-scoped GSAP context. */
export function fxRun<T>(fn: () => T, opts?: { allowReducedMotion?: boolean }): T | null {
  if (!fxEnabled()) return null
  if (!opts?.allowReducedMotion && prefersReducedMotion()) return null
  syncFxClock()
  let result: T | null = null
  getFxContext().add(() => {
    result = fn()
  })
  return result
}

/** Creates a tracked GSAP timeline inside the active game context. Returns null if FX are disabled. */
export function fxTimeline(vars?: gsap.TimelineVars, opts?: { allowReducedMotion?: boolean }): gsap.core.Timeline | null {
  return fxRun(() => {
    const userOnComplete = vars?.onComplete
    const tl = gsap.timeline({
      ...vars,
      onComplete(...args: unknown[]) {
        activeTimelines.delete(tl)
        if (typeof userOnComplete === 'function') {
          userOnComplete.apply(tl, args as [])
        }
      },
    })
    activeTimelines.add(tl)
    return tl
  }, opts)
}

/** Arena-style damped GPU shake (pure x/y, never touches layout or tap rotation). */
export function fxShake(target: gsap.TweenTarget, intensity: 'light' | 'medium' | 'heavy' = 'medium'): gsap.core.Timeline | null {
  if (!fxMotionAllowed()) return null
  if (typeof Element !== 'undefined' && target instanceof Element && !target.isConnected) return null
  const amp = intensity === 'heavy' ? 10 : intensity === 'medium' ? 5.5 : 2.5
  const tl = fxTimeline()
  if (!tl) return null
  tl.to(target, { x: amp, y: -amp * 0.6, duration: 0.035, ease: 'none' })
    .to(target, { x: -amp * 0.85, y: amp * 0.5, duration: 0.04, ease: 'none' })
    .to(target, { x: amp * 0.55, y: -amp * 0.3, duration: 0.04, ease: 'none' })
    .to(target, { x: -amp * 0.25, y: amp * 0.15, duration: 0.045, ease: 'none' })
    .to(target, { x: 0, y: 0, duration: 0.05, ease: 'power2.out', clearProps: 'x,y' })
  return tl
}

export interface FxDiagnostics {
  activeTimelines: () => number
  activeTweens: () => number
  speed: () => number
  enabled: () => boolean
  reducedMotion: () => boolean
  reset: () => void
}

export function getFxDiagnostics(): FxDiagnostics {
  return {
    activeTimelines: () => activeTimelines.size,
    activeTweens: () => gsap.globalTimeline.getChildren(true, true, false).length,
    speed: () => getFxPrefs().speed,
    enabled: () => fxEnabled(),
    reducedMotion: () => prefersReducedMotion(),
    reset: resetFxContext,
  }
}

if (typeof window !== 'undefined') {
  ;(window as unknown as { __mageFx?: FxDiagnostics }).__mageFx = getFxDiagnostics()
}
