import { getState } from '../state/state'

export interface FxPrefs {
  enabled: boolean
  speed: number
}

export const FX_SPEEDS = [0.5, 1, 1.5] as const

export const FX_OPACITY_MAX_MS = 150

export function getFxPrefs(): FxPrefs {
  try {
    const settings = getState().settings
    return {
      enabled: settings.effects !== false,
      speed: (FX_SPEEDS as readonly number[]).includes(settings.animationSpeed) ? settings.animationSpeed : 1,
    }
  } catch {
    return { enabled: true, speed: 1 }
  }
}

export function prefersReducedMotion(): boolean {
  return typeof window !== 'undefined' && typeof window.matchMedia === 'function'
    && window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

export function fxEnabled(): boolean {
  return getFxPrefs().enabled
}

export function fxMotionAllowed(): boolean {
  return fxEnabled() && !prefersReducedMotion()
}

export function fxOpacityAllowed(): boolean {
  return fxEnabled()
}

export function fxDuration(ms: number): number {
  return Math.max(60, Math.round(ms / getFxPrefs().speed))
}

export function fxMotionDuration(ms: number): number {
  return fxMotionAllowed() ? fxDuration(ms) : 0
}

export function fxOpacityDuration(ms: number): number {
  return fxOpacityAllowed() ? Math.min(fxDuration(ms), FX_OPACITY_MAX_MS) : 0
}

/** Mirrors the effects settings on the document root: `fx-off` class (turns
 *  off decorative CSS animations) and the `--fx-speed` variable. */
export function applyFxRoot(): void {
  if (typeof document === 'undefined') return
  const { enabled, speed } = getFxPrefs()
  document.documentElement.classList.toggle('fx-off', !enabled)
  document.documentElement.style.setProperty('--fx-speed', String(speed))
}
