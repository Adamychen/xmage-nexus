import { describe, it, expect, beforeEach, vi } from 'vitest'
import { CUSTOM_SLEEVE_KEY, clearCustomSleeve, coverCrop, getCustomSleeve, setCustomSleeve } from './customSleeve'
import { getSleeveDef, isValidSleeveId } from './sleeves'
import { resolveSleeveFor } from './useSleeve'

const PNG = 'data:image/png;base64,iVBORw0KGgo='

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

describe('custom sleeve store', () => {
  beforeEach(() => {
    vi.stubGlobal('localStorage', memoryStorage())
    clearCustomSleeve()
  })

  it('persists and clears the uploaded image', () => {
    setCustomSleeve(PNG)
    expect(getCustomSleeve()).toBe(PNG)
    expect(localStorage.getItem(CUSTOM_SLEEVE_KEY)).toBe(PNG)
    clearCustomSleeve()
    expect(getCustomSleeve()).toBeNull()
    expect(localStorage.getItem(CUSTOM_SLEEVE_KEY)).toBeNull()
  })

  it('rejects anything that is not an image data URL', () => {
    expect(() => setCustomSleeve('https://example.com/x.png')).toThrow()
    expect(getCustomSleeve()).toBeNull()
  })
})

describe('custom sleeve resolution', () => {
  it('resolves to the uploaded image when one exists', () => {
    const def = getSleeveDef('custom', PNG)
    expect(def.id).toBe('custom')
    expect(def.kind).toBe('image')
    expect(def.imageUrl).toBe(PNG)
  })

  it('falls back to the classic back when the image is missing', () => {
    expect(getSleeveDef('custom', null).id).toBe('classic')
    expect(getSleeveDef('custom').id).toBe('classic')
  })

  it('treats custom as a valid sleeve id', () => {
    expect(isValidSleeveId('custom')).toBe(true)
  })
})

describe('sleeve ownership', () => {
  it('uses the chosen sleeve only for cards the local player controls', () => {
    expect(resolveSleeveFor('me', 'me', 'custom', PNG).imageUrl).toBe(PNG)
    expect(resolveSleeveFor('opp', 'me', 'custom', PNG).id).toBe('classic')
    expect(resolveSleeveFor('opp', 'me', 'nebula', null).id).toBe('classic')
  })

  it('falls back to classic when ownership is unknown', () => {
    expect(resolveSleeveFor(undefined, 'me', 'custom', PNG).id).toBe('classic')
    expect(resolveSleeveFor('me', null, 'custom', PNG).id).toBe('classic')
  })
})

describe('coverCrop', () => {
  it('crops the sides of a wide image to card proportions', () => {
    const c = coverCrop(1000, 500, 372, 520)
    expect(c.sh).toBe(500)
    expect(c.sw).toBeCloseTo(500 * 372 / 520)
    expect(c.sx).toBeCloseTo((1000 - c.sw) / 2)
    expect(c.sy).toBe(0)
  })

  it('crops top and bottom of a tall image', () => {
    const c = coverCrop(500, 2000, 372, 520)
    expect(c.sw).toBe(500)
    expect(c.sh).toBeCloseTo(500 * 520 / 372)
    expect(c.sx).toBe(0)
    expect(c.sy).toBeCloseTo((2000 - c.sh) / 2)
  })
})
