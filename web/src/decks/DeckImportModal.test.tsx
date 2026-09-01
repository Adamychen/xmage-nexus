import { describe, expect, it, vi, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import { DeckImportModal } from './DeckImportModal'

describe('DeckImportModal', () => {
  afterEach(() => {
    cleanup()
  })

  it('renders correctly and parses pasted text live', () => {
    const onImport = vi.fn()
    const onClose = vi.fn()

    render(
      <DeckImportModal
        deckName="Burn"
        onImport={onImport}
        onClose={onClose}
      />
    )

    expect(screen.getByText(/Importar Mazo/)).toBeDefined()
    expect(screen.getAllByText(/Añadir al mazo actual/).length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText(/Reemplazar mazo completo/).length).toBeGreaterThanOrEqual(1)

    const textarea = screen.getByPlaceholderText(/Importar mazo|Import deck/i)
    fireEvent.change(textarea, {
      target: {
        value: `4 Lightning Bolt\n20 Mountain\nSB: 2 Red Elemental Blast`,
      },
    })

    expect(screen.getByText(/Reconocidas:/)).toBeDefined()
    expect(screen.getByText(/24/)).toBeDefined() // 4 + 20
  })

  it('supports toggling between add and replace mode', () => {
    const onImport = vi.fn()
    const onClose = vi.fn()

    render(
      <DeckImportModal
        deckName="Burn"
        onImport={onImport}
        onClose={onClose}
      />
    )

    const replaceBtn = screen.getByText(/Reemplazar mazo completo/)
    fireEvent.click(replaceBtn)

    const textarea = screen.getByPlaceholderText(/Importar mazo|Import deck/i)
    fireEvent.change(textarea, {
      target: {
        value: `4 [M10:146] Lightning Bolt\n16 [LEA:292] Mountain`,
      },
    })

    const submitBtn = screen.getByRole('button', { name: /Reemplazar mazo completo \(\d+ Total Cartas\)/i })
    fireEvent.click(submitBtn)

    expect(onImport).toHaveBeenCalledWith({
      cards: expect.arrayContaining([
        expect.objectContaining({ cardName: 'Lightning Bolt', amount: 4 }),
        expect.objectContaining({ cardName: 'Mountain', amount: 16 }),
      ]),
      sideboard: [],
      mode: 'replace',
    })
    expect(onClose).toHaveBeenCalled()
  })
})
