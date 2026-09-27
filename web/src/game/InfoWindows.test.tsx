// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { render, fireEvent, cleanup, act } from '@testing-library/react'
import InfoWindows from './InfoWindows'
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

  it('shows one window per entry with its cards', () => {
    setState({ game: makeGameView({ lookedAt: [looked], companion: [comp] }) as never })
    const { getByText } = render(<InfoWindows />)
    expect(document.querySelectorAll('.pile-overlay')).toHaveLength(2)
    expect(getByText('Scry Card')).not.toBeNull()
    expect(getByText('Lurrus of the Dream-Den')).not.toBeNull()
  })

  it('ignores empty entries', () => {
    setState({ game: makeGameView({ lookedAt: [{ name: 'Alice', cards: {} }], companion: [] }) as never })
    render(<InfoWindows />)
    expect(document.querySelector('.pile-overlay')).toBeNull()
  })

  it('closing hides the window until the cards change', () => {
    setState({ game: makeGameView({ lookedAt: [looked], companion: [] }) as never })
    render(<InfoWindows />)
    expect(document.querySelectorAll('.pile-overlay')).toHaveLength(1)
    fireEvent.click(document.querySelector('.pile-overlay-close')!)
    expect(document.querySelector('.pile-overlay')).toBeNull()
  })

  it('keeps the looked-at card open when the follow-up prompt view has lookedAt cleared (Jace +2)', () => {
    render(<InfoWindows />)
    act(() => setState({ game: makeGameView({ lookedAt: [jace] }) as never }))
    act(() => setState({ game: makeGameView({ lookedAt: [] }) as never }))
    expect(document.querySelectorAll('.pile-overlay')).toHaveLength(1)
    expect(document.body.textContent).toContain('Island')
    fireEvent.click(document.querySelector('.pile-overlay-close')!)
    expect(document.querySelector('.pile-overlay')).toBeNull()
  })

  it('shows revealed cards in their own window', () => {
    render(<InfoWindows />)
    act(() => setState({ game: makeGameView({ revealed: [reveal] }) as never }))
    act(() => setState({ game: makeGameView({ revealed: [] }) as never }))
    expect(document.body.textContent).toContain('Lightning Bolt')
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
})
