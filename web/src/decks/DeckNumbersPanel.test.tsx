import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { DeckNumbersPanel, computeDeckNumbers, type DeckNumbersPanelProps } from './DeckNumbersPanel'
import type { DeckCard } from '../lobby/decks'
import type { CardStripMeta } from './ArenaCardStrip'
import { t } from '../i18n'

vi.mock('../ui/confirmDialog', () => ({ confirmDialog: vi.fn(async () => true) }))

const bears: DeckCard = { cardName: 'Grizzly Bears', setCode: 'M10', cardNumber: '1', amount: 2 }
const bolt: DeckCard = { cardName: 'Lightning Bolt', setCode: 'M10', cardNumber: '146', amount: 4 }
const sphinx: DeckCard = { cardName: 'Sphinx', setCode: 'M10', cardNumber: '2', amount: 1 }
const hybrid: DeckCard = { cardName: 'Hybrid Thing', setCode: 'M10', cardNumber: '3', amount: 2 }
const mountain: DeckCard = { cardName: 'Mountain', setCode: 'M10', cardNumber: '4', amount: 10 }
const unloaded: DeckCard = { cardName: 'Unloaded Card', setCode: 'M10', cardNumber: '5', amount: 3 }

const metas = new Map<string, CardStripMeta>([
  ['Grizzly Bears', { cmc: 2, manaCost: '{1}{G}', typeLine: 'Creature — Bear' }],
  ['Lightning Bolt', { cmc: 1, manaCost: '{R}', typeLine: 'Instant' }],
  ['Sphinx', { cmc: 7, manaCost: '{5}{U}{U}', typeLine: 'Creature — Sphinx' }],
  ['Hybrid Thing', { cmc: 2, manaCost: '{R/W}', typeLine: 'Instant' }],
  ['Mountain', { cmc: 0, manaCost: '', typeLine: 'Basic Land — Mountain' }],
])

const metaOf = (card: DeckCard) => metas.get(card.cardName)

function panelProps(cards: DeckCard[], overrides: Partial<DeckNumbersPanelProps> = {}): DeckNumbersPanelProps {
  const fn = () => {}
  return {
    cards,
    metaOf,
    format: 'Freeform',
    metaMap: new Map(),
    onAddLand: fn,
    onRemoveLand: fn,
    onApplySuggestedLands: fn,
    onOpenInspector: fn,
    ...overrides,
  }
}

const deck = [bears, bolt, sphinx, hybrid, mountain, unloaded]

function tileValues(container: HTMLElement): string[] {
  return [...container.querySelectorAll('.numbers-tile strong')].map((el) => el.textContent ?? '')
}

function legendPercentages(container: HTMLElement): string[] {
  return [...container.querySelectorAll('.numbers-legend-pct')].map((el) => el.textContent ?? '')
}

describe('DeckNumbersPanel', () => {
  afterEach(() => {
    cleanup()
  })

  it('DCK-10: the curve counts loaded non-land copies in buckets 0 to 5 and 6+', () => {
    render(<DeckNumbersPanel {...panelProps(deck)} />)
    expect(screen.getByTitle('0: 0')).toBeTruthy()
    expect(screen.getByTitle('1: 4')).toBeTruthy()
    expect(screen.getByTitle('2: 4')).toBeTruthy()
    expect(screen.getByTitle('5: 0')).toBeTruthy()
    expect(screen.getByTitle('6+: 1')).toBeTruthy()
    expect(screen.queryByTitle('7: 1')).toBeNull()
  })

  it('DCK-10: bar heights are proportional to the largest bucket', () => {
    const { container } = render(<DeckNumbersPanel {...panelProps(deck)} />)
    const fill = (title: string) => (screen.getByTitle(title).querySelector('.numbers-bar-fill') as HTMLElement).style.height
    expect(fill('1: 4')).toBe('100%')
    expect(fill('2: 4')).toBe('100%')
    expect(fill('6+: 1')).toBe('25%')
    expect(fill('0: 0')).toBe('0%')
    expect(container.querySelectorAll('.numbers-bar-col')).toHaveLength(7)
  })

  it('DCK-10: the average mana value covers the loaded non-land copies, two decimals', () => {
    const { container } = render(<DeckNumbersPanel {...panelProps(deck)} />)
    expect(container.querySelector('.numbers-avg strong')?.textContent).toBe('2.11')
  })

  it('DCK-10: the creature, other and land tiles count loaded copies', () => {
    const { container } = render(<DeckNumbersPanel {...panelProps(deck)} />)
    expect(tileValues(container)).toEqual(['3', '6', '10'])
    expect(screen.getByText(t('decks', 'stats_creatures'))).toBeTruthy()
    expect(screen.getByText(t('decks', 'stats_other'))).toBeTruthy()
    expect(screen.getByText(t('decks', 'stats_lands'))).toBeTruthy()
  })

  it('DCK-10: the colour share counts each mana symbol, ignores generic mana and gives hybrid symbols half to each colour', () => {
    const { container } = render(<DeckNumbersPanel {...panelProps(deck)} />)
    expect(legendPercentages(container)).toEqual(['10%', '20%', '0%', '50%', '20%'])
  })

  it('DCK-10: a hybrid symbol alone splits evenly between its two colours', () => {
    const { container } = render(<DeckNumbersPanel {...panelProps([hybrid])} />)
    expect(legendPercentages(container)).toEqual(['50%', '0%', '0%', '50%', '0%'])
  })

  it('DCK-11: a card still loading is left out of the numbers and counted on its own line', () => {
    const { container } = render(<DeckNumbersPanel {...panelProps(deck)} />)
    expect(screen.getByText(t('decks', 'stats_loading', { n: 3 }))).toBeTruthy()
    expect(container.querySelector('.numbers-avg strong')?.textContent).toBe('2.11')
    expect(tileValues(container)).toEqual(['3', '6', '10'])
  })

  it('DCK-11: no loading line when every card is loaded', () => {
    const { container } = render(<DeckNumbersPanel {...panelProps([bears, bolt, mountain])} />)
    expect(container.querySelector('.numbers-loading')).toBeNull()
  })

  it('DCK-11: a card whose meta has only its name is counted as loading, not in the numbers', () => {
    const nameOnly = (card: DeckCard) => (card === unloaded ? { name: card.cardName } : metaOf(card))
    const { container } = render(<DeckNumbersPanel {...panelProps([bolt, unloaded], { metaOf: nameOnly })} />)
    expect(screen.getByText(t('decks', 'stats_loading', { n: 3 }))).toBeTruthy()
    expect(container.querySelector('.numbers-avg strong')?.textContent).toBe('1.00')
    expect(computeDeckNumbers([bolt, unloaded], nameOnly).other).toBe(computeDeckNumbers([bolt], metaOf).other)
  })

  it('DCK-10: the full stats button opens the deck inspector', () => {
    const onOpenInspector = vi.fn()
    render(<DeckNumbersPanel {...panelProps(deck, { onOpenInspector })} />)
    fireEvent.click(screen.getByRole('button', { name: t('decks', 'stats_full') }))
    expect(onOpenInspector).toHaveBeenCalledTimes(1)
  })

  it('DCK-10: the basic land adder is part of the numbers', () => {
    const { container } = render(<DeckNumbersPanel {...panelProps(deck)} />)
    expect(container.querySelector('.basic-land-adder')).not.toBeNull()
  })
})
