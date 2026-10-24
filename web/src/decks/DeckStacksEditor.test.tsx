import { describe, expect, it, vi, afterEach } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { DeckStacksEditor } from './DeckStacksEditor'
import type { DeckV2 } from './types'
import type { CardStripMeta } from './ArenaCardStrip'
import { getState, setState } from '../state/store'
import { stackColumnWidth } from './useStackColumnWidth'

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
  setState({ settings: { ...getState().settings, deckStacksScale: 100 } })
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

  it('merges repeated lines of the same printing into one stack and one counter', () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const repeated: DeckV2 = {
      ...deck(),
      cards: [
        { cardName: 'Mountain', setCode: 'LEA', cardNumber: '292', amount: 4 },
        { cardName: 'Lightning Bolt', setCode: 'M10', cardNumber: '146', amount: 4 },
        { cardName: 'Mountain', setCode: 'LEA', cardNumber: '292', amount: 20 },
      ],
    }
    render(<DeckStacksEditor deck={repeated} onClose={vi.fn()} onEdit={vi.fn()} />)
    const mountains = document.querySelectorAll('.stacks-editor-main .arena-stack-card[data-card-key="LEA:292:Mountain"]')
    expect(mountains).toHaveLength(1)
    const mountain = mountains[0] as HTMLElement
    expect(mountain.querySelector('.arena-stack-qty')?.textContent).toBe('24x')
    fireEvent.click(mountain)
    expect(mountain.querySelector('.arena-stack-qty')?.textContent).toBe('23x')
    const duplicateKeyWarnings = errorSpy.mock.calls.filter((args) => args.map(String).join(' ').includes('same key'))
    errorSpy.mockRestore()
    expect(duplicateKeyWarnings).toEqual([])
  })

  it('DCK-1: the header has a card size slider from 50% to 200% in steps of 10, 100% by default', () => {
    renderEditor()
    const slider = screen.getByRole('slider') as HTMLInputElement
    expect(slider.closest('.stacks-editor-head')).not.toBeNull()
    expect(slider.min).toBe('50')
    expect(slider.max).toBe('200')
    expect(slider.step).toBe('10')
    expect(slider.value).toBe('100')
    expect(document.querySelector('.stacks-editor-head .arena-grid-size-value')?.textContent).toBe('100%')
    const main = screen.getByTestId('stacks-editor-main')
    expect(main.style.getPropertyValue('--stack-scale')).toBe('1')
  })

  it('DCK-1: moving the slider scales the main deck columns, leaves the sideboard alone and saves the setting', () => {
    renderEditor()
    const slider = screen.getByRole('slider')
    fireEvent.change(slider, { target: { value: '200' } })
    expect(getState().settings.deckStacksScale).toBe(200)
    expect(screen.getByTestId('stacks-editor-main').style.getPropertyValue('--stack-scale')).toBe('2')
    expect(document.querySelector('.stacks-editor-head .arena-grid-size-value')?.textContent).toBe('200%')
    const side = document.querySelector('.stacks-editor-side') as HTMLElement
    expect(side.style.getPropertyValue('--stack-scale')).toBe('')
    expect(side.closest('[style*="--stack-scale"]')).toBeNull()
    fireEvent.change(slider, { target: { value: '50' } })
    expect(getState().settings.deckStacksScale).toBe(50)
    expect(screen.getByTestId('stacks-editor-main').style.getPropertyValue('--stack-scale')).toBe('0.5')
  })

  it('DCK-1: a stored size is applied on open and clicks still edit the deck at that size', () => {
    setState({ settings: { ...getState().settings, deckStacksScale: 160 } })
    renderEditor()
    expect((screen.getByRole('slider') as HTMLInputElement).value).toBe('160')
    expect(screen.getByTestId('stacks-editor-main').style.getPropertyValue('--stack-scale')).toBe('1.6')
    const bolt = document.querySelector('.stacks-editor-main .arena-stack-card[data-card-key="M10:146:Lightning Bolt"]') as HTMLElement
    fireEvent.click(bolt)
    expect(bolt.querySelector('.arena-stack-qty')?.textContent).toBe('3x')
    fireEvent.click(bolt, { shiftKey: true })
    expect(document.querySelector('.stacks-editor-side-count')?.textContent).toBe('3')
  })

  it.each([
    [900, 12],
    [1180, 12],
    [613, 12],
  ])('DCK-1: in a %ipx main area a column at 200%% is twice its 100%% width and 100%% fills the row exactly', (available, gap) => {
    const base = stackColumnWidth(available, gap, 1)!
    const count = Math.floor((available + gap) / (base + gap))
    expect(count * base + (count - 1) * gap).toBeLessThanOrEqual(available)
    expect(available - (count * base + (count - 1) * gap)).toBeLessThan(1)
    expect(stackColumnWidth(available, gap, 2)! / base).toBeCloseTo(2, 2)
    expect(stackColumnWidth(available, gap, 0.5)! / base).toBeCloseTo(0.5, 2)
  })

  it('DCK-1: a main area narrower than one column keeps today\'s minimum column width', () => {
    expect(stackColumnWidth(150, 12, 1)).toBe(180)
    expect(stackColumnWidth(150, 12, 2)).toBe(360)
    expect(stackColumnWidth(0, 12, 1)).toBeNull()
  })

  it('Edit hands over to the classic builder', async () => {
    const { onEdit } = renderEditor()
    fireEvent.click(document.querySelector('.stacks-editor-foot .ui-btn--subtle') as HTMLElement)
    await waitFor(() => expect(onEdit).toHaveBeenCalledTimes(1))
  })
})
