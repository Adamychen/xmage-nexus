import { describe, expect, it, vi, afterEach } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { DeckStacksEditor } from './DeckStacksEditor'
import type { DeckV2 } from './types'
import type { CardStripMeta } from './ArenaCardStrip'

const { putSpy, metaMap } = vi.hoisted(() => {
  const bolt = { manaCost: '{R}', cmc: 1, typeLine: 'Instant', colors: ['R'] }
  const mountain = { manaCost: '', cmc: 0, typeLine: 'Basic Land — Mountain', colors: [] }
  const angel = { manaCost: '{3}{W}{W}', cmc: 5, typeLine: 'Creature — Angel', colors: ['W'] }
  return {
    putSpy: vi.fn(async (_deck: DeckV2) => {}),
    metaMap: new Map<string, Record<string, unknown>>([
      ['M10/146', bolt],
      ['LEA/292', mountain],
      ['M10/200', angel],
      ['lightning bolt', bolt],
      ['mountain', mountain],
      ['serra angel', angel],
    ]),
  }
})

vi.mock('./storage', () => ({ getDeckStorage: () => ({ put: putSpy, get: vi.fn(), list: vi.fn(async () => []) }) }))
vi.mock('./useDeckMetadata', () => ({
  useDeckMetadata: () => ({
    metaMap: metaMap as Map<string, CardStripMeta>,
    setMetaMap: () => {},
    updateMetaForDeck: () => {},
  }),
}))
vi.mock('./useCardArtUrl', () => ({ useCardArtUrl: () => null }))
vi.mock('./SearchPanel', () => ({ default: () => <div data-testid="search-panel" /> }))

const deck = (): DeckV2 => ({
  id: 'e1',
  name: 'Mi Burn',
  format: 'Freeform',
  colors: ['R'],
  cards: [
    { cardName: 'Lightning Bolt', setCode: 'M10', cardNumber: '146', amount: 4 },
    { cardName: 'Mountain', setCode: 'LEA', cardNumber: '292', amount: 20 },
    { cardName: 'Serra Angel', setCode: 'M10', cardNumber: '200', amount: 2 },
  ],
  sideboard: [{ cardName: 'Lightning Bolt', setCode: 'M10', cardNumber: '146', amount: 2 }],
  createdAt: 1,
  updatedAt: 2,
  source: 'custom',
}) as DeckV2

function renderEditor(overrides: { onClose?: () => void; onEdit?: () => void } = {}) {
  const onClose = overrides.onClose ?? vi.fn()
  const onEdit = overrides.onEdit ?? vi.fn()
  render(<DeckStacksEditor deck={deck()} onClose={onClose} onEdit={onEdit} />)
  return { onClose, onEdit }
}

afterEach(() => {
  cleanup()
  putSpy.mockClear()
})

describe('DeckStacksEditor', () => {
  it('groups the main deck by card type, not by mana value', () => {
    renderEditor()
    const ids = [...document.querySelectorAll('.stacks-editor-main .arena-stack-col')].map((c) => c.getAttribute('data-column'))
    expect(ids).toEqual(['creatures', 'instants', 'lands'])
  })

  it('click removes one copy and right-click adds one', () => {
    renderEditor()
    const bolt = document.querySelector('.stacks-editor-main .arena-stack-card[data-card-key="M10:146:Lightning Bolt"]') as HTMLElement
    fireEvent.click(bolt)
    expect(bolt.querySelector('.arena-stack-qty')?.textContent).toBe('3x')
    fireEvent.contextMenu(bolt)
    expect(bolt.querySelector('.arena-stack-qty')?.textContent).toBe('4x')
  })

  it('shift-click moves one copy from the main deck to the sideboard', () => {
    renderEditor()
    const bolt = document.querySelector('.stacks-editor-main .arena-stack-card[data-card-key="M10:146:Lightning Bolt"]') as HTMLElement
    fireEvent.click(bolt, { shiftKey: true })
    expect(bolt.querySelector('.arena-stack-qty')?.textContent).toBe('3x')
    expect(document.querySelector('.stacks-editor-side-count')?.textContent).toBe('3')
  })

  it('shows the sideboard as read-write stacks with the sb: key prefix', () => {
    renderEditor()
    expect(document.querySelector('.stacks-editor-side .arena-stack-card[data-card-key="sb:M10:146:Lightning Bolt"]')).not.toBeNull()
  })

  it('Done flushes the pending edit and closes', async () => {
    const { onClose } = renderEditor()
    const bolt = document.querySelector('.stacks-editor-main .arena-stack-card[data-card-key="M10:146:Lightning Bolt"]') as HTMLElement
    fireEvent.click(bolt)
    fireEvent.click(screen.getByTestId('stacks-editor-done'))
    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1))
    expect(putSpy).toHaveBeenCalledTimes(1)
    expect(putSpy.mock.calls[0][0]).toMatchObject({ id: 'e1' })
  })

  it('Edit hands over to the classic builder', async () => {
    const { onEdit } = renderEditor()
    fireEvent.click(document.querySelector('.stacks-editor-foot .ui-btn--subtle') as HTMLElement)
    await waitFor(() => expect(onEdit).toHaveBeenCalledTimes(1))
  })
})
