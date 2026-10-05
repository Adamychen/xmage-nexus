import { describe, it, expect, beforeEach, vi } from 'vitest'
import { containSize } from './customImage'
import { CUSTOM_PLAYMAT_KEY, customPlaymatStore } from './customPlaymat'
import { customSleeveStore } from './customSleeve'
import { effectivePlaymat, normalizePlaymat } from './playmats'

const JPG = 'data:image/jpeg;base64,/9j/4AAQ'

function memoryStorage(): Storage {
  const data = new Map<string, string>()
  return {
    get length() { return data.size },
    clear: () => data.clear(),
    getItem: (k) => data.get(k) ?? null,
    key: (i) => [...data.keys()][i] ?? null,
    removeItem: (k) => { data.delete(k) },
    setItem: (k, v) => { data.set(k, String(v)) },
  }
}

describe('custom playmat store', () => {
  beforeEach(() => {
    vi.stubGlobal('localStorage', memoryStorage())
    customPlaymatStore.clear()
    customSleeveStore.clear()
  })

  it('persists under its own key, independent of the sleeve', () => {
    customPlaymatStore.set(JPG)
    expect(localStorage.getItem(CUSTOM_PLAYMAT_KEY)).toBe(JPG)
    expect(customPlaymatStore.get()).toBe(JPG)
    expect(customSleeveStore.get()).toBeNull()
    customPlaymatStore.clear()
    expect(customPlaymatStore.get()).toBeNull()
  })
})

describe('playmat resolution', () => {
  it('keeps custom as a persisted choice', () => {
    expect(normalizePlaymat('custom')).toBe('custom')
    expect(normalizePlaymat('nope')).toBe('classic')
  })

  it('shows the custom mat only when an image exists', () => {
    expect(effectivePlaymat('custom', JPG)).toBe('custom')
    expect(effectivePlaymat('custom', null)).toBe('classic')
    expect(effectivePlaymat('ember', null)).toBe('ember')
    expect(effectivePlaymat(undefined, null)).toBe('classic')
  })
})

describe('containSize', () => {
  it('scales a large image down to fit, keeping its aspect ratio', () => {
    expect(containSize(3840, 2160, 1920, 1080)).toEqual({ width: 1920, height: 1080 })
    expect(containSize(4000, 1000, 1920, 1080)).toEqual({ width: 1920, height: 480 })
    expect(containSize(1000, 3000, 1920, 1080)).toEqual({ width: 360, height: 1080 })
  })

  it('never upscales a small image', () => {
    expect(containSize(800, 600, 1920, 1080)).toEqual({ width: 800, height: 600 })
  })
})
