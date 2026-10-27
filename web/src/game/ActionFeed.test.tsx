import { act, cleanup, fireEvent, render } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import ActionFeed from './ActionFeed'
import ActionFeedCard from './ActionFeedCard'
import { handleMessage, clearFeedback } from '../state/store'
import { setState } from '../state/state'
import { getLanguage } from '../i18n'
import { formatFeedTime } from './feedTime'
import type { ActionFeedItem } from './gameEventParser'
import { DrawerHeadSlotContext } from './drawerHeadSlot'

function logEntries(...texts: string[]) {
  return texts.map((text, i) => ({ id: i + 1, time: 1_700_000_000_000 + i * 1000, text, from: 'game', channel: 'game' as const }))
}

let resizeObservers: { target: Element; notify: () => void }[] = []

class FakeResizeObserver {
  constructor(private readonly callback: ResizeObserverCallback) {}
  observe(target: Element) {
    resizeObservers.push({ target, notify: () => this.callback([], this as unknown as ResizeObserver) })
  }
  unobserve() {}
  disconnect() {}
}

function fireResize(box: Element) {
  for (const observer of resizeObservers) if (observer.target === box) observer.notify()
}

function fakeScrollBox(box: HTMLElement, client = 200) {
  let top = 0
  let height = 1000
  Object.defineProperties(box, {
    scrollTop: { get: () => top, set: (v: number) => { top = Math.min(v, Math.max(0, height - client)) }, configurable: true },
    scrollHeight: { get: () => height, configurable: true },
    clientHeight: { get: () => client, configurable: true },
  })
  fireResize(box)
  return {
    grow: (h: number) => { height = h },
    resize: (h: number) => { client = h },
    notify: () => fireResize(box),
    scrollTo: (v: number) => { top = v; fireEvent.scroll(box) },
    get top() { return top },
  }
}

describe('ActionFeed & ActionFeedCard', () => {
  beforeEach(() => {
    resizeObservers = []
    vi.stubGlobal('ResizeObserver', FakeResizeObserver)
  })

  afterEach(() => {
    cleanup()
    clearFeedback()
    setState({ log: [] })
    vi.unstubAllGlobals()
  })

  it('renders ActionFeedCard with correct badges for damage, cast, and lands', () => {
    const onHover = vi.fn()

    const damageItem: ActionFeedItem = {
      id: 'item-1',
      timestamp: Date.now(),
      type: 'damage',
      cardName: 'Lightning Bolt',
      targetName: 'Bob',
      amount: 3,
      isMe: false,
      description: 'Lightning Bolt deals 3 damage to Bob',
      rawText: 'Lightning Bolt deals 3 damage to Bob',
    }

    const { getByText, container } = render(
      <ActionFeedCard item={damageItem} onHover={onHover} />
    )

    expect(getByText('Lightning Bolt')).not.toBeNull()
    expect(container.querySelector('.action-feed-chip')?.textContent).toBe('−3')

    const rowEl = container.querySelector('.action-feed-row')!
    fireEvent.mouseEnter(rowEl)
    expect(onHover).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'Lightning Bolt' }),
      expect.any(Object)
    )
    fireEvent.mouseLeave(rowEl)
    expect(onHover).toHaveBeenCalledWith(null)
  })

  it('renders turn divider when type is turn', () => {
    const turnItem: ActionFeedItem = {
      id: 'turn-1',
      timestamp: Date.now(),
      type: 'turn',
      amount: 2,
      playerName: 'Alice',
      description: 'Turno 2 · Alice',
      rawText: 'Turn 2 (Alice)',
    }

    const { container } = render(<ActionFeedCard item={turnItem} />)
    expect(container.querySelector('.turn-badge')?.textContent).toContain('Turno 2 · Alice')
  })

  it('renders system and card-less events as compact cards with type tint (no banner)', () => {
    const waiting: ActionFeedItem = {
      id: 'sys-1',
      timestamp: Date.now(),
      type: 'phase',
      playerName: 'sim-00001-307',
      isMe: false,
      description: 'Esperando a sim-00001-307',
      rawText: 'Waiting for sim-00001-307',
    }
    const { container, getByText } = render(<ActionFeedCard item={waiting} />)
    expect(container.querySelector('.action-feed-system-banner')).toBeNull()
    const row = container.querySelector('.action-feed-row.type-phase')
    expect(row).not.toBeNull()
    expect(row?.getAttribute('data-type')).toBe('phase')
    expect(getByText('sim-00001-307')).not.toBeNull()

    cleanup()
    const start: ActionFeedItem = {
      id: 'sys-2',
      timestamp: Date.now(),
      type: 'system',
      description: 'Start Match',
      rawText: 'Start Match',
    }
    const r2 = render(<ActionFeedCard item={start} />)
    expect(r2.container.querySelector('.action-feed-row.type-system')).not.toBeNull()
    expect(r2.container.querySelector('.action-player-tag')).toBeNull()
  })
  it('toggles between Visual Feed and Raw Text Log in ActionFeed', () => {
    handleMessage({
      type: 'event',
      method: 'CHATMESSAGE',
      messageId: 10,
      data: {
        username: 'servidor',
        message: 'Alice casts Lightning Bolt [target: Bob]',
      },
    } as never)

    const { getByText } = render(<ActionFeed />)

    // Visual mode shows card pill
    expect(getByText('Lightning Bolt')).not.toBeNull()

    // Switch to Raw Log mode
    const textBtn = getByText('Texto')
    fireEvent.click(textBtn)

    expect(getByText('Alice casts Lightning Bolt [target: Bob]')).not.toBeNull()

    // Switch back to Visual
    const visualBtn = getByText('Visual')
    fireEvent.click(visualBtn)

    expect(getByText('Lightning Bolt')).not.toBeNull()
  })

  it('parses and renders token creation events without raw HTML tags or object hashes', () => {
    handleMessage({
      type: 'event',
      method: 'CHATMESSAGE',
      messageId: 11,
      data: {
        username: 'partida',
        message: "<font color='#20B2AA'>ketaklak</font> creates a <font color='#696969' object_id='08c72361-bf20-48a9-b9bf-cc03fa175a40'>Wizard Token</font> [08c] token",
      },
    } as never)

    const { container } = render(<ActionFeed />)

    expect(container.textContent).toContain('ketaklak crea una ficha Wizard Token')
    expect(container.textContent).not.toContain('<font')
    expect(container.textContent).not.toContain('object_id')
    expect(container.textContent).not.toContain('[08c]')
  })

  it('stamps every visual entry with the time it reached the log, parsed or not', () => {
    const time = 1_700_000_000_000
    act(() => setState({ log: [{ id: 9, time, text: 'Alice casts Lightning Bolt', from: 'game', channel: 'game' }, { id: 10, time: time + 1000, text: 'Start Match', from: 'game', channel: 'game' }] }))

    const { container } = render(<ActionFeed />)
    const stamps = [...container.querySelectorAll('.action-time')]
    expect(stamps.map((el) => el.getAttribute('title'))).toEqual([formatFeedTime(time, getLanguage()), formatFeedTime(time + 1000, getLanguage())])
    expect(stamps.map((el) => el.textContent)).toEqual([formatFeedTime(time, getLanguage()).slice(0, 5), formatFeedTime(time + 1000, getLanguage()).slice(0, 5)])
  })

  it('moves the view switch and the event count into the drawer head slot when there is one', () => {
    act(() => setState({ log: logEntries('Start Match') }))
    const slot = document.createElement('div')
    document.body.appendChild(slot)
    const { container, getByText } = render(
      <DrawerHeadSlotContext.Provider value={slot}>
        <ActionFeed />
      </DrawerHeadSlotContext.Provider>,
    )
    expect(slot.querySelector('.action-feed-head .action-count-tag')).not.toBeNull()
    expect(container.querySelector('.action-feed-controls')).toBeNull()
    fireEvent.click(getByText('Texto'))
    expect(container.querySelector('.action-feed-raw-list')).not.toBeNull()
    cleanup()
    slot.remove()
  })

  it('shows the same timestamp in the raw text view', () => {
    const time = 1_700_000_005_000
    act(() => setState({ log: [{ id: 1, time, text: 'Start Match', from: 'game', channel: 'game' }] }))

    const { container, getByText } = render(<ActionFeed />)
    fireEvent.click(getByText('Texto'))
    expect(container.querySelector('.game-log-time')?.textContent).toBe(formatFeedTime(time, getLanguage()))
  })

  it('keeps existing cards mounted when a new event arrives', () => {
    act(() => setState({ log: logEntries('Alice casts Lightning Bolt', 'Start Match') }))
    const { container } = render(<ActionFeed />)
    const first = container.querySelector('.action-feed-row')

    act(() => setState({ log: logEntries('Alice casts Lightning Bolt', 'Start Match', 'Bob attacks with Grizzly Bears') }))
    expect(container.querySelectorAll('.action-feed-row')).toHaveLength(3)
    expect(container.querySelector('.action-feed-row')).toBe(first)
  })

  it('keeps the newest entry in view while pinned to the bottom', () => {
    act(() => setState({ log: logEntries('one', 'two') }))
    const { container } = render(<ActionFeed />)
    const box = fakeScrollBox(container.querySelector<HTMLElement>('.action-feed-list')!)

    box.grow(1200)
    act(() => setState({ log: logEntries('one', 'two', 'three') }))
    expect(box.top).toBe(1000)

    box.grow(1400)
    act(() => setState({ log: logEntries('one', 'two', 'three', 'four') }))
    expect(box.top).toBe(1200)
  })

  it('stops following a reader who scrolled up before the scroll event reached it', () => {
    act(() => setState({ log: logEntries('one', 'two') }))
    const { container } = render(<ActionFeed />)
    const list = container.querySelector<HTMLElement>('.action-feed-list')!
    const box = fakeScrollBox(list)

    box.grow(1200)
    act(() => setState({ log: logEntries('one', 'two', 'three') }))
    expect(box.top).toBe(1000)

    list.scrollTop = 0
    box.grow(1400)
    act(() => setState({ log: logEntries('one', 'two', 'three', 'four') }))
    expect(box.top).toBe(0)
  })

  it('keeps following the bottom after the content shrinks while pinned', () => {
    act(() => setState({ log: logEntries('one', 'two', 'three') }))
    const { container } = render(<ActionFeed />)
    const list = container.querySelector<HTMLElement>('.action-feed-list')!
    const box = fakeScrollBox(list)

    box.grow(1400)
    act(() => setState({ log: logEntries('one', 'two', 'three', 'four') }))
    expect(box.top).toBe(1200)

    box.grow(500)
    list.scrollTop = box.top
    act(() => setState({ log: logEntries('five') }))

    box.grow(600)
    act(() => setState({ log: logEntries('five', 'six') }))
    expect(box.top).toBe(400)
  })

  it('re-follows the bottom when the feed resizes while pinned', () => {
    let onResize: (() => void) | undefined
    vi.stubGlobal('ResizeObserver', class {
      constructor(cb: () => void) { onResize = cb }
      observe() {}
      disconnect() {}
    })
    act(() => setState({ log: logEntries('one', 'two') }))
    const { container } = render(<ActionFeed />)
    const box = fakeScrollBox(container.querySelector<HTMLElement>('.action-feed-list')!, 300)

    box.grow(1200)
    act(() => setState({ log: logEntries('one', 'two', 'three') }))
    expect(box.top).toBe(900)

    box.resize(200)
    onResize?.()
    expect(box.top).toBe(1000)
  })

  it('keeps following when the echo of its own scroll arrives after more lines', () => {
    act(() => setState({ log: logEntries('one', 'two') }))
    const { container } = render(<ActionFeed />)
    const list = container.querySelector<HTMLElement>('.action-feed-list')!
    const box = fakeScrollBox(list)

    box.grow(1200)
    act(() => setState({ log: logEntries('one', 'two', 'three') }))
    box.grow(1400)
    act(() => setState({ log: logEntries('one', 'two', 'three', 'four') }))
    box.grow(1700)
    fireEvent.scroll(list)

    act(() => setState({ log: logEntries('one', 'two', 'three', 'four', 'five') }))
    expect(box.top).toBe(1500)
  })

  it('stops following when the reader scrolls up, and resumes at the bottom', () => {
    act(() => setState({ log: logEntries('one', 'two') }))
    const { container } = render(<ActionFeed />)
    const box = fakeScrollBox(container.querySelector<HTMLElement>('.action-feed-list')!)

    box.grow(1200)
    act(() => setState({ log: logEntries('one', 'two', 'three') }))
    box.scrollTo(300)
    box.grow(1400)
    act(() => setState({ log: logEntries('one', 'two', 'three', 'four') }))
    expect(box.top).toBe(300)

    box.scrollTo(1200)
    box.grow(1600)
    act(() => setState({ log: logEntries('one', 'two', 'three', 'four') }))
    expect(box.top).toBe(1400)
  })

  it('a user scroll to the top right after mount unpins the feed', () => {
    act(() => setState({ log: logEntries('one', 'two') }))
    const { container } = render(<ActionFeed />)
    const box = fakeScrollBox(container.querySelector<HTMLElement>('.action-feed-list')!)

    box.scrollTo(0)
    box.resize(240)
    box.notify()
    act(() => setState({ log: logEntries('one', 'two', 'three') }))
    expect(box.top).toBe(0)
  })
})
