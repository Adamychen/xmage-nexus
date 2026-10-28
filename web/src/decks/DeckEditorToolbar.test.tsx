import { describe, expect, it, vi, afterEach } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { DeckEditorToolbar, type DeckEditorToolbarProps } from './DeckEditorToolbar'
import type { DeckStacksGroup } from '../state/persistence'
import { t } from '../i18n'

function props(overrides: Partial<DeckEditorToolbarProps> = {}): DeckEditorToolbarProps {
  return {
    drawerOpen: true,
    onToggleDrawer: vi.fn(),
    view: 'piles',
    onViewChange: vi.fn(),
    group: 'type',
    onGroupChange: vi.fn(),
    copies: 'separate',
    onCopiesChange: vi.fn(),
    sort: 'cmc',
    onSortChange: vi.fn(),
    separateCreatures: false,
    onSeparateCreaturesChange: vi.fn(),
    scale: 100,
    onScaleChange: vi.fn(),
    ...overrides,
  }
}

function option(control: string, value: string): HTMLElement {
  const el = document.querySelector<HTMLElement>(`[data-control="${control}"] [data-value="${value}"]`)
  if (!el) throw new Error(`no ${control} option ${value}`)
  return el
}

describe('DeckEditorToolbar', () => {
  afterEach(() => {
    cleanup()
  })

  it('DCK-5: switching to List calls back and hides Group, Copies, Sort and the card size in List view', () => {
    const onViewChange = vi.fn()
    const { container, rerender } = render(<DeckEditorToolbar {...props({ onViewChange })} />)
    expect(container.querySelector('[data-control="group"]')).not.toBeNull()
    expect(container.querySelector('[data-control="copies"]')).not.toBeNull()
    expect(container.querySelector('[data-control="sort"]')).not.toBeNull()
    expect(screen.getByRole('slider')).toBeTruthy()

    fireEvent.click(option('view', 'list'))
    expect(onViewChange).toHaveBeenCalledWith('list')

    rerender(<DeckEditorToolbar {...props({ view: 'list' })} />)
    expect(option('view', 'list').getAttribute('aria-pressed')).toBe('true')
    expect(container.querySelector('[data-control="group"]')).toBeNull()
    expect(container.querySelector('[data-control="copies"]')).toBeNull()
    expect(container.querySelector('[data-control="sort"]')).toBeNull()
    expect(screen.queryByRole('slider')).toBeNull()
  })

  it('DCK-5: the toolbar is the stable hook for the editor controls', () => {
    const { container } = render(<DeckEditorToolbar {...props()} />)
    expect(container.querySelector('.deck-editor-toolbar')).not.toBeNull()
    expect(container.querySelectorAll('[data-control="view"] [data-value]')).toHaveLength(2)
  })

  it('DCK-12: the Add cards toggle shows whether the drawer is open and calls back', () => {
    const onToggleDrawer = vi.fn()
    const { rerender } = render(<DeckEditorToolbar {...props({ onToggleDrawer })} />)
    const toggle = screen.getByRole('button', { name: t('decks', 'editor_add_cards') })
    expect(toggle.getAttribute('aria-pressed')).toBe('true')

    fireEvent.click(toggle)
    expect(onToggleDrawer).toHaveBeenCalledTimes(1)

    rerender(<DeckEditorToolbar {...props({ drawerOpen: false, onToggleDrawer })} />)
    expect(screen.getByRole('button', { name: t('decks', 'editor_add_cards') }).getAttribute('aria-pressed')).toBe('false')
  })

  it('DCK-6: Group offers the five groupings as a labelled group and calls back with the chosen one', () => {
    const onGroupChange = vi.fn()
    render(<DeckEditorToolbar {...props({ onGroupChange })} />)
    const group = screen.getByRole('group', { name: t('decks', 'editor_group') })
    expect(group.getAttribute('data-control')).toBe('group')
    expect(option('group', 'type').getAttribute('aria-pressed')).toBe('true')
    expect(option('group', 'cmc').getAttribute('aria-pressed')).toBe('false')

    fireEvent.click(option('group', 'color'))
    expect(onGroupChange).toHaveBeenCalledWith('color')
    fireEvent.click(option('group', 'free'))
    expect(onGroupChange).toHaveBeenCalledWith('free')
    const values = Array.from(document.querySelectorAll('[data-control="group"] [data-value]'), (el) => el.getAttribute('data-value'))
    expect(values).toEqual(expect.arrayContaining(['type', 'cmc', 'color', 'rarity', 'free']))
  })

  it('DCK-15: Group offers colour identity and EDH power after rarity and before free, and calls back with them', () => {
    const onGroupChange = vi.fn()
    render(<DeckEditorToolbar {...props({ onGroupChange })} />)
    const values = Array.from(document.querySelectorAll('[data-control="group"] [data-value]'), (el) => el.getAttribute('data-value'))
    expect(values).toEqual(['type', 'cmc', 'color', 'rarity', 'identity', 'edh', 'free'])
    fireEvent.click(option('group', 'identity'))
    expect(onGroupChange).toHaveBeenCalledWith('identity')
    fireEvent.click(option('group', 'edh'))
    expect(onGroupChange).toHaveBeenCalledWith('edh')
    expect(option('group', 'edh').textContent).toBe(t('decks', 'group_edh'))
    expect(option('group', 'identity').textContent).toBe(t('decks', 'group_identity'))
  })

  it('DCK-6: Sort picks mana value or name order and calls back', () => {
    const onSortChange = vi.fn()
    render(<DeckEditorToolbar {...props({ onSortChange })} />)
    expect(option('sort', 'cmc').getAttribute('aria-pressed')).toBe('true')
    fireEvent.click(option('sort', 'name'))
    expect(onSortChange).toHaveBeenCalledWith('name')
  })

  it('DCK-8: Copies picks separate or together and calls back', () => {
    const onCopiesChange = vi.fn()
    render(<DeckEditorToolbar {...props({ onCopiesChange })} />)
    expect(option('copies', 'separate').getAttribute('aria-pressed')).toBe('true')
    fireEvent.click(option('copies', 'together'))
    expect(onCopiesChange).toHaveBeenCalledWith('together')
  })

  it('DCK-1: the card size slider runs from 50% to 200% in steps of 10 and calls back with the value', () => {
    const onScaleChange = vi.fn()
    render(<DeckEditorToolbar {...props({ onScaleChange })} />)
    const slider = screen.getByRole('slider', { name: t('decks', 'grid_size') }) as HTMLInputElement
    expect(slider.min).toBe('50')
    expect(slider.max).toBe('200')
    expect(slider.step).toBe('10')
    expect(slider.getAttribute('aria-valuetext')).toBe('100%')

    fireEvent.change(slider, { target: { value: '150' } })
    expect(onScaleChange).toHaveBeenCalledWith(150)
  })

  it.each<DeckStacksGroup>(['cmc', 'color', 'rarity', 'identity', 'edh'])('DCK-16: the separate creatures toggle is shown for the %s grouping', (group) => {
    render(<DeckEditorToolbar {...props({ group })} />)
    expect(document.querySelector('[data-control="separate-creatures"]')).not.toBeNull()
    expect(screen.getByRole('button', { name: t('decks', 'toggle_separate_creatures') })).toBeTruthy()
  })

  it.each<DeckStacksGroup>(['type', 'free'])('DCK-16: the separate creatures toggle is hidden for the %s grouping', (group) => {
    render(<DeckEditorToolbar {...props({ group })} />)
    expect(document.querySelector('[data-control="separate-creatures"]')).toBeNull()
  })

  it('DCK-16: the separate creatures toggle is hidden in List view', () => {
    render(<DeckEditorToolbar {...props({ group: 'cmc', view: 'list' })} />)
    expect(document.querySelector('[data-control="separate-creatures"]')).toBeNull()
  })

  it('DCK-16: the separate creatures toggle shows its state and calls back with the opposite', () => {
    const onSeparateCreaturesChange = vi.fn()
    const { rerender } = render(<DeckEditorToolbar {...props({ group: 'cmc', onSeparateCreaturesChange })} />)
    const toggle = screen.getByRole('button', { name: t('decks', 'toggle_separate_creatures') })
    expect(toggle.getAttribute('aria-pressed')).toBe('false')

    fireEvent.click(toggle)
    expect(onSeparateCreaturesChange).toHaveBeenCalledWith(true)

    rerender(<DeckEditorToolbar {...props({ group: 'cmc', separateCreatures: true, onSeparateCreaturesChange })} />)
    expect(screen.getByRole('button', { name: t('decks', 'toggle_separate_creatures') }).getAttribute('aria-pressed')).toBe('true')
    fireEvent.click(screen.getByRole('button', { name: t('decks', 'toggle_separate_creatures') }))
    expect(onSeparateCreaturesChange).toHaveBeenLastCalledWith(false)
  })
})
