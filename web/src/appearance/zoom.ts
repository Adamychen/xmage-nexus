export const ZOOM_MIN = 0.5
export const ZOOM_MAX = 2
export const ZOOM_STEP = 0.1
export const ZOOM_DEFAULT = 1
export const ZOOM_PRESETS = [0.9, 1, 1.15, 1.3, 1.5]
export const ZOOM_PRESET_EPSILON = 0.001

export function roundZoom(value: number): number {
  return Math.round(value * 100) / 100
}

export function clampZoom(value: number): number {
  if (!Number.isFinite(value)) return ZOOM_DEFAULT
  return Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, roundZoom(value)))
}

export function stepZoom(current: number, dir: 1 | -1): number {
  const c = roundZoom(current)
  const sorted = [...ZOOM_PRESETS].sort((a, b) => a - b)
  if (dir === 1) {
    const nextPreset = sorted.find((p) => p > c + ZOOM_PRESET_EPSILON)
    if (nextPreset !== undefined) return clampZoom(nextPreset)
    return clampZoom(c + ZOOM_STEP)
  }
  const prevPreset = [...sorted].reverse().find((p) => p < c - ZOOM_PRESET_EPSILON)
  if (prevPreset !== undefined) return clampZoom(prevPreset)
  return clampZoom(c - ZOOM_STEP)
}

export function normalizeZoom(value: unknown): number {
  return typeof value === 'number' ? clampZoom(value) : ZOOM_DEFAULT
}

export function zoomPercent(value: number): number {
  return Math.round(clampZoom(value) * 100)
}

export function isZoomPreset(value: number, preset: number): boolean {
  return Math.abs(clampZoom(value) - preset) < ZOOM_PRESET_EPSILON
}

export function inverseZoom(value: number): number {
  const z = clampZoom(value)
  if (z === ZOOM_DEFAULT) return ZOOM_DEFAULT
  return Math.round((1 / z) * 1000) / 1000
}
