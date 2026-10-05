import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

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

const { setCustomCardArtDataUrl, resetCustomCardArtCache } = await import('../cards/customCardArt')
const { default: CustomCardArtManager } = await import('./CustomCardArtManager')

describe('CustomCardArtManager', () => {
  beforeEach(() => {
    idb.clear()
    resetCustomCardArtCache()
  })

  afterEach(() => {
    cleanup()
    vi.restoreAllMocks()
  })

  it('shows the empty state when nothing was uploaded', async () => {
    render(<CustomCardArtManager />)
    await waitFor(() => {
      expect(screen.getByText('Aún no hay imágenes propias. En un mazo, pulsa el botón de paleta de una carta y sube una.')).toBeDefined()
    })
  })

  it('lists uploaded images with count and removes one', async () => {
    setCustomCardArtDataUrl('Lightning Bolt', 'data:image/jpeg;base64,BOLT')
    setCustomCardArtDataUrl('Shock', 'data:image/jpeg;base64,SHOCK')

    render(<CustomCardArtManager />)

    await waitFor(() => {
      expect(screen.getByText('2 imágenes · ~0 KB')).toBeDefined()
    })
    expect(screen.getByTitle('Lightning Bolt')).toBeDefined()
    expect(screen.getByTitle('Shock')).toBeDefined()

    fireEvent.click(screen.getByLabelText('Quitar imagen: Lightning Bolt'))

    await waitFor(() => {
      expect(screen.getByText('1 imágenes · ~0 KB')).toBeDefined()
    })
    expect(screen.queryByTitle('Lightning Bolt')).toBeNull()
    expect(screen.getByTitle('Shock')).toBeDefined()
  })

  it('reacts to images added while the manager is open', async () => {
    render(<CustomCardArtManager />)
    await waitFor(() => {
      expect(screen.getByText('Aún no hay imágenes propias. En un mazo, pulsa el botón de paleta de una carta y sube una.')).toBeDefined()
    })

    setCustomCardArtDataUrl('Bolt', 'data:image/jpeg;base64,NEW')
    await waitFor(() => {
      expect(screen.getByTitle('Bolt')).toBeDefined()
    })
  })
})