import { cleanup, fireEvent, render, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import StackDeck, { STACK_DECK_MAX_TABS } from './StackDeck'
import type { CardView, PlayerView } from '../net/types'
import { makePlayer } from '../__fixtures__/gameViews'
import { getState, setState } from '../state/state'

vi.mock('../cards/cardImages', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../cards/cardImages')>()),
  awaitImageUrl: vi.fn().mockResolvedValue('https://img.test/card.jpg'),
}))

const players: PlayerView[] = [
  makePlayer({ playerId: 'p-me', name: 'Adam', controlled: true }),
  makePlayer({ playerId: 'p-mira', name: 'Mira' }),
]

function spell(id: string, name: string, controllerId: string, targets: string[] = []): [string, CardView] {
  return [id, { id, name, cardTypes: ['INSTANT'], manaValue: 1, controllerId, targets }]
}

function ability(id: string, source: string, controllerId: string, text: string): [string, CardView] {
  return [id, { id, name: source, cardTypes: [], mageObjectType: 'ABILITY', abilityType: 'Triggered', manaValue: 0, controllerId, rules: [text], targets: [] }]
}

function stackOf(...entries: Array<[string, CardView]>): Record<string, CardView> {
  return Object.fromEntries(entries)
}

function lastFocus(fn: { mock: { calls: unknown[][] } }): string[] | null {
  const ids = fn.mock.calls.at(-1)?.[0] as ReadonlySet<string> | null | undefined
  return ids ? [...ids].sort() : null
}

const BASE = { open: false, onOpenChange: () => {}, players, myPlayerId: 'p-me' }

describe('StackDeck', () => {
  beforeEach(() => vi.clearAllMocks())
  afterEach(cleanup)

  it('renders nothing for an empty stack', () => {
    const { container } = render(<StackDeck {...BASE} stack={{}} />)
    expect(container.querySelector('[data-testid="stack-deck"]')).toBeNull()
  })

  it('shows the next object to resolve as the top card, with its controller and targets', () => {
    const stack = stackOf(spell('s1', 'Counterspell', 'p-mira', ['s2']), spell('s2', 'Lightning Bolt', 'p-me', ['p-mira']))
    const { getByTestId, container } = render(<StackDeck {...BASE} stack={stack} />)
    expect(getByTestId('stack-count').textContent).toBe('2')
    const top = getByTestId('stack-deck-top')
    expect(top.textContent).toContain('Mira')
    expect(getByTestId('stack-deck').getAttribute('data-state')).toBe('collapsed')
    expect(container.querySelectorAll('.stack-deck-tab')).toHaveLength(1)
    expect(container.querySelector('.stack-deck-tab')?.textContent).toContain('Lightning Bolt')
    expect(container.querySelector('.stack-deck-tab')?.textContent).toContain('2')
  })

  it('draws an ability on top with the same card frame as a spell, with its rules', () => {
    setState({ settings: { ...getState().settings, cardRender: 'rendered' } })
    const stack = stackOf(ability('a1', 'Rhystic Study', 'p-mira', 'Whenever an opponent casts a spell, you may draw a card.'))
    const { container } = render(<StackDeck {...BASE} stack={stack} />)
    expect(container.querySelector('.stack-deck-face .rc')).not.toBeNull()
    expect(container.querySelector('.stack-deck-face')?.textContent).toContain('Rhystic Study')
    expect(container.querySelector('.stack-deck-face')?.textContent).toContain('you may draw a card')
  })

  it('shows the original art on top, not the rendered frame, when render is off', async () => {
    setState({ settings: { ...getState().settings, cardRender: 'image' } })
    const stack = stackOf(spell('s1', 'Lightning Bolt', 'p-mira'))
    const { container } = render(<StackDeck {...BASE} stack={stack} />)
    expect(container.querySelector('.stack-deck-face .rc')).toBeNull()
    await waitFor(() => expect(container.querySelector('.stack-deck-face img.stack-deck-art')?.getAttribute('src')).toBe('https://img.test/card.jpg'))
  })

  it('a compact tab names the controller and the kind, Habilidad or Hechizo, with the source name', () => {
    const stack = stackOf(
      spell('s1', 'Counterspell', 'p-mira'),
      ability('a1', 'Rhystic Study', 'p-me', 'Whenever an opponent casts a spell, you may draw a card.'),
    )
    const { container } = render(<StackDeck {...BASE} stack={stack} />)
    const tabs = container.querySelectorAll('.stack-deck-tab')
    expect(tabs).toHaveLength(1)
    expect(tabs[0].textContent).toContain('Disparada')
    expect(tabs[0].textContent).toContain('Rhystic Study')
    expect(tabs[0].textContent).toContain('Tú')
  })

  it('a creature spell tab says Criatura, not Hechizo', () => {
    const creature: CardView = { id: 's3', name: 'Grizzly Bears', cardTypes: ['CREATURE'], manaValue: 2, controllerId: 'p-mira', targets: [] }
    const { container } = render(<StackDeck {...BASE} stack={stackOf(spell('s4', 'Counterspell', 'p-me'), ['s3', creature])} />)
    const grizzly = [...container.querySelectorAll('.stack-deck-tab')].find((el) => el.textContent?.includes('Grizzly Bears'))
    expect(grizzly?.textContent).toContain('Criatura')
  })

  it('shows the type and the rules of the top entry in image mode', () => {
    setState({ settings: { ...getState().settings, cardRender: 'image' } })
    const stack = stackOf(ability('a1', 'Rhystic Study', 'p-mira', 'Whenever an opponent casts a spell, you may draw a card.'))
    const { getByTestId } = render(<StackDeck {...BASE} stack={stack} />)
    const caption = getByTestId('stack-deck-caption')
    expect(caption.textContent).toContain('Disparada')
    expect(caption.textContent).toContain('you may draw a card')
  })

  it('hides the type and rules over the top card when the caption setting is off', () => {
    setState({ settings: { ...getState().settings, cardRender: 'image', stackCaption: false } })
    const stack = stackOf(ability('a1', 'Rhystic Study', 'p-mira', 'Whenever an opponent casts a spell, you may draw a card.'))
    const { queryByTestId } = render(<StackDeck {...BASE} stack={stack} />)
    expect(queryByTestId('stack-deck-caption')).toBeNull()
    setState({ settings: { ...getState().settings, stackCaption: true } })
  })

  it('a compact spell tab names its caster and its card type', () => {
    const stack = stackOf(spell('s1', 'Counterspell', 'p-me'), spell('s2', 'Lightning Bolt', 'p-mira'))
    const { container } = render(<StackDeck {...BASE} stack={stack} />)
    const tab = container.querySelector('.stack-deck-tab')
    expect(tab?.textContent).toContain('Instantáneo')
    expect(tab?.textContent).toContain('Lightning Bolt')
    expect(tab?.textContent).toContain('Mira')
  })

  it('groups identical adjacent abilities into one tab with a count', () => {
    const same = 'Whenever a creature dies, target player loses 1 life.'
    const stack = stackOf(
      spell('s1', 'Pact of Negation', 'p-me'),
      ability('a1', 'Blood Artist', 'p-me', same),
      ability('a2', 'Blood Artist', 'p-me', same),
      ability('a3', 'Blood Artist', 'p-me', same),
    )
    const { container } = render(<StackDeck {...BASE} stack={stack} />)
    const tabs = container.querySelectorAll('.stack-deck-tab')
    expect(tabs).toHaveLength(1)
    expect(tabs[0].textContent).toContain('×3')
  })

  it('caps the tabs and offers the rest through the expanded view', () => {
    const entries = Array.from({ length: STACK_DECK_MAX_TABS + 4 }, (_, i) => spell(`s${i}`, `Spell ${i}`, 'p-mira'))
    const onOpenChange = vi.fn()
    const { container, getByTestId } = render(<StackDeck {...BASE} onOpenChange={onOpenChange} stack={stackOf(...entries)} />)
    expect(container.querySelectorAll('.stack-deck-tab')).toHaveLength(STACK_DECK_MAX_TABS)
    const more = getByTestId('stack-deck-more')
    expect(more.textContent).toContain('+3')
    fireEvent.click(more)
    expect(onOpenChange).toHaveBeenCalledWith(true)
  })

  it('toggles the expanded view, a timeline with one row per stack object', () => {
    const stack = stackOf(spell('s1', 'Counterspell', 'p-mira'), spell('s2', 'Lightning Bolt', 'p-me'))
    const onOpenChange = vi.fn()
    const { getByTestId, rerender, container } = render(<StackDeck {...BASE} onOpenChange={onOpenChange} stack={stack} />)
    fireEvent.click(getByTestId('stack-deck-toggle'))
    expect(onOpenChange).toHaveBeenLastCalledWith(true)
    rerender(<StackDeck {...BASE} open onOpenChange={onOpenChange} stack={stack} />)
    expect(getByTestId('stack-deck').getAttribute('data-state')).toBe('open')
    expect(container.querySelectorAll('.stack-trow')).toHaveLength(2)
    expect(container.querySelector('.stack-trow')?.textContent).toContain('Counterspell')
    expect(container.querySelector('[data-testid="stack-deck-top"]')).toBeNull()
    fireEvent.click(getByTestId('stack-deck-toggle'))
    expect(onOpenChange).toHaveBeenLastCalledWith(false)
  })

  it('clicking a tab opens the stack, or picks it as a target when it is targetable', () => {
    const stack = stackOf(spell('s1', 'Counterspell', 'p-mira'), spell('s2', 'Lightning Bolt', 'p-me'))
    const onOpenChange = vi.fn()
    const onCardClick = vi.fn()
    const { container, rerender } = render(<StackDeck {...BASE} onOpenChange={onOpenChange} onCardClick={onCardClick} stack={stack} />)
    fireEvent.click(container.querySelector('.stack-deck-tab') as Element)
    expect(onOpenChange).toHaveBeenCalledWith(true)
    expect(onCardClick).not.toHaveBeenCalled()
    rerender(<StackDeck {...BASE} onOpenChange={onOpenChange} onCardClick={onCardClick} targetIds={new Set(['s2'])} stack={stack} />)
    fireEvent.click(container.querySelector('.stack-deck-tab') as Element)
    expect(onCardClick).toHaveBeenCalledWith('s2')
  })

  it('reports the top object and the hovered tab as the focus of the target arrows', () => {
    const stack = stackOf(spell('s1', 'Counterspell', 'p-mira'), spell('s2', 'Lightning Bolt', 'p-me'), spell('s3', 'Shock', 'p-me'))
    const onFocusIds = vi.fn()
    const { container, unmount } = render(<StackDeck {...BASE} onFocusIds={onFocusIds} stack={stack} />)
    expect(lastFocus(onFocusIds)).toEqual(['s1'])
    fireEvent.mouseEnter(container.querySelectorAll('.stack-deck-tab')[1])
    expect(lastFocus(onFocusIds)).toEqual(['s1', 's3'])
    fireEvent.mouseLeave(container.querySelectorAll('.stack-deck-tab')[1])
    expect(lastFocus(onFocusIds)).toEqual(['s1'])
    unmount()
    expect(lastFocus(onFocusIds)).toBeNull()
  })
})
