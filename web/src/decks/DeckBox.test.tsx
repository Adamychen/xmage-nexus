import { describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { DeckBox } from './DeckBox'
import type { DeckV2 } from './types'

const artState = vi.hoisted(() => ({ url: null as string | null }))

vi.mock('./useCardArtUrl', () => ({
  useCardArtUrl: () => artState.url,
}))

const deck = (over: Partial<DeckV2> = {}): DeckV2 => ({
  id: 'c1',
  name: 'Mi Burn',
  format: 'Freeform',
  colors: ['R'],
  cards: [{ cardName: 'Lightning Bolt', setCode: 'M10', cardNumber: '146', amount: 60 }],
  sideboard: [],
  createdAt: 1,
  updatedAt: 2,
  source: 'custom',
  ...over,
}) as DeckV2

describe('DeckBox quick actions (gallery polish)', () => {
  it('expone editar / inspeccionar / duplicar / favorito sin abrir el footer', () => {
    const onEdit = vi.fn()
    const onInspect = vi.fn()
    const onClone = vi.fn()
    const onToggleFavorite = vi.fn()
    render(
      <DeckBox
        deck={deck()}
        selected={false}
        onSelect={() => {}}
        onEdit={onEdit}
        onInspect={onInspect}
        onClone={onClone}
        onToggleFavorite={onToggleFavorite}
      />,
    )
    expect(screen.getByTestId('deckbox-quick-edit')).not.toBeNull()
    expect(screen.getByTestId('deckbox-quick-inspect')).not.toBeNull()
    expect(screen.getByTestId('deckbox-quick-clone')).not.toBeNull()
    expect(screen.getByTestId('deckbox-quick-fav')).not.toBeNull()
    fireEvent.click(screen.getByTestId('deckbox-quick-edit'))
    expect(onEdit).toHaveBeenCalledTimes(1)
    fireEvent.click(screen.getByTestId('deckbox-quick-inspect'))
    expect(onInspect).toHaveBeenCalledTimes(1)
    cleanup()
  })

  it('los quick actions no propagan la selección y son operables por teclado', () => {
    const onSelect = vi.fn()
    const onEdit = vi.fn()
    render(<DeckBox deck={deck()} selected={false} onSelect={onSelect} onEdit={onEdit} onInspect={() => {}} onClone={() => {}} onToggleFavorite={() => {}} />)
    const btn = screen.getByTestId('deckbox-quick-edit')
    fireEvent.click(btn)
    expect(onSelect).not.toHaveBeenCalled()
    expect(onEdit).toHaveBeenCalledTimes(1)
    ;(btn as HTMLElement).focus()
    expect(document.activeElement).toBe(btn)
    cleanup()
  })

  it('muestra preview grande decorativo cuando hay portada', () => {
    artState.url = 'https://img.test/art.jpg'
    render(<DeckBox deck={deck()} selected={false} onSelect={() => {}} />)
    const preview = screen.getByTestId('deckbox-preview')
    expect(preview.getAttribute('aria-hidden')).toBe('true')
    expect(preview.querySelector('img')?.getAttribute('src')).toBe('https://img.test/art.jpg')
    artState.url = null
    cleanup()
  })

  it('sin portada no hay preview', () => {
    artState.url = null
    render(<DeckBox deck={deck()} selected={false} onSelect={() => {}} />)
    expect(screen.queryByTestId('deckbox-preview')).toBeNull()
    cleanup()
  })
})
