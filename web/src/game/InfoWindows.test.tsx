// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, fireEvent, cleanup, act } from '@testing-library/react'
import InfoWindows, { REVEAL_TOAST_MS } from './InfoWindows'
import ClaimedInfoCards from './feedbackModes/ClaimedInfoCards'
import { EMPTY_INFO_WINDOWS, closeInfoWindow, foldInfoWindows } from './infoWindowState'
import { setState } from '../state/store'
import { makeCard, makeGameView } from '../__fixtures__/gameViews'

const looked = { name: 'Alice', cards: { 'l-1': makeCard({ name: 'Scry Card', parentId: 'l-1' }) } }
const comp = { name: 'Bob', cards: { 'c-1': makeCard({ name: 'Lurrus of the Dream-Den', parentId: 'c-1' }) } }
const jace = { name: 'Jace, the Mind Sculptor', cards: { 'top-1': makeCard({ name: 'Island', parentId: 'top-1' }) } }
const reveal = { name: 'Dark Confidant [a1b]', cards: { 'r-1': makeCard({ name: 'Lightning Bolt', parentId: 'r-1' }) } }

describe('InfoWindows', () => {
  beforeEach(() => {
    setState({ game: null })
  })
  afterEach(() => {
    setState({ game: null })
    cleanup()
  })

  it('renders nothing (and does not loop) without a game', () => {
    setState({ game: null })
    render(<InfoWindows />)
    expect(document.querySelector('.pile-overlay')).toBeNull()
  })

  it('renders nothing without lookedAt, revealed or companion', () => {
    setState({ game: makeGameView({}) as never })
    render(<InfoWindows />)
    expect(document.querySelector('.pile-overlay')).toBeNull()
  })

  it('BRD-66: shows one window per entry: a look as a corner notice, a companion as a viewer', () => {
    setState({ game: makeGameView({ lookedAt: [looked], companion: [comp] }) as never })
    render(<InfoWindows />)
    const toasts = document.querySelectorAll('[data-testid="reveal-toast"]')
    expect(toasts).toHaveLength(1)
    expect(toasts[0].querySelector('[aria-label="Scry Card"]')).not.toBeNull()
    expect(document.querySelectorAll('.pile-overlay')).toHaveLength(1)
    expect(document.querySelector('.pile-overlay')?.textContent).toContain('Lurrus of the Dream-Den')
  })

  it('ignores empty entries', () => {
    setState({ game: makeGameView({ lookedAt: [{ name: 'Alice', cards: {} }], companion: [] }) as never })
    render(<InfoWindows />)
    expect(document.querySelector('.pile-overlay')).toBeNull()
  })

  it('closing hides the window until the cards change', () => {
    setState({ game: makeGameView({ lookedAt: [looked], companion: [] }) as never })
    render(<InfoWindows />)
    expect(document.querySelectorAll('[data-testid="reveal-toast"]')).toHaveLength(1)
    fireEvent.click(document.querySelector('.reveal-toast-close')!)
    expect(document.querySelector('[data-testid="reveal-toast"]')).toBeNull()
  })

  it('keeps the looked-at card open when the follow-up prompt view has lookedAt cleared (Jace +2)', () => {
    render(<InfoWindows />)
    act(() => setState({ game: makeGameView({ lookedAt: [jace] }) as never }))
    act(() => setState({ game: makeGameView({ lookedAt: [] }) as never }))
    expect(document.querySelectorAll('[data-testid="reveal-toast"]')).toHaveLength(1)
    expect(document.querySelector('[data-testid="reveal-toast"] [aria-label="Island"]')).not.toBeNull()
    fireEvent.click(document.querySelector('.reveal-toast-close')!)
    expect(document.querySelector('[data-testid="reveal-toast"]')).toBeNull()
  })

  it('BRD-66: a reveal notice goes away on its own and does not come back for the same cards', () => {
    vi.useFakeTimers()
    try {
      render(<InfoWindows />)
      act(() => setState({ game: makeGameView({ revealed: [reveal] }) as never }))
      expect(document.querySelector('[data-testid="reveal-toast"]')).not.toBeNull()
      expect(document.querySelector('.pile-overlay'), 'no viewer over the board').toBeNull()
      act(() => { vi.advanceTimersByTime(REVEAL_TOAST_MS + 50) })
      expect(document.querySelector('[data-testid="reveal-toast"]')).toBeNull()
      act(() => setState({ game: makeGameView({ revealed: [reveal], turn: 2 }) as never }))
      expect(document.querySelector('[data-testid="reveal-toast"]')).toBeNull()
    } finally {
      vi.useRealTimers()
    }
  })

  it('BRD-66: pointing at a reveal notice keeps it up until the pointer leaves', () => {
    vi.useFakeTimers()
    try {
      render(<InfoWindows />)
      act(() => setState({ game: makeGameView({ revealed: [reveal] }) as never }))
      const toast = document.querySelector('[data-testid="reveal-toast"]')!
      fireEvent.pointerEnter(toast)
      act(() => { vi.advanceTimersByTime(REVEAL_TOAST_MS * 3) })
      expect(document.querySelector('[data-testid="reveal-toast"]')).not.toBeNull()
      fireEvent.pointerLeave(toast)
      act(() => { vi.advanceTimersByTime(REVEAL_TOAST_MS + 50) })
      expect(document.querySelector('[data-testid="reveal-toast"]')).toBeNull()
    } finally {
      vi.useRealTimers()
    }
  })

  it('BRD-66: View opens the full viewer for the revealed cards, which stays until closed', () => {
    vi.useFakeTimers()
    try {
      render(<InfoWindows />)
      act(() => setState({ game: makeGameView({ revealed: [reveal] }) as never }))
      fireEvent.click(document.querySelector('.reveal-toast-expand')!)
      expect(document.querySelector('[data-testid="reveal-toast"]')).toBeNull()
      expect(document.querySelector('.pile-overlay')?.textContent).toContain('Lightning Bolt')
      act(() => { vi.advanceTimersByTime(REVEAL_TOAST_MS * 2) })
      expect(document.querySelector('.pile-overlay')).not.toBeNull()
      fireEvent.click(document.querySelector('.pile-overlay-close')!)
      expect(document.querySelector('.pile-overlay')).toBeNull()
      expect(document.querySelector('[data-testid="reveal-toast"]')).toBeNull()
    } finally {
      vi.useRealTimers()
    }
  })

  it('BRD-66: a revealed card the player can play opens the full viewer, not a notice', () => {
    setState({ game: makeGameView({ revealed: [reveal] }) as never })
    render(<InfoWindows playableIds={new Set(['r-1'])} onPlayCard={vi.fn()} />)
    expect(document.querySelector('[data-testid="reveal-toast"]')).toBeNull()
    expect(document.querySelector('.pile-overlay')?.textContent).toContain('Lightning Bolt')
  })

  it('shows revealed cards in their own window', () => {
    render(<InfoWindows />)
    act(() => setState({ game: makeGameView({ revealed: [reveal] }) as never }))
    act(() => setState({ game: makeGameView({ revealed: [] }) as never }))
    expect(document.body.textContent).toContain('Lightning Bolt')
  })

  it('plays a playable companion card from its floating viewer', () => {
    setState({ game: makeGameView({ companion: [comp] }) as never, playableIds: ['c-1'] })
    const onPlay = vi.fn()
    render(<InfoWindows playableIds={new Set(['c-1'])} onPlayCard={onPlay} />)
    const card = document.querySelector<HTMLElement>('.pile-overlay .card-slot.playable')
    expect(card).not.toBeNull()
    fireEvent.click(card!)
    expect(onPlay).toHaveBeenCalledWith('c-1')
  })

  it('TGT-5: targets a targetable card from a floating viewer', () => {
    setState({ game: makeGameView({ revealed: [reveal] }) as never })
    const onTarget = vi.fn()
    render(<InfoWindows targetIds={new Set(['r-1'])} onTargetClick={onTarget} />)
    const card = document.querySelector<HTMLElement>('.pile-overlay .card-slot.targetable')
    expect(card).not.toBeNull()
    fireEvent.click(card!)
    expect(onTarget).toHaveBeenCalledWith('r-1')
  })

  it('reopens a dismissed companion viewer when its card becomes playable', () => {
    render(<InfoWindows />)
    act(() => setState({ game: makeGameView({ companion: [comp] }) as never, playableIds: [] }))
    fireEvent.click(document.querySelector('.pile-overlay-close')!)
    expect(document.querySelector('.pile-overlay')).toBeNull()

    act(() => setState({ playableIds: ['c-1'] }))
    expect(document.querySelector('.pile-overlay')).not.toBeNull()

    // Cerrado de nuevo mientras sigue pagable: se respeta (sin bucle).
    fireEvent.click(document.querySelector('.pile-overlay-close')!)
    act(() => setState({ playableIds: ['c-1'] }))
    expect(document.querySelector('.pile-overlay')).toBeNull()
  })
})

describe('InfoWindows inside a prompt dialog', () => {
  afterEach(() => {
    setState({ game: null })
    cleanup()
  })

  it('moves the looked-at card into the dialog and dismisses it once the decision is answered', async () => {
    render(<InfoWindows />)
    act(() => setState({ game: makeGameView({ lookedAt: [jace] }) as never }))
    act(() => setState({ game: makeGameView({ lookedAt: [] }) as never }))
    const dialog = render(<ClaimedInfoCards />)
    expect(document.querySelector('.pile-overlay')).toBeNull()
    expect(dialog.getByTestId('feedback-info-cards').textContent).toContain('Island')
    dialog.unmount()
    await act(() => new Promise((r) => setTimeout(r, 0)))
    expect(document.querySelector('.pile-overlay')).toBeNull()
    expect(document.querySelector('[data-testid="feedback-info-cards"]')).toBeNull()
  })

  it('keeps companion windows floating while a dialog claims the others', () => {
    render(<InfoWindows />)
    act(() => setState({ game: makeGameView({ lookedAt: [jace], companion: [comp] }) as never }))
    render(<ClaimedInfoCards />)
    const overlays = document.querySelectorAll('.pile-overlay')
    expect(overlays).toHaveLength(1)
    expect(overlays[0].textContent).toContain('Lurrus of the Dream-Den')
  })

  it('plays a playable card shown inside the decision dialog', () => {
    render(<InfoWindows />)
    act(() => setState({ game: makeGameView({ lookedAt: [jace] }) as never }))
    act(() => setState({ game: makeGameView({ lookedAt: [] }) as never }))
    const onPlay = vi.fn()
    render(<ClaimedInfoCards playableIds={new Set(['top-1'])} onPlayCard={onPlay} />)
    const card = document.querySelector<HTMLElement>('[data-testid="feedback-info-cards"] .card-slot.playable')
    expect(card).not.toBeNull()
    fireEvent.click(card!)
    expect(onPlay).toHaveBeenCalledWith('top-1')
  })
})

describe('foldInfoWindows', () => {
  it('reopens a closed window when the same cards are looked at again later', () => {
    let s = foldInfoWindows(EMPTY_INFO_WINDOWS, { lookedAt: [jace] })
    s = foldInfoWindows(s, { lookedAt: [] })
    s = closeInfoWindow(s, 'lookedAt:Jace, the Mind Sculptor')
    expect(s.open).toHaveLength(0)
    s = foldInfoWindows(s, { lookedAt: [jace] })
    expect(s.open.map((w) => w.key)).toEqual(['lookedAt:Jace, the Mind Sculptor'])
  })

  it('does not reopen a closed window while the same entry stays in the view', () => {
    let s = foldInfoWindows(EMPTY_INFO_WINDOWS, { lookedAt: [jace] })
    s = closeInfoWindow(s, 'lookedAt:Jace, the Mind Sculptor')
    s = foldInfoWindows(s, { lookedAt: [jace] })
    expect(s.open).toHaveLength(0)
  })

  it('replaces the cards of an open window when a new look under the same name arrives', () => {
    const other = { name: jace.name, cards: { 'top-2': makeCard({ name: 'Forest', parentId: 'top-2' }) } }
    let s = foldInfoWindows(EMPTY_INFO_WINDOWS, { lookedAt: [jace] })
    s = foldInfoWindows(s, { lookedAt: [other] })
    expect(s.open).toHaveLength(1)
    expect(Object.keys(s.open[0].cards)).toEqual(['top-2'])
  })

  it('never opens a viewer for the any-time top-card peek, which lives next to the library', () => {
    const peek = { name: 'Top card of your library', cards: { 'top-9': makeCard({ name: 'Mountain', parentId: 'top-9' }) } }
    let s = foldInfoWindows(EMPTY_INFO_WINDOWS, { lookedAt: [peek, jace] })
    expect(s.open.map((w) => w.key)).toEqual(['lookedAt:Jace, the Mind Sculptor'])
    s = foldInfoWindows(s, { lookedAt: [] })
    s = foldInfoWindows(s, { lookedAt: [peek] })
    expect(s.open.map((w) => w.key)).toEqual(['lookedAt:Jace, the Mind Sculptor'])
  })

  it('closes companion windows once the companion leaves the view', () => {
    let s = foldInfoWindows(EMPTY_INFO_WINDOWS, { companion: [comp] })
    expect(s.open).toHaveLength(1)
    s = foldInfoWindows(s, { companion: [] })
    expect(s.open).toHaveLength(0)
  })

  it('keeps a dismissed companion closed while its cards do not change', () => {
    let s = foldInfoWindows(EMPTY_INFO_WINDOWS, { companion: [comp] })
    s = closeInfoWindow(s, 'companion:Bob')
    s = foldInfoWindows(s, { companion: [comp] })
    expect(s.open).toHaveLength(0)
  })

  it('reopens a dismissed companion when one of its cards becomes playable', () => {
    let s = foldInfoWindows(EMPTY_INFO_WINDOWS, { companion: [comp] })
    s = closeInfoWindow(s, 'companion:Bob')
    s = foldInfoWindows(s, { companion: [comp] }, new Set(['c-1']))
    expect(s.open.map((w) => w.key)).toEqual(['companion:Bob'])
    expect(s.dismissed['companion:Bob']).toBeUndefined()
  })

  it('does not reopen a dismissed companion for an unrelated playable transition', () => {
    let s = foldInfoWindows(EMPTY_INFO_WINDOWS, { companion: [comp] })
    s = closeInfoWindow(s, 'companion:Bob')
    s = foldInfoWindows(s, { companion: [comp] }, new Set(['some-land']))
    expect(s.open).toHaveLength(0)
  })
})
