import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { CardView } from '../net/types'

const idb = new Map<string, string>()

vi.mock('idb-keyval', () => ({
  createStore: vi.fn(() => ({})),
  get: vi.fn(async (key: string) => idb.get(key)),
  set: vi.fn(async (key: string, value: string) => {
    idb.set(key, value)
  }),
  del: vi.fn(async (key: string) => {
    idb.delete(key)
  }),
  entries: vi.fn(async () => [...idb.entries()]),
}))

vi.mock('../appearance/customImage', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../appearance/customImage')>()),
  fileToImageDataUrl: vi.fn(async () => 'data:image/jpeg;base64,PROCESSED'),
}))

const { setCustomCardArtDataUrl, setCustomCardArtFromFile, peekCustomCardArt, ensureCustomCardArt, resetCustomCardArtCache, customArtName, listCustomCardArt } =
  await import('./customCardArt')

const view = (name: string, extra: Partial<CardView> = {}): CardView =>
  ({ name, manaValue: 0, ...extra }) as CardView

describe('customCardArt', () => {
  beforeEach(() => {
    idb.clear()
    resetCustomCardArtCache()
  })

  it('peek returns null for cards without custom art', () => {
    expect(peekCustomCardArt('Bolt')).toBeNull()
    expect(peekCustomCardArt(null)).toBeNull()
  })

  it('set + peek roundtrip, normalizing the name', () => {
    setCustomCardArtDataUrl('Lightning Bolt', 'data:image/jpeg;base64,ABC')
    expect(peekCustomCardArt('lightning bolt')).toBe('data:image/jpeg;base64,ABC')
    expect(peekCustomCardArt('Lightning Bolt ')).toBe('data:image/jpeg;base64,ABC')
  })

  it('rejects non-image data URLs', () => {
    expect(() => setCustomCardArtDataUrl('Bolt', 'https://evil.test/x')).toThrow('invalid image')
  })

  it('replicates the image across both faces of a double-faced card', () => {
    setCustomCardArtDataUrl('Delver of Secrets // Insectile Aberration', 'data:image/png;base64,DFC')
    expect(peekCustomCardArt('Delver of Secrets')).toBe('data:image/png;base64,DFC')
    expect(peekCustomCardArt('Insectile Aberration')).toBe('data:image/png;base64,DFC')
  })

  it('remove clears memory and IndexedDB for every face', async () => {
    setCustomCardArtDataUrl('Delver of Secrets // Insectile Aberration', 'data:image/png;base64,DFC')
    setCustomCardArtDataUrl('Delver of Secrets // Insectile Aberration', null)
    expect(peekCustomCardArt('Delver of Secrets')).toBeNull()
    await vi.waitFor(() => {
      expect(idb.has('delver of secrets')).toBe(false)
      expect(idb.has('insectile aberration')).toBe(false)
    })
  })

  it('ensure loads a stored image from IndexedDB into memory', async () => {
    idb.set('bolt', 'data:image/jpeg;base64,PERSISTED')
    expect(peekCustomCardArt('Bolt')).toBeNull()
    await ensureCustomCardArt('Bolt')
    expect(peekCustomCardArt('Bolt')).toBe('data:image/jpeg;base64,PERSISTED')
  })

  it('lists stored images sorted by name (for the settings manager)', async () => {
    idb.set('shock', 'data:image/jpeg;base64,B')
    idb.set('bolt', 'data:image/jpeg;base64,A')
    idb.set('broken', 'https://not-an-image')
    const list = await listCustomCardArt()
    expect(list).toEqual([
      { name: 'bolt', dataUrl: 'data:image/jpeg;base64,A' },
      { name: 'shock', dataUrl: 'data:image/jpeg;base64,B' },
    ])
  })

  it('list preserves the display name of recently added cards', async () => {
    setCustomCardArtDataUrl('Lightning Bolt', 'data:image/jpeg;base64,A')
    const list = await listCustomCardArt()
    expect(list).toEqual([{ name: 'Lightning Bolt', dataUrl: 'data:image/jpeg;base64,A' }])
  })

  it('list returns an empty array without IndexedDB', async () => {
    idb.clear()
    expect(await listCustomCardArt()).toEqual([])
  })

  it('ensure ignores stored values that are not image data URLs', async () => {
    idb.set('bolt', 'https://evil.test/x')
    await ensureCustomCardArt('Bolt')
    expect(peekCustomCardArt('Bolt')).toBeNull()
  })

  it('setCustomCardArtFromFile processes and stores the file', async () => {
    const file = new File(['x'], 'art.jpg', { type: 'image/jpeg' })
    Object.defineProperty(file, 'size', { value: 1024 })
    await setCustomCardArtFromFile('Bolt', file)
    expect(peekCustomCardArt('Bolt')).toBe('data:image/jpeg;base64,PROCESSED')
    await vi.waitFor(() => {
      expect(idb.get('bolt')).toEqual({ name: 'Bolt', dataUrl: 'data:image/jpeg;base64,PROCESSED' })
    })
  })

  it('setCustomCardArtFromFile rejects non-images and oversized files', async () => {
    const bad = new File(['x'], 'x.txt', { type: 'text/plain' })
    await expect(setCustomCardArtFromFile('Bolt', bad)).rejects.toThrow('not an image')
    const big = new File(['x'], 'big.png', { type: 'image/png' })
    Object.defineProperty(big, 'size', { value: 16 * 1024 * 1024 })
    await expect(setCustomCardArtFromFile('Bolt', big)).rejects.toThrow('file too large')
    expect(peekCustomCardArt('Bolt')).toBeNull()
  })

  describe('customArtName', () => {
    it('uses the engine name for normal cards', () => {
      expect(customArtName(view('Lightning Bolt'))).toBe('Lightning Bolt')
    })

    it('returns null for face-down cards', () => {
      expect(customArtName(view('Morph', { faceDown: true }))).toBeNull()
    })

    it('resolves abilities to their source card name', () => {
      expect(customArtName(view('Ability', { mageObjectType: 'Ability', sourceCard: view('Kitchen Finks') }))).toBe('Kitchen Finks')
    })
  })
})