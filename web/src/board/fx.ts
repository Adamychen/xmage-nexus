import { getState } from '../state/state'

export interface FxPrefs {
  enabled: boolean
  speed: number
}

export const FX_SPEEDS = [0.5, 1, 1.5] as const

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

/** Duración efectiva (ms) de una animación decorativa según la velocidad
 *  elegida por el usuario. Devuelve 0 si los efectos están desactivados o si
 *  el sistema pide reduced-motion (los efectos se suprimen). */
export function fxDuration(ms: number): number {
  if (!fxEnabled()) return 0
  if (prefersReducedMotion()) return 0
  const { speed } = getFxPrefs()
  return Math.max(60, Math.round(ms / speed))
}

/** Refleja los ajustes de efectos en el root del documento: clase `fx-off`
 *  (apaga animaciones decorativas CSS) + variable `--fx-speed`. */
export function applyFxRoot(): void {
  if (typeof document === 'undefined') return
  const { enabled, speed } = getFxPrefs()
  document.documentElement.classList.toggle('fx-off', !enabled)
  document.documentElement.style.setProperty('--fx-speed', String(speed))
}
