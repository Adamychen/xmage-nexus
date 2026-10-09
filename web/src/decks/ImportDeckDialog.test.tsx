import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest'
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react'

const scryfallJson = vi.hoisted(() => vi.fn())
vi.mock('../cards/scryfallClient', () => ({ scryfallJson }))

import { ImportDeckDialog } from './ImportDeckDialog'
import type { DeckV2 } from './types'

const ARENA = `Deck
4 Lightning Bolt
2 Shock
20 Mountain

Sideboard
2 Smash to Smithereens`

function card(name: string, set: string, num: string) {
  return { object: 'card', name, set, collector_number: num, cmc: 1, type_line: 'Instant', legalities: { standard: 'legal' } }
}

describe('ImportDeckDialog wizard', () => {
  beforeEach(() => {
    scryfallJson.mockReset()
    scryfallJson.mockImplementation(async (url: string) => {
      if (url.includes('Lightning%20Bolt')) return card('Lightning Bolt', 'clu', '141')
      if (url.includes('Shock')) return card('Shock', 'm21', '159')
      return null
    })
  })
  afterEach(() => cleanup())

  const paste = (text: string) =>
    fireEvent.change(document.querySelector('textarea')!, { target: { value: text } })

  it('walks source -> setup -> review and creates a deck with resolved printings', async () => {
    const onImport = vi.fn<(d: DeckV2) => void>()
    const onClose = vi.fn()
    render(<ImportDeckDialog onImport={onImport} onClose={onClose} />)

    paste(ARENA)
    fireEvent.click(screen.getByTestId('import-next-btn'))

    await screen.findByTestId('import-step-setup')
    expect((screen.getByTestId('import-format-select') as HTMLSelectElement).value).toBe('Freeform')
    fireEvent.change(screen.getByTestId('import-format-select'), { target: { value: 'Modern' } })

    fireEvent.click(screen.getByTestId('import-resolve-btn'))
    await screen.findByTestId('import-step-review')
    expect(screen.getByTestId('import-unresolved').textContent).toContain('Smash to Smithereens')

    fireEvent.click(screen.getByTestId('import-create-btn'))
    await waitFor(() => expect(onImport).toHaveBeenCalledTimes(1))
    const deck = onImport.mock.calls[0][0]
    expect(deck.format).toBe('Modern')
    expect(deck.cards.find((c) => c.cardName === 'Lightning Bolt')).toMatchObject({ setCode: 'CLU', cardNumber: '141', amount: 4 })
    expect(deck.cards.find((c) => c.cardName === 'Shock')).toMatchObject({ setCode: 'M21' })
    expect(onClose).toHaveBeenCalled()
  })

  it('lets the user drop cards that could not be found', async () => {
    const onImport = vi.fn<(d: DeckV2) => void>()
    render(<ImportDeckDialog onImport={onImport} onClose={vi.fn()} />)
    paste(ARENA)
    fireEvent.click(screen.getByTestId('import-next-btn'))
    await screen.findByTestId('import-step-setup')
    fireEvent.click(screen.getByTestId('import-resolve-btn'))
    const block = await screen.findByTestId('import-unresolved')
    fireEvent.click(block.querySelector('button')!)
    expect(screen.queryByTestId('import-unresolved')).toBeNull()
    fireEvent.click(screen.getByTestId('import-create-btn'))
    await waitFor(() => expect(onImport).toHaveBeenCalled())
    const all = [...onImport.mock.calls[0][0].cards, ...onImport.mock.calls[0][0].sideboard]
    expect(all.some((c) => c.cardName === 'Smash to Smithereens')).toBe(false)
  })

  it('keeps the quick import path that skips setup', async () => {
    const onImport = vi.fn<(d: DeckV2) => void>()
    render(<ImportDeckDialog onImport={onImport} onClose={vi.fn()} />)
    paste(ARENA)
    fireEvent.click(screen.getByTestId('import-submit-btn'))
    await waitFor(() => expect(onImport).toHaveBeenCalledTimes(1))
    expect(scryfallJson).not.toHaveBeenCalled()
  })

  it('prefills text from a dropped file and goes back from setup', async () => {
    render(<ImportDeckDialog initialText={ARENA} initialName="Burn" onImport={vi.fn()} onClose={vi.fn()} />)
    fireEvent.click(screen.getByTestId('import-next-btn'))
    await screen.findByTestId('import-step-setup')
    expect(screen.getByDisplayValue('Burn').tagName).toBe('INPUT')
    fireEvent.click(screen.getByText(/Atrás|Back/))
    expect(screen.getByTestId('import-next-btn')).toBeDefined()
  })

  // Issue #12: "it wasn't immediately clear what export format to use… Selecting
  // the deck file worked much better". The file picker was a tertiary label
  // next to the textarea; it is now the step's primary action.
  it('offers the file picker as the primary source action', () => {
    render(<ImportDeckDialog onImport={vi.fn()} onClose={vi.fn()} />)
    const fileBtn = screen.getByTestId('import-file-btn')
    expect(fileBtn.className).toContain('ui-btn--primary')
    expect(fileBtn.querySelector('input[type="file"]')).not.toBeNull()
  })

  // A hidden <input type="file"> is not focusable and neither is the label, so
  // once the file picker became the primary action there was no keyboard route
  // to it at all.
  it('exposes the file picker to keyboard users', () => {
    render(<ImportDeckDialog onImport={vi.fn()} onClose={vi.fn()} />)
    const fileBtn = screen.getByTestId('import-file-btn')
    expect(fileBtn.getAttribute('role')).toBe('button')
    expect(fileBtn.getAttribute('tabindex')).toBe('0')
    const input = fileBtn.querySelector('input[type="file"]') as HTMLInputElement
    expect(input.className).toContain('visually-hidden')
  })

  it('keeps the file picker above the paste alternative', () => {
    render(<ImportDeckDialog onImport={vi.fn()} onClose={vi.fn()} />)
    const nodes = [...document.querySelectorAll('[data-testid]')]
    const order = (id: string) => nodes.findIndex((n) => n.getAttribute('data-testid') === id)
    expect(order('import-file-btn')).toBeGreaterThanOrEqual(0)
    expect(order('import-file-btn')).toBeLessThan(order('import-paste-btn'))
  })

  it('marks the detected format inside the format select itself', async () => {
    render(<ImportDeckDialog onImport={vi.fn()} onClose={vi.fn()} />)
    paste(ARENA)
    fireEvent.click(screen.getByTestId('import-next-btn'))
    await screen.findByTestId('import-step-setup')
    const select = screen.getByTestId('import-format-select') as HTMLSelectElement
    const detected = select.value
    const option = [...select.options].find((o) => o.value === detected)
    expect(option?.textContent).toContain('✓')
  })
})
