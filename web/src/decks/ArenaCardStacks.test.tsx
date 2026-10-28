import { describe, expect, it, vi, afterEach, beforeEach } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import { ArenaCardStacks, type StackColumn, type StackItem } from './ArenaCardStacks'
import type { DeckCard } from '../lobby/decks'
import { setLanguage } from '../i18n'

const bolt: DeckCard = { cardName: 'Lightning Bolt', setCode: 'M10', cardNumber: '146', amount: 4 }
const mountain: DeckCard = { cardName: 'Mountain', setCode: 'LEA', cardNumber: '292', amount: 20 }
const boltKey = 'M10:146:Lightning Bolt'
const mountainKey = 'LEA:292:Mountain'

const columns: StackColumn[] = [
  {
    id: 'cmc-1',
    label: 'CMC 1',
    items: [{ key: boltKey, card: bolt, meta: { imageUrl: 'https://img.test/bolt.jpg' } }],
  },
  {
    id: 'lands',
    label: 'Lands',
    items: [{ key: mountainKey, card: mountain, issue: 'Not in the format' }],
  },
]

function renderStacks(overrides: Partial<Parameters<typeof ArenaCardStacks>[0]> = {}) {
  const props = {
    columns,
    onInc: vi.fn(),
    onDec: vi.fn(),
    onHover: vi.fn(),
    onLeave: vi.fn(),
    ...overrides,
  }
  render(<ArenaCardStacks {...props} />)
  return props
}

function dataTransfer(payload?: unknown) {
  return {
    types: ['application/json'],
    effectAllowed: 'move',
    dropEffect: 'none',
    setData: vi.fn(),
    getData: (type: string) => (type === 'application/json' && payload !== undefined ? JSON.stringify(payload) : ''),
  }
}

function cardElements(key: string): HTMLElement[] {
  return [...document.querySelectorAll<HTMLElement>(`[data-card-key="${key}"]`)]
}

function column(id: string): HTMLElement {
  return document.querySelector<HTMLElement>(`section[data-column="${id}"]`)!
}

afterEach(cleanup)

const stacked: StackColumn[] = [
  {
    id: 'main',
    label: 'Main',
    items: [
      { key: boltKey, card: bolt },
      { key: mountainKey, card: mountain },
    ],
  },
]

describe('ArenaCardStacks', () => {
  beforeEach(() => {
    setLanguage('en')
  })

  it('renders one column per group with its total copies', () => {
    renderStacks()
    const cols = document.querySelectorAll('.arena-stack-col')
    expect(cols).toHaveLength(2)
    expect(cols[0].querySelector('.arena-stack-col-count')?.textContent).toBe('4')
    expect(cols[1].querySelector('.arena-stack-col-count')?.textContent).toBe('20')
  })

  it('shows the card art when there is an image and the name otherwise', () => {
    renderStacks()
    expect(document.querySelector('img.arena-stack-img')?.getAttribute('src')).toBe('https://img.test/bolt.jpg')
    expect(document.querySelector('.arena-stack-fallback')?.textContent).toBe('Mountain')
  })

  it('shows the copy count on the front copy as ×N', () => {
    renderStacks()
    expect(screen.getByText('×4')).toBeDefined()
    expect(screen.getByText('×20')).toBeDefined()
  })

  it('flags cards with a validation issue', () => {
    renderStacks()
    expect(document.querySelector('.arena-stack-card.has-issue')?.textContent).toContain('×20')
  })

  it('DCK-8: draws every copy as its own element, with the count only on the front copy', () => {
    renderStacks({ copies: 'separate' })
    expect(cardElements(mountainKey)).toHaveLength(20)
    expect(cardElements(boltKey)).toHaveLength(4)
    const fronts = document.querySelectorAll('[data-front="true"]')
    expect(fronts).toHaveLength(2)
    expect(cardElements(mountainKey).filter((el) => el.querySelector('.arena-stack-qty'))).toHaveLength(1)
    expect(cardElements(mountainKey)[19].dataset.front).toBe('true')
  })

  it('DCK-8: draws one element per distinct card when copies are together', () => {
    renderStacks()
    expect(cardElements(mountainKey)).toHaveLength(1)
    expect(cardElements(boltKey)).toHaveLength(1)
    expect(document.querySelectorAll('[data-front="true"]')).toHaveLength(2)
  })

  it('DCK-8: a card with one copy shows no count', () => {
    renderStacks({
      columns: [{ id: 'cmc-1', label: 'CMC 1', items: [{ key: 'x', card: { ...bolt, amount: 1 } }] }],
    })
    expect(document.querySelector('.arena-stack-qty')).toBeNull()
  })

  it('DCK-8: separate copies sit a few pixels apart and the next card steps down by the title strip', () => {
    renderStacks({ copies: 'separate', columns: stacked })
    const bolts = cardElements(boltKey).map((el) => parseFloat(el.style.top))
    expect(bolts).toEqual([0, 5, 10, 15])
    expect(parseFloat(cardElements(mountainKey)[0].style.top)).toBe(15 + 34)
    expect(parseFloat(cardElements(mountainKey)[19].style.top)).toBe(49 + 19 * 5)
  })

  it('DCK-8: the copy offset and the strip grow with the scale', () => {
    renderStacks({ copies: 'separate', scale: 2, columns: stacked })
    const bolts = cardElements(boltKey).map((el) => parseFloat(el.style.top))
    expect(bolts).toEqual([0, 10, 20, 30])
    expect(parseFloat(cardElements(mountainKey)[0].style.top)).toBe(30 + 68)
  })

  it('DCK-8: the column is as tall as its stack', () => {
    renderStacks({ copies: 'separate', columns: stacked })
    const body = column('main').querySelector<HTMLElement>('.arena-stack-col-body')!
    const cardHeight = Math.round(180 * (680 / 488))
    expect(body.style.height).toBe(`${49 + 19 * 5 + cardHeight}px`)
  })

  it('DCK-9: a click on a selectable card calls onSelect with its key', () => {
    const onSelect = vi.fn()
    const onDec = vi.fn()
    renderStacks({ onSelect, onDec })
    fireEvent.click(screen.getByRole('button', { name: /Lightning Bolt/ }))
    expect(onSelect).toHaveBeenCalledWith(boltKey)
    expect(onDec).not.toHaveBeenCalled()
  })

  it('DCK-9: without onSelect a left click removes one copy and shift-click adds one', () => {
    const { onInc, onDec } = renderStacks()
    const card = screen.getByRole('button', { name: /Lightning Bolt/ })
    fireEvent.click(card)
    expect(onDec).toHaveBeenCalledWith(boltKey, undefined)
    fireEvent.click(card, { shiftKey: true })
    expect(onInc).toHaveBeenCalledWith(boltKey, undefined)
  })

  it('DCK-9: shift-click swaps one copy to the other zone when onSwap is given', () => {
    const onSwap = vi.fn()
    const onInc = vi.fn()
    renderStacks({ onSwap, onInc, onSelect: vi.fn() })
    fireEvent.click(screen.getByRole('button', { name: /Lightning Bolt/ }), { shiftKey: true })
    expect(onSwap).toHaveBeenCalledWith(boltKey, undefined)
    expect(onInc).not.toHaveBeenCalled()
  })

  it('DCK-9: right click adds one copy without opening the context menu', () => {
    const { onInc } = renderStacks()
    const card = screen.getByRole('button', { name: /Lightning Bolt/ })
    const notPrevented = fireEvent.contextMenu(card)
    expect(notPrevented).toBe(false)
    expect(onInc).toHaveBeenCalledWith(boltKey, undefined)
  })

  it('DCK-9: the selected card rings every copy of it', () => {
    renderStacks({ copies: 'separate', onSelect: vi.fn(), selectedKey: mountainKey })
    const mountains = cardElements(mountainKey)
    expect(mountains.every((el) => el.classList.contains('is-selected'))).toBe(true)
    expect(cardElements(boltKey).some((el) => el.classList.contains('is-selected'))).toBe(false)
  })

  it('DCK-9: Enter and Space select the focused card', () => {
    const onSelect = vi.fn()
    renderStacks({ onSelect })
    const card = screen.getByRole('button', { name: /Lightning Bolt/ })
    fireEvent.keyDown(card, { key: 'Enter' })
    fireEvent.keyDown(card, { key: ' ' })
    expect(onSelect.mock.calls).toEqual([[boltKey], [boltKey]])
  })

  it('DCK-9: the keys - and Delete remove one copy, + and = add one, s swaps', () => {
    const onInc = vi.fn()
    const onDec = vi.fn()
    const onSwap = vi.fn()
    renderStacks({ onInc, onDec, onSwap, onSelect: vi.fn() })
    const card = screen.getByRole('button', { name: /Lightning Bolt/ })
    fireEvent.keyDown(card, { key: '-' })
    fireEvent.keyDown(card, { key: 'Delete' })
    fireEvent.keyDown(card, { key: '+' })
    fireEvent.keyDown(card, { key: '=' })
    fireEvent.keyDown(card, { key: 's' })
    fireEvent.keyDown(card, { key: 'S' })
    expect(onDec.mock.calls).toEqual([[boltKey, undefined], [boltKey, undefined]])
    expect(onInc.mock.calls).toEqual([[boltKey, undefined], [boltKey, undefined]])
    expect(onSwap.mock.calls).toEqual([[boltKey, undefined], [boltKey, undefined]])
  })

  it('DCK-9: reports hover with the card meta and leave', () => {
    const { onHover, onLeave } = renderStacks()
    const card = screen.getByRole('button', { name: /Lightning Bolt/ })
    fireEvent.mouseEnter(card)
    expect(onHover).toHaveBeenCalledWith(bolt, columns[0].items[0].meta, expect.anything())
    fireEvent.mouseLeave(card)
    expect(onLeave).toHaveBeenCalled()
  })

  it('DCK-9: a card drags as its zone and key', () => {
    renderStacks({ zone: 'side', onInc: vi.fn() })
    const transfer = dataTransfer()
    fireEvent.dragStart(cardElements(boltKey)[0], { dataTransfer: transfer })
    expect(transfer.setData).toHaveBeenCalledWith('application/json', JSON.stringify({ source: 'sideboard', key: boltKey }))
    expect(transfer.effectAllowed).toBe('move')
  })

  it('DCK-9: a card in the main deck drags as main', () => {
    renderStacks({ onInc: vi.fn() })
    expect(cardElements(boltKey)[0].draggable).toBe(true)
    const transfer = dataTransfer()
    fireEvent.dragStart(cardElements(boltKey)[0], { dataTransfer: transfer })
    expect(transfer.setData).toHaveBeenCalledWith('application/json', JSON.stringify({ source: 'main', key: boltKey }))
  })

  it('DCK-9: dropping a card on a column calls onDropCard with the column id and the parsed payload', () => {
    const onDropCard = vi.fn()
    renderStacks({ onDropCard })
    const payload = { cardName: 'Island', setCode: 'LEA', cardNumber: '288', source: 'search' }
    fireEvent.drop(column('lands'), { dataTransfer: dataTransfer(payload) })
    expect(onDropCard).toHaveBeenCalledWith('lands', payload)
  })

  it('DCK-9: a drag over a column marks it as the drop target until the drag leaves', () => {
    renderStacks({ onDropCard: vi.fn() })
    const lands = column('lands')
    fireEvent.dragOver(lands, { dataTransfer: dataTransfer({}) })
    expect(lands.classList.contains('is-drop-target')).toBe(true)
    fireEvent.dragLeave(lands, { dataTransfer: dataTransfer({}) })
    expect(lands.classList.contains('is-drop-target')).toBe(false)
  })

  it('DCK-9: a read-only stack has no buttons and no draggable cards', () => {
    renderStacks({ onInc: undefined, onDec: undefined })
    expect(screen.queryByRole('button')).toBeNull()
    expect(document.querySelectorAll('[draggable="true"]')).toHaveLength(0)
    expect(document.querySelectorAll('[data-card-key]').length).toBeGreaterThan(0)
  })

  it('DCK-7: dropping on the trailing new pile column gives the column id __new__', () => {
    const onDropCard = vi.fn()
    renderStacks({ onDropCard, newPileColumn: { label: '+ New pile', hint: 'Drop a card here to make a pile' } })
    const drop = column('__new__')
    expect(drop.textContent).toContain('+ New pile')
    expect(drop.textContent).toContain('Drop a card here to make a pile')
    fireEvent.drop(drop, { dataTransfer: dataTransfer({ cardName: 'Island', setCode: 'LEA', cardNumber: '288', source: 'search' }) })
    expect(onDropCard).toHaveBeenCalledWith('__new__', expect.objectContaining({ cardName: 'Island' }))
  })

  const pileColumns: StackColumn[] = [
    { id: 'p1', label: 'Pile 1', kind: 'pile', items: [{ key: boltKey, card: bolt, meta: { imageUrl: 'x' } }] },
    { id: 'p2', label: 'Pile 2', kind: 'pile', items: [] },
  ]

  it('DCK-7: a pile name is edited in place and Enter commits it', () => {
    const onRenamePile = vi.fn()
    renderStacks({ columns: pileColumns, onRenamePile })
    fireEvent.click(screen.getByRole('button', { name: 'Rename pile: Pile 1' }))
    const input = screen.getByRole('textbox', { name: 'Rename pile' })
    fireEvent.change(input, { target: { value: 'Ramp' } })
    fireEvent.keyDown(input, { key: 'Enter' })
    expect(onRenamePile).toHaveBeenCalledWith('p1', 'Ramp')
  })

  it('DCK-7: Escape cancels a pile rename', () => {
    const onRenamePile = vi.fn()
    renderStacks({ columns: pileColumns, onRenamePile })
    fireEvent.click(screen.getByRole('button', { name: 'Rename pile: Pile 1' }))
    const input = screen.getByRole('textbox', { name: 'Rename pile' })
    fireEvent.change(input, { target: { value: 'Ramp' } })
    fireEvent.keyDown(input, { key: 'Escape' })
    expect(onRenamePile).not.toHaveBeenCalled()
    expect(screen.queryByRole('textbox')).toBeNull()
  })

  it('DCK-7: leaving the name field commits a pile rename', () => {
    const onRenamePile = vi.fn()
    renderStacks({ columns: pileColumns, onRenamePile })
    fireEvent.click(screen.getByRole('button', { name: 'Rename pile: Pile 1' }))
    const input = screen.getByRole('textbox', { name: 'Rename pile' })
    fireEvent.change(input, { target: { value: 'Ramp' } })
    fireEvent.blur(input)
    expect(onRenamePile).toHaveBeenCalledWith('p1', 'Ramp')
  })

  it('DCK-7: a blank pile name keeps the old one', () => {
    const onRenamePile = vi.fn()
    renderStacks({ columns: pileColumns, onRenamePile })
    fireEvent.click(screen.getByRole('button', { name: 'Rename pile: Pile 1' }))
    const input = screen.getByRole('textbox', { name: 'Rename pile' })
    fireEvent.change(input, { target: { value: '   ' } })
    fireEvent.keyDown(input, { key: 'Enter' })
    expect(onRenamePile).not.toHaveBeenCalled()
  })

  it('DCK-7: an empty pile says so and removes through its remove button', () => {
    const onRemovePile = vi.fn()
    renderStacks({ columns: pileColumns, onRenamePile: vi.fn(), onRemovePile })
    const empty = column('p2')
    expect(empty.textContent).toContain('Empty pile')
    fireEvent.click(screen.getByRole('button', { name: 'Remove pile' }))
    expect(onRemovePile).toHaveBeenCalledWith('p2')
    expect(column('p1').querySelector('button[aria-label="Remove pile"]')).toBeNull()
  })

  it('DCK-7: a pile column without rename handlers shows its label as plain text', () => {
    renderStacks({ columns: pileColumns })
    expect(screen.queryByRole('button', { name: /Rename pile/ })).toBeNull()
    expect(column('p1').querySelector('.arena-stack-col-head')?.textContent).toContain('Pile 1')
  })

  it('DCK-11: a card whose data is still loading shows a placeholder with its name and no image', () => {
    const loading: StackItem = { key: boltKey, card: bolt, loading: true }
    renderStacks({
      columns: [{ id: 'loading', label: 'Loading…', kind: 'loading', items: [loading] }],
      onInc: vi.fn(),
    })
    const loadingColumn = column('loading')
    expect(loadingColumn.dataset.kind).toBe('loading')
    expect(loadingColumn.querySelector('img')).toBeNull()
    expect(loadingColumn.querySelector('.arena-stack-fallback')?.textContent).toBe('Lightning Bolt')
    expect(cardElements(boltKey)[0].classList.contains('is-loading')).toBe(true)
  })

  it('DCK-7: a copy in a pile drags with its pile, and inc, dec and swap act on that pile', () => {
    const onInc = vi.fn()
    const onDec = vi.fn()
    const onSwap = vi.fn()
    renderStacks({ columns: pileColumns, onInc, onDec, onSwap, onSelect: vi.fn() })
    const card = screen.getByRole('button', { name: /Lightning Bolt/ })
    const transfer = dataTransfer()
    fireEvent.dragStart(cardElements(boltKey)[0], { dataTransfer: transfer })
    expect(transfer.setData).toHaveBeenCalledWith('application/json', JSON.stringify({ source: 'main', key: boltKey, pileId: 'p1' }))
    fireEvent.keyDown(card, { key: '-' })
    fireEvent.keyDown(card, { key: '+' })
    fireEvent.keyDown(card, { key: 's' })
    expect(onDec).toHaveBeenCalledWith(boltKey, 'p1')
    expect(onInc).toHaveBeenCalledWith(boltKey, 'p1')
    expect(onSwap).toHaveBeenCalledWith(boltKey, 'p1')
  })

  it('DCK-7: the unsorted column passes its own id as the pile of its copies', () => {
    const onDec = vi.fn()
    renderStacks({
      columns: [{ id: 'unsorted', label: 'Unsorted', kind: 'unsorted', items: [{ key: boltKey, card: { ...bolt, amount: 1 } }] }],
      onDec,
    })
    fireEvent.click(screen.getByRole('button', { name: /Lightning Bolt/ }))
    expect(onDec).toHaveBeenCalledWith(boltKey, 'unsorted')
  })

  it('DCK-7: a pile column is marked as a pile and a group column as a group', () => {
    renderStacks({ columns: [...pileColumns, { id: 'cmc-1', label: 'CMC 1', items: [{ key: boltKey, card: bolt }] }] })
    expect(column('p1').dataset.kind).toBe('pile')
    expect(column('cmc-1').dataset.kind).toBe('group')
  })
})
