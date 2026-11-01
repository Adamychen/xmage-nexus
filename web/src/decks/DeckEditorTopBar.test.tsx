import { describe, expect, it, vi, afterEach } from 'vitest'
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { DeckEditorTopBar, type DeckEditorTopBarProps } from './DeckEditorTopBar'
import type { DeckV2 } from './types'
import type { ValidationIssue } from './formatRules'
import { t } from '../i18n'

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

const shortIssue: ValidationIssue = { type: 'deck_size', message: 'Main deck needs more cards', severity: 'error' }
const bannedIssue: ValidationIssue = { type: 'banned', message: 'Black Lotus is banned', severity: 'error' }

function props(overrides: Partial<DeckEditorTopBarProps> = {}): DeckEditorTopBarProps {
  return {
    name: 'Burn',
    onNameChange: vi.fn(),
    format: 'Modern',
    onFormatChange: vi.fn(),
    coverArtUrl: null,
    mainCount: 60,
    sideCount: 15,
    issues: [],
    saveState: 'idle',
    onRetrySave: vi.fn(),
    onBack: vi.fn(),
    deck,
    isEquipped: false,
    onImport: vi.fn(),
    onSample: vi.fn(),
    onEquip: vi.fn(),
    onDone: vi.fn(),
    ...overrides,
  }
}

describe('DeckEditorTopBar', () => {
  afterEach(() => {
    cleanup()
  })

  it('DCK-5: shows the name, format, counts and cover of the deck', () => {
    const { container } = render(
      <DeckEditorTopBar {...props({ coverArtUrl: 'https://img.test/cover.jpg' })} />,
    )
    expect(screen.getByRole('textbox', { name: t('decks', 'builder_deck_name_placeholder') })).toHaveProperty('value', 'Burn')
    expect(screen.getByRole('combobox', { name: t('lobby', 'filter_format_label') })).toHaveProperty('value', 'Modern')
    expect(container.querySelector('.deck-editor-counts')?.textContent).toBe(
      `60 ${t('decks', 'zone_main')} · 15 ${t('decks', 'sideboard')}`,
    )
    expect(container.querySelector('.deck-editor-cover img')?.getAttribute('src')).toBe('https://img.test/cover.jpg')
  })

  it('DCK-5: a legal deck says it is legal in its format', () => {
    render(<DeckEditorTopBar {...props()} />)
    expect(screen.getByText(t('decks', 'legal_in', { format: 'Modern' }))).toBeTruthy()
  })

  it('DCK-5: a deck below the minimum says how many cards it lacks', () => {
    render(<DeckEditorTopBar {...props({ mainCount: 45, issues: [shortIssue] })} />)
    expect(screen.getByRole('button', { name: t('decks', 'cards_short', { n: 15 }) })).toBeTruthy()
  })

  it('DCK-5: an illegal deck with a full main deck shows its first error', () => {
    render(<DeckEditorTopBar {...props({ issues: [bannedIssue] })} />)
    expect(screen.getByRole('button', { name: 'Black Lotus is banned' })).toBeTruthy()
  })

  it('DCK-5: the legality chip toggles the issue list', () => {
    render(<DeckEditorTopBar {...props({ mainCount: 45, issues: [shortIssue, bannedIssue] })} />)
    const chip = screen.getByRole('button', { name: t('decks', 'cards_short', { n: 15 }) })
    expect(chip.getAttribute('aria-expanded')).toBe('false')
    expect(screen.queryByRole('region', { name: t('decks', 'builder_legality_issues') })).toBeNull()

    fireEvent.click(chip)
    const list = screen.getByRole('region', { name: t('decks', 'builder_legality_issues') })
    expect(within(list).getByText('Main deck needs more cards')).toBeTruthy()
    expect(within(list).getByText('Black Lotus is banned')).toBeTruthy()
    expect(chip.getAttribute('aria-expanded')).toBe('true')

    fireEvent.click(chip)
    expect(screen.queryByRole('region', { name: t('decks', 'builder_legality_issues') })).toBeNull()
  })

  it('DCK-5: a legal deck with no issues has no issue list to open', () => {
    render(<DeckEditorTopBar {...props()} />)
    expect(screen.queryByRole('button', { name: t('decks', 'legal_in', { format: 'Modern' }) })).toBeNull()
  })

  it('DCK-5: name and format changes call back with the new value', () => {
    const onNameChange = vi.fn()
    const onFormatChange = vi.fn()
    render(<DeckEditorTopBar {...props({ onNameChange, onFormatChange })} />)
    fireEvent.change(screen.getByRole('textbox', { name: t('decks', 'builder_deck_name_placeholder') }), {
      target: { value: 'Burn 2' },
    })
    expect(onNameChange).toHaveBeenCalledWith('Burn 2')
    fireEvent.change(screen.getByRole('combobox', { name: t('lobby', 'filter_format_label') }), {
      target: { value: 'Legacy' },
    })
    expect(onFormatChange).toHaveBeenCalledWith('Legacy')
  })

  it('DCK-5: the save state shows saving and saved, and a failed save is a retry button', () => {
    const { rerender } = render(<DeckEditorTopBar {...props({ saveState: 'saving' })} />)
    expect(screen.getByText(t('decks', 'builder_saving'))).toBeTruthy()

    rerender(<DeckEditorTopBar {...props({ saveState: 'saved' })} />)
    expect(screen.getByText(t('decks', 'builder_saved'))).toBeTruthy()
  })

  it('DCK-5: a failed save offers a retry that calls back', () => {
    const onRetrySave = vi.fn()
    render(<DeckEditorTopBar {...props({ saveState: 'error', onRetrySave })} />)
    fireEvent.click(screen.getByRole('button', { name: t('decks', 'save_failed_retry') }))
    expect(onRetrySave).toHaveBeenCalledTimes(1)
  })

  it('DCK-5: back, import, sample and done each call back', () => {
    const p = props()
    render(<DeckEditorTopBar {...p} />)
    fireEvent.click(screen.getByRole('button', { name: t('decks', 'my_decks') }))
    fireEvent.click(screen.getByRole('button', { name: t('decks', 'import_deck') }))
    fireEvent.click(screen.getByRole('button', { name: t('decks', 'builder_sample') }))
    fireEvent.click(screen.getByRole('button', { name: t('common', 'done') }))
    expect(p.onBack).toHaveBeenCalledTimes(1)
    expect(p.onImport).toHaveBeenCalledTimes(1)
    expect(p.onSample).toHaveBeenCalledTimes(1)
    expect(p.onDone).toHaveBeenCalledTimes(1)
  })

  it('DCK-5: equip calls back, and once equipped it shows the state and is disabled', () => {
    const onEquip = vi.fn()
    const { rerender } = render(<DeckEditorTopBar {...props({ onEquip })} />)
    fireEvent.click(screen.getByRole('button', { name: t('decks', 'builder_equip') }))
    expect(onEquip).toHaveBeenCalledTimes(1)

    rerender(<DeckEditorTopBar {...props({ onEquip, isEquipped: true })} />)
    const equipped = screen.getByRole('button', { name: `✓ ${t('decks', 'builder_equipped')}` }) as HTMLButtonElement
    expect(equipped.disabled).toBe(true)
  })

  it('DCK-5: the export menu writes the deck in the chosen format', () => {
    render(<DeckEditorTopBar {...props()} />)
    fireEvent.click(screen.getByRole('button', { name: t('decks', 'export_deck') }))
    fireEvent.click(screen.getByRole('menuitem', { name: '.dck' }))
    expect((screen.getByTestId('deck-export-text') as HTMLTextAreaElement).value).toContain('4 [M10:146] Lightning Bolt')
  })
})
