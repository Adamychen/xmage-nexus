import { act, cleanup, fireEvent, render } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import CardGrid from './CardGrid'
import LibraryOrderDialog from './LibraryOrderDialog'
import PileDialog from './PileDialog'
import MulliganDialog from './MulliganDialog'
import PileOverlay from '../board/PileOverlay'
import type { FeedbackPrompt } from './feedback'
import type { CardView } from '../net/types'
import { getState, setState } from '../state/store'

const sendPlayerUUID = vi.fn().mockResolvedValue({ ok: true })
const sendPlayerBoolean = vi.fn().mockResolvedValue({ ok: true })
const sendPlayerString = vi.fn().mockResolvedValue({ ok: true })

vi.mock('../net/commands', () => ({
  sendPlayerUUID: (...args: unknown[]) => sendPlayerUUID(...args),
  sendPlayerBoolean: (...args: unknown[]) => sendPlayerBoolean(...args),
  sendPlayerString: (...args: unknown[]) => sendPlayerString(...args),
  sendPlayerAction: vi.fn().mockResolvedValue({ ok: true }),
}))

/** jsdom has no PointerEvent: a pointer event that reports its pointer type, as a browser sends it. */
function pointer(el: Element, type: 'pointerdown' | 'pointerover' | 'pointerout', pointerType: 'mouse' | 'touch') {
  const event = new MouseEvent(type, { bubbles: true, cancelable: true })
  Object.defineProperty(event, 'pointerType', { value: pointerType })
  act(() => { el.dispatchEvent(event) })
}

const send = vi.fn((action: () => Promise<unknown>) => { void action() })

const CARDS = [
  { id: 'c-1', name: 'Grizzly Bears', expansionSetCode: 'IMA', cardNumber: '165' },
  { id: 'c-2', name: 'Lightning Bolt', expansionSetCode: 'M10', cardNumber: '147' },
]

function gridPrompt(overrides: Partial<FeedbackPrompt> = {}): FeedbackPrompt {
  return {
    method: 'GAME_TARGET',
    gameId: 'g-1',
    title: 'Search your library',
    message: 'Choose a creature card',
    mode: 'uuid',
    options: [{ id: 'c-1', label: 'Grizzly Bears', value: 'c-1' }],
    min: 1,
    max: 1,
    required: true,
    cards: CARDS,
    ...overrides,
  }
}

function renderGrid(p = gridPrompt()) {
  return render(<CardGrid prompt={p} selected={[]} setSelected={vi.fn()} send={send as never} busy={false} />)
}

const item = (container: Element, id: string) =>
  container.querySelector(`.card-grid-item:has([data-card-id="${id}"])`) as HTMLElement

beforeEach(() => {
  vi.clearAllMocks()
  setState({ inspectedCard: null })
})

afterEach(cleanup)

describe('PRM-15: card grid (scry, surveil, search, look at the top cards, pick from a list)', () => {
  it('PRM-15: pointing at a card with a mouse previews it without choosing it, and a click still chooses it', async () => {
    const { container } = renderGrid()
    const bears = item(container, 'c-1')
    pointer(bears, 'pointerover', 'mouse')
    expect(bears.classList.contains('is-previewing')).toBe(true)
    expect(document.querySelector('.floating-card-preview')).not.toBeNull()
    expect(sendPlayerUUID).not.toHaveBeenCalled()
    fireEvent.click(bears.querySelector('.card-grid-cell') as Element)
    await vi.waitFor(() => expect(sendPlayerUUID).toHaveBeenCalledWith('c-1', 'g-1'))
  })

  it('PRM-15: a tap on the card chooses it and does not open a preview', () => {
    const { container } = renderGrid()
    const bears = item(container, 'c-1')
    pointer(bears.querySelector('.card-grid-cell') as Element, 'pointerover', 'touch')
    expect(bears.classList.contains('is-previewing')).toBe(false)
  })

  it('PRM-15: the zoom button previews the card on a touch, keeps it until the next touch and never chooses it', () => {
    const { container } = renderGrid()
    const bears = item(container, 'c-1')
    const zoom = bears.querySelector('.prompt-card-zoom') as HTMLElement
    expect(zoom.getAttribute('aria-label')).toContain('Grizzly Bears')
    pointer(zoom, 'pointerdown', 'touch')
    fireEvent.click(zoom)
    pointer(bears, 'pointerout', 'touch')
    expect(bears.classList.contains('is-previewing')).toBe(true)
    expect(getState().inspectedCard).toBeNull()
    expect(sendPlayerUUID).not.toHaveBeenCalled()
    pointer(container.querySelector('.card-grid-filter') as Element, 'pointerdown', 'touch')
    expect(bears.classList.contains('is-previewing')).toBe(false)
  })

  it('PRM-15: a click, Enter or Space on the zoom button opens the card inspector without choosing the card', () => {
    const { container } = renderGrid()
    const zoom = item(container, 'c-1').querySelector('.prompt-card-zoom') as HTMLElement
    pointer(zoom, 'pointerdown', 'mouse')
    fireEvent.click(zoom)
    expect((getState().inspectedCard as { name?: string } | null)?.name).toBe('Grizzly Bears')
    setState({ inspectedCard: null })
    // A button activated from the keyboard sends a click with no pointer press before it.
    fireEvent.click(zoom)
    expect((getState().inspectedCard as { name?: string } | null)?.name).toBe('Grizzly Bears')
    expect(sendPlayerUUID).not.toHaveBeenCalled()
  })

  it('PRM-15: keyboard focus on a card previews it and moving focus away hides it', () => {
    const { container } = renderGrid()
    const bears = item(container, 'c-1')
    const cell = bears.querySelector('.card-grid-cell') as HTMLButtonElement
    act(() => { cell.focus() })
    expect(bears.classList.contains('is-previewing')).toBe(true)
    // Moving to the card's own zoom button keeps the same preview.
    act(() => { (bears.querySelector('.prompt-card-zoom') as HTMLElement).focus() })
    expect(bears.classList.contains('is-previewing')).toBe(true)
    act(() => { (container.querySelector('.card-grid-filter') as HTMLElement).focus() })
    expect(bears.classList.contains('is-previewing')).toBe(false)
  })

  it('PRM-15: a card the prompt does not accept can still be looked at', () => {
    const { container } = renderGrid()
    fireEvent.click(container.querySelector('.card-grid-scope-toggle') as Element)
    const bolt = item(container, 'c-2')
    expect((bolt.querySelector('.card-grid-cell') as HTMLButtonElement).disabled).toBe(true)
    const zoom = bolt.querySelector('.prompt-card-zoom') as HTMLButtonElement
    expect(zoom.disabled).toBe(false)
    pointer(zoom, 'pointerdown', 'touch')
    expect(bolt.classList.contains('is-previewing')).toBe(true)
  })
})

describe('PRM-15: cards that only show (library order, piles)', () => {
  it('PRM-15: scry ordering previews each card on a touch and opens the inspector with Enter, without moving it', () => {
    const p: FeedbackPrompt = {
      method: 'GAME_CHOOSE_CARDS_ORDER',
      gameId: 'g-1',
      title: 'Scry 2',
      message: 'Put the cards on top of your library in any order',
      mode: 'order',
      options: CARDS.map((c) => ({ id: c.id, label: c.name, value: c.id })),
      min: 0,
      max: 2,
      cards: CARDS,
    }
    const { container } = render(<LibraryOrderDialog prompt={p} send={send as never} cancel={vi.fn()} busy={false} />)
    const thumbs = container.querySelectorAll('.order-card-card .prompt-card-thumb')
    expect(thumbs).toHaveLength(2)
    pointer(thumbs[0], 'pointerdown', 'touch')
    expect(thumbs[0].classList.contains('is-previewing')).toBe(true)
    fireEvent.keyDown(thumbs[1], { key: 'Enter' })
    expect((getState().inspectedCard as { name?: string } | null)?.name).toBe('Lightning Bolt')
    expect(container.querySelectorAll('.top-zone .order-card-card')).toHaveLength(2)
    expect(sendPlayerString).not.toHaveBeenCalled()
  })

  it('PRM-15: each card of a pile previews on a touch without choosing the pile', () => {
    const p: FeedbackPrompt = {
      method: 'GAME_CHOOSE_PILE',
      gameId: 'g-1',
      title: 'Choose pile',
      message: 'Choose a pile',
      mode: 'boolean',
      options: [],
      min: 0,
      max: 1,
      pileCards: { pile1: [CARDS[0]], pile2: [CARDS[1]] },
    } as FeedbackPrompt
    const { container } = render(<PileDialog prompt={p} send={send as never} busy={false} />)
    const thumb = container.querySelector('[data-testid="pile-column-2"] .prompt-card-thumb') as Element
    pointer(thumb, 'pointerdown', 'touch')
    fireEvent.click(thumb)
    expect(thumb.classList.contains('is-previewing')).toBe(true)
    expect(sendPlayerBoolean).not.toHaveBeenCalled()
  })
})

describe('PRM-15: cards that are chosen or played by a click (London mulligan, revealed cards)', () => {
  it('PRM-15: the London bottom pick keeps its click and zooms from its button', () => {
    const hand: Record<string, CardView> = {
      h1: { id: 'h1', name: 'Forest', manaValue: 0, expansionSetCode: 'M21', cardNumber: '1' } as CardView,
    }
    setState({ game: { myHand: hand, players: [] } as never })
    const p: FeedbackPrompt = {
      method: 'GAME_TARGET',
      gameId: 'g-1',
      title: 'Mulligan',
      message: 'Choose a card to put on the bottom',
      mode: 'uuid',
      options: [{ id: 'h1', label: 'Forest', value: 'h1' }],
      min: 1,
      max: 1,
      isMulliganLondon: true,
    } as FeedbackPrompt
    const { container } = render(<MulliganDialog prompt={p} send={send as never} cancel={vi.fn()} busy={false} />)
    const wrap = container.querySelector('.mulligan-card-wrap') as HTMLElement
    pointer(wrap.querySelector('.prompt-card-zoom') as Element, 'pointerdown', 'touch')
    expect(wrap.classList.contains('is-previewing')).toBe(true)
    expect(sendPlayerUUID).not.toHaveBeenCalled()
    fireEvent.click(wrap.querySelector('.card-slot') as Element)
    expect(sendPlayerUUID).toHaveBeenCalledWith('h1', 'g-1')
    setState({ game: null })
  })

  it('PRM-15: revealed and looked-at cards zoom from their button; an unknown face-down card has none', () => {
    const cards: Record<string, CardView> = {
      r1: { id: 'r1', name: 'Counterspell', manaValue: 2, expansionSetCode: 'MH2', cardNumber: '267' } as CardView,
      r2: { id: 'r2', name: '', manaValue: 0, expansionSetCode: '', cardNumber: '0', faceDown: true } as CardView,
    }
    render(<PileOverlay title="Revealed" cards={cards} onClose={vi.fn()} flipIn />)
    const wrappers = document.body.querySelectorAll('.pile-card-wrapper')
    const zoom = wrappers[0].querySelector('.prompt-card-zoom') as HTMLElement
    pointer(zoom, 'pointerdown', 'touch')
    expect(wrappers[0].querySelector('.prompt-card-zoomable')?.classList.contains('is-previewing')).toBe(true)
    // The card keeps its own id, so the board and its tests still find it.
    expect(wrappers[0].querySelector('[data-card-id="r1"]')).not.toBeNull()
    expect(wrappers[1].querySelector('.prompt-card-zoom')).toBeNull()
  })
})
