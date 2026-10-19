import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import FormatGallery, { type GalleryFamily, type GalleryItem } from './FormatGallery'

const families: GalleryFamily[] = [
  { id: 'constructed', label: 'Constructed', icon: 'shield' },
  { id: 'variant', label: 'Variants', icon: 'crown' },
]
const brand = { icon: 'shield' as const, tone: 'brand' as const, art: null, group: 'constructed' as const }
const items: GalleryItem[] = [
  { value: 'Constructed - Modern', label: 'Constructed - Modern', family: 'constructed', visual: brand },
  { value: 'Constructed - Pioneer', label: 'Constructed - Pioneer', family: 'constructed', visual: brand },
  {
    value: 'commander',
    label: 'Commander',
    family: 'variant',
    visual: { icon: 'crown', tone: 'gold', art: null, group: 'commander' },
    modes: [
      { value: 'Commander Two Player Duel', label: '1 vs 1', meta: '2–2' },
      { value: 'Commander Free For All', label: 'Multiplayer', meta: '3–10' },
    ],
  },
]

function renderGallery(selected = 'Constructed - Modern') {
  const onSelect = vi.fn()
  const onClose = vi.fn()
  render(
    <FormatGallery title="Choose" items={items} families={families} selected={selected} onSelect={onSelect} onClose={onClose} />,
  )
  return { onSelect, onClose }
}

function tile(name: string): HTMLElement {
  return document.querySelector<HTMLElement>(`.fg-body [data-value="${name}"]`)!
}

describe('FormatGallery', () => {
  afterEach(() => {
    cleanup()
  })

  it('groups the options under their family, with a count per filter', () => {
    renderGallery()
    expect(screen.getByRole('group', { name: 'Constructed' })).toBeDefined()
    expect(screen.getByRole('group', { name: 'Variants' })).toBeDefined()
    expect(screen.getByRole('button', { name: /Constructed · 2/ })).toBeDefined()
  })

  it('filters by search text and by family', () => {
    renderGallery()
    fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'pion' } })
    expect(screen.getAllByRole('button', { name: /Constructed - Pioneer/ })).toHaveLength(1)
    expect(screen.queryByText('Constructed - Modern')).toBeNull()

    fireEvent.change(screen.getByRole('searchbox'), { target: { value: '' } })
    fireEvent.click(screen.getByRole('button', { name: /Variants · 1/ }))
    expect(screen.queryByText('Constructed - Modern')).toBeNull()
    expect(screen.getByText('Commander')).toBeDefined()
  })

  it('shows an empty message when nothing matches', () => {
    renderGallery()
    fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'zzz' } })
    expect(screen.getByText(/ninguna|No option|matches the search/i)).toBeDefined()
  })

  it('a single click only describes the format in the footer; double-click chooses it', () => {
    const { onSelect } = renderGallery()
    fireEvent.click(tile('Constructed - Pioneer'))
    expect(onSelect).not.toHaveBeenCalled()
    expect(document.querySelector('.fg-info-title')?.textContent).toBe('Constructed - Pioneer')

    fireEvent.doubleClick(tile('Constructed - Pioneer'))
    expect(onSelect).toHaveBeenLastCalledWith('Constructed - Pioneer')
  })

  it('a right-click describes the format without choosing it', () => {
    const { onSelect } = renderGallery()
    fireEvent.contextMenu(tile('Constructed - Pioneer'))
    expect(onSelect).not.toHaveBeenCalled()
    expect(document.querySelector('.fg-info-title')?.textContent).toBe('Constructed - Pioneer')
  })

  it('Enter describes the format, and the Choose button picks what is pending', () => {
    const { onSelect } = renderGallery()
    fireEvent.keyDown(tile('Constructed - Pioneer'), { key: 'Enter' })
    expect(onSelect).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: /Choose|Elegir/ }))
    expect(onSelect).toHaveBeenLastCalledWith('Constructed - Pioneer')
  })

  it('a grouped card picks one of its modes by click, and double-click chooses that mode', () => {
    const { onSelect } = renderGallery()
    fireEvent.click(screen.getByRole('button', { name: /Multiplayer/ }))
    expect(onSelect).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: /Choose|Elegir/ }))
    expect(onSelect).toHaveBeenLastCalledWith('Commander Free For All')

    fireEvent.doubleClick(screen.getByRole('button', { name: /1 vs 1/ }))
    expect(onSelect).toHaveBeenLastCalledWith('Commander Two Player Duel')
  })
})
