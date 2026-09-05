import { describe, expect, it } from 'vitest'
import {
  ZOOM_DEFAULT,
  ZOOM_MAX,
  ZOOM_MIN,
  clampZoom,
  isZoomPreset,
  normalizeZoom,
  roundZoom,
  stepZoom,
  zoomPercent,
} from './zoom'
import { applyAppearanceToDocument, loadAppearanceSettings, saveAppearanceSettings } from '../state/persistence'

describe('zoom helpers', () => {
  it('rounds to kill float dust while keeping presets exact', () => {
    expect(roundZoom(1.15)).toBe(1.15)
    expect(stepZoom(1, 1)).toBe(1.1)
    expect(stepZoom(1.1, -1)).toBe(1)
    expect(stepZoom(1.15, 1)).toBe(1.25)
  })

  it('clamps to the browser-like range', () => {
    expect(clampZoom(0.1)).toBe(ZOOM_MIN)
    expect(clampZoom(9)).toBe(ZOOM_MAX)
    expect(clampZoom(NaN)).toBe(ZOOM_DEFAULT)
    expect(clampZoom(Infinity)).toBe(ZOOM_DEFAULT)
  })

  it('stops at the range edges when stepping', () => {
    expect(stepZoom(ZOOM_MIN, -1)).toBe(ZOOM_MIN)
    expect(stepZoom(ZOOM_MAX, 1)).toBe(ZOOM_MAX)
  })

  it('migrates legacy stored values', () => {
    expect(normalizeZoom(1.15)).toBe(1.15)
    expect(normalizeZoom(1.234)).toBe(1.23)
    expect(normalizeZoom('1.5')).toBe(ZOOM_DEFAULT)
    expect(normalizeZoom(undefined)).toBe(ZOOM_DEFAULT)
  })

  it('reports percents and preset membership', () => {
    expect(zoomPercent(1.15)).toBe(115)
    expect(isZoomPreset(1.15, 1.15)).toBe(true)
    expect(isZoomPreset(1.2, 1.15)).toBe(false)
  })
})

describe('zoom persistence', () => {
  it('round-trips a continuous value through storage', () => {
    saveAppearanceSettings({ sleeveId: 'classic', boardLayout: 'standard', uiScale: 1.2, cjkBoost: true })
    expect(loadAppearanceSettings().uiScale).toBe(1.2)
  })

  it('applies zoom to the document element', () => {
    applyAppearanceToDocument({ sleeveId: 'classic', boardLayout: 'standard', uiScale: 1.3, cjkBoost: false })
    const root = document.documentElement
    expect(root.dataset.uiScale).toBe('1.3')
  })
})
