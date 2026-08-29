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

    expect(screen.getByText('📥 Importar y Pegar Cartas')).toBeDefined()
    expect(screen.getByText('➕ Añadir al mazo actual')).toBeDefined()
    expect(screen.getByText('🔄 Reemplazar mazo completo')).toBeDefined()

    const textarea = screen.getByPlaceholderText(/Pega aquí la lista de cartas/i)
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

    const replaceBtn = screen.getByText('🔄 Reemplazar mazo completo')
    fireEvent.click(replaceBtn)

    const textarea = screen.getByPlaceholderText(/Pega aquí la lista de cartas/i)
    fireEvent.change(textarea, {
      target: {
        value: `4 [M10:146] Lightning Bolt\n16 [LEA:292] Mountain`,
      },
    })

    const submitBtn = screen.getByRole('button', { name: /Reemplazar Mazo \(\d+ cartas\)/i })
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
