import { describe, expect, it, vi, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react'
import { DeckImportModal } from './DeckImportModal'
import { captureUnhandledRejections, settle } from '../utils/unhandledRejections'

const DECK_TEXT = 'Deck\n4 Lightning Bolt\n20 Mountain'

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

  it('DCK-2: picking a deck file imports it and clears the picker so the same file can be picked again', async () => {
    const rejections = captureUnhandledRejections()
    render(<DeckImportModal deckName="Burn" onImport={vi.fn()} onClose={vi.fn()} />)
    const picker = document.querySelector<HTMLInputElement>('input[type="file"]')!
    const file = Object.assign(new File([DECK_TEXT], 'burn.dck', { type: 'text/plain' }), { text: async () => DECK_TEXT })
    fireEvent.change(picker, { target: { files: [file] } })
    await waitFor(() => expect(document.querySelector('textarea')!.value).toContain('Lightning Bolt'))
    await waitFor(() => expect(picker.value).toBe(''))
    await settle()
    expect(rejections).toEqual([])
  })

  it('supports toggling between add and replace mode', () => {    const onImport = vi.fn()
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

  it('pastes deck text from the clipboard (U7-5)', async () => {
    const onImport = vi.fn()
    const onClose = vi.fn()
    const readText = vi.fn().mockResolvedValue('4 Lightning Bolt\nSB: 2 Pyroblast')
    Object.defineProperty(navigator, 'clipboard', { value: { readText }, configurable: true })

    render(
      <DeckImportModal
        deckName="Burn"
        onImport={onImport}
        onClose={onClose}
      />
    )

    fireEvent.click(screen.getByText(/portapapeles|clipboard/i))
    await screen.findByText(/Reconocidas:|Recognized:/)
    const textarea = screen.getByPlaceholderText(/Importar mazo|Import deck/i) as HTMLTextAreaElement
    expect(textarea.value).toContain('Lightning Bolt')
  })
})
