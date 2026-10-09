import { describe, expect, it, vi, afterEach } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import DeckBuilder from './DeckBuilder'

const fallbackMocks = vi.hoisted(() => ({ available: [] as unknown[], missing: [] as string[] }))

const mocks = vi.hoisted(() => {
  const deck = {
    id: 'd1',
    name: 'Mazo Original',
    format: 'Freeform' as const,
    cards: [] as unknown[],
    sideboard: [] as unknown[],
    coverCard: null,
    commanderCard: null,
    partnerCard: null,
    updatedAt: 0,
  }
  return { deck, put: vi.fn(async (_d: unknown) => {}) }
})

vi.mock('./storage', () => ({
  getDeckStorage: () => ({
    get: async (id: string) => (fallbackMocks.missing.includes(id) ? null : { ...mocks.deck }),
    put: mocks.put,
    list: async () => fallbackMocks.available,
  }),
}))

vi.mock('../lobby/decks', async (importOriginal) => {
  const mod = await importOriginal<typeof import('../lobby/decks')>()
  return { ...mod, getAllAvailableDecks: () => fallbackMocks.available }
})

describe('DeckBuilder · guardado al cerrar (auditoría UX)', () => {
  afterEach(() => {
    cleanup()
    mocks.put.mockClear()
  })

  it('persiste la edición pendiente al pulsar Guardar (antes el debounce se descartaba)', async () => {
    const onClose = vi.fn()
    render(<DeckBuilder deckId="d1" onClose={onClose} />)
    const input = await screen.findByDisplayValue('Mazo Original')

    fireEvent.change(input, { target: { value: 'Mazo Renombrado' } })
    fireEvent.click(document.querySelector('[data-testid="builder-done"]')!)

    await waitFor(() => expect(mocks.put).toHaveBeenCalledOnce())
    expect(mocks.put.mock.calls[0][0]).toMatchObject({ id: 'd1', name: 'Mazo Renombrado' })
    expect(onClose).toHaveBeenCalledOnce()
  })

  it('también persiste al volver con ← Mis Mazos', async () => {
    const onClose = vi.fn()
    render(<DeckBuilder deckId="d1" onClose={onClose} />)
    const input = await screen.findByDisplayValue('Mazo Original')

    fireEvent.change(input, { target: { value: 'Otro Nombre' } })
    fireEvent.click(document.querySelector('.builder-back')!)

    await waitFor(() => expect(mocks.put).toHaveBeenCalledOnce())
    expect(mocks.put.mock.calls[0][0]).toMatchObject({ name: 'Otro Nombre' })
    expect(onClose).toHaveBeenCalledOnce()
  })
})

describe('DeckBuilder · resolver mazos que no están en el almacenamiento', () => {
  afterEach(() => {
    cleanup()
    fallbackMocks.available = []
    fallbackMocks.missing = []
  })

  const builder = (deckId: string) => render(<DeckBuilder deckId={deckId} onClose={vi.fn()} />)

  // The builder only looked at `storage.get(id)`, so a bundled deck
  // (`precon:<name>`) or a starter deck — saved without an id — landed on
  // "deck not found". Issue #12, item 9.
  it('carga un mazo guardado sin id cuando se le pasa su nombre', async () => {
    fallbackMocks.available = [{ id: undefined, name: 'Mazo Inicial', format: 'Modern', cards: [], sideboard: [] }]
    fallbackMocks.missing = ['Mazo Inicial']
    builder('Mazo Inicial')
    await waitFor(() => expect(screen.queryByText(/no se encontr|not found/i)).toBeNull())
    await screen.findByDisplayValue('Mazo Inicial')
  })

  it('carga un mazo del catálogo por su ref', async () => {
    fallbackMocks.available = [{ id: 'precon:Mage Web bolt', name: 'Mage Web bolt', format: 'Modern', cards: [], sideboard: [] }]
    fallbackMocks.missing = ['precon:Mage Web bolt']
    builder('precon:Mage Web bolt')
    await waitFor(() => expect(screen.queryByText(/no se encontr|not found/i)).toBeNull())
    await screen.findByDisplayValue('Mage Web bolt')
  })
})
