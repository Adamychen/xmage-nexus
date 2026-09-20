import { describe, expect, it, vi, afterEach } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import DeckBuilder from './DeckBuilder'

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
    get: async () => ({ ...mocks.deck }),
    put: mocks.put,
    list: async () => [],
  }),
}))

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
