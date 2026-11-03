import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import type { DeckV2 } from './types'
import { t } from '../i18n'

const { downloadBlob } = vi.hoisted(() => ({ downloadBlob: vi.fn(() => true) }))
vi.mock('../utils/download', () => ({ downloadBlob }))

const { DeckExportDialog } = await import('./DeckExportDialog')

const deck: DeckV2 = {
  id: 'deck-1',
  name: 'Burn',
  format: 'Modern',
  colors: ['R'],
  cards: [{ cardName: 'Lightning Bolt', setCode: 'M10', cardNumber: '146', amount: 4 }],
  sideboard: [],
  createdAt: 0,
  updatedAt: 0,
  source: 'custom',
}

const writeText = vi.fn<(text: string) => Promise<void>>()

beforeEach(() => {
  downloadBlob.mockClear()
  writeText.mockReset()
  writeText.mockResolvedValue()
  Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true })
})

afterEach(() => {
  cleanup()
  vi.useRealTimers()
})

describe('DeckExportDialog', () => {
  it('DCK-20: the window shows the deck in the chosen format and downloads nothing on its own', () => {
    render(<DeckExportDialog deck={deck} kind="arena" onClose={() => {}} />)

    expect((screen.getByTestId('deck-export-text') as HTMLTextAreaElement).value).toContain('4 Lightning Bolt (M10) 146')
    expect(downloadBlob).not.toHaveBeenCalled()
    expect(writeText).not.toHaveBeenCalled()
  })

  it('DCK-20: Copy puts the text on the clipboard and says so on the button, leaving the page in place', async () => {
    vi.useFakeTimers()
    render(
      <main data-testid="page">
        <DeckExportDialog deck={deck} kind="txt" onClose={() => {}} />
      </main>,
    )
    const copy = screen.getByTestId('deck-export-copy')
    await act(async () => { fireEvent.click(copy) })

    expect(writeText).toHaveBeenCalledWith((screen.getByTestId('deck-export-text') as HTMLTextAreaElement).value)
    expect(copy.textContent).toContain(t('common', 'copied'))
    expect(screen.getByTestId('page').contains(copy)).toBe(true)
    act(() => { vi.advanceTimersByTime(1500) })
    expect(copy.textContent).toContain(t('common', 'copy'))
    expect(downloadBlob).not.toHaveBeenCalled()
  })

  it('DCK-20: when the clipboard refuses, the text is selected for copying by hand', async () => {
    writeText.mockRejectedValue(new Error('denied'))
    render(<DeckExportDialog deck={deck} kind="txt" onClose={() => {}} />)
    const text = screen.getByTestId('deck-export-text') as HTMLTextAreaElement
    await act(async () => { fireEvent.click(screen.getByTestId('deck-export-copy')) })

    expect(document.activeElement).toBe(text)
    expect(text.selectionEnd - text.selectionStart).toBe(text.value.length)
    expect(screen.getByTestId('deck-export-copy').textContent).not.toContain(t('common', 'copied'))
  })

  it('DCK-20: Download saves the file in that format', () => {
    render(<DeckExportDialog deck={deck} kind="dck" onClose={() => {}} />)
    fireEvent.click(screen.getByTestId('deck-export-download'))

    expect(downloadBlob).toHaveBeenCalledWith(expect.any(Blob), 'Burn.dck')
    expect(writeText).not.toHaveBeenCalled()
  })
})
