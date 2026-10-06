import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, renderHook } from '@testing-library/react'
import {
  attentionReason, attentionSnapshot, clearAttention, notificationsSupported, raiseAttention,
  requestNotificationPermission, useAttentionAlerts, type AttentionSnapshot,
} from './attentionAlerts'
import { loadNotificationAsked } from '../state/persistence'
import type { GameView } from '../net/types'
import { makeGameView, makePlayer } from '../__fixtures__/gameViews'
import type { FeedbackPrompt } from './feedback'

const snap = (partial: Partial<AttentionSnapshot>): AttentionSnapshot => ({ gameId: 'g', turn: 1, myTurn: false, promptSig: null, ...partial })

describe('attentionAlerts', () => {
  afterEach(() => clearAttention())

  it('flags the start of my turn once', () => {
    expect(attentionReason(snap({ turn: 2 }), snap({ turn: 3, myTurn: true }))).toBe('turn')
    expect(attentionReason(snap({ turn: 3, myTurn: true }), snap({ turn: 3, myTurn: true }))).toBeNull()
    expect(attentionReason(snap({ turn: 3, myTurn: true }), snap({ turn: 4, myTurn: true }))).toBe('turn')
  })

  it('flags a new prompt, even during the opponent turn', () => {
    expect(attentionReason(snap({}), snap({ promptSig: 'a' }))).toBe('response')
    expect(attentionReason(snap({ promptSig: 'a' }), snap({ promptSig: 'a' }))).toBeNull()
    expect(attentionReason(snap({ promptSig: 'a' }), snap({ promptSig: 'b' }))).toBe('response')
    expect(attentionReason(snap({ promptSig: 'a' }), snap({ promptSig: null }))).toBeNull()
  })

  it('builds snapshots from the controlled player only', () => {
    const game = makeGameView({ turn: 4, activePlayerId: 'me', players: [makePlayer({ playerId: 'me', name: 'Me', controlled: true })] })
    const fb = { method: 'GAME_ASK', gameId: 'g', title: '', message: 'Keep?', mode: 'boolean', options: [], min: 0, max: 0 } as FeedbackPrompt
    expect(attentionSnapshot(game, 'g', null, null)).toEqual({ gameId: 'g', turn: 4, myTurn: true, promptSig: null })
    expect(attentionSnapshot(game, 'g', fb, null)?.promptSig).toContain('Keep?')
    expect(attentionSnapshot(game, 'g', null, { mode: 'block', selectable: [], special: false, chosen: [] })?.promptSig).toContain('combat|block')
    const spectator = makeGameView({ players: [makePlayer({ playerId: 'x', name: 'X' })] })
    expect(attentionSnapshot(spectator, 'g', null, null)).toBeNull()
  })

  it('counts pending alerts in the title and restores it', () => {
    document.title = 'XMage Nexus'
    raiseAttention({ label: 'Your turn', title: 'Your turn', body: '', tag: 't', notify: false })
    raiseAttention({ label: 'Response', title: 'Response', body: '', tag: 't', notify: false })
    expect(document.title).toBe('(2) Response · XMage Nexus')
    clearAttention()
    expect(document.title).toBe('XMage Nexus')
  })
})

/** Browser Notification: jsdom does not provide it. */
class FakeNotification {
  static permission: NotificationPermission = 'default'
  static requestPermission = vi.fn(async (): Promise<NotificationPermission> => 'granted')
  static created: FakeNotification[] = []
  onclick: (() => void) | null = null
  close = vi.fn()
  constructor(public title: string, public options: NotificationOptions) {
    FakeNotification.created.push(this)
  }
}

function withNotifications(permission: NotificationPermission) {
  FakeNotification.permission = permission
  FakeNotification.created = []
  FakeNotification.requestPermission.mockClear()
  vi.stubGlobal('Notification', FakeNotification)
}

const ls = new Map<string, string>()
function setHidden(hidden: boolean) {
  Object.defineProperty(document, 'hidden', { configurable: true, get: () => hidden })
}

describe('system notifications', () => {
  beforeEach(() => {
    ls.clear()
    vi.stubGlobal('localStorage', {
      getItem: (k: string) => ls.get(k) ?? null,
      setItem: (k: string, v: string) => { ls.set(k, v) },
      removeItem: (k: string) => { ls.delete(k) },
    })
  })

  afterEach(() => {
    clearAttention()
    vi.unstubAllGlobals()
  })

  it('without the Notification API it does not ask for permission', async () => {
    vi.stubGlobal('Notification', undefined)
    Reflect.deleteProperty(window, 'Notification')
    expect(notificationsSupported()).toBe(false)
    expect(await requestNotificationPermission()).toBeNull()
    expect(loadNotificationAsked()).toBe(false)
  })

  it('asks for permission once and remembers it', async () => {
    withNotifications('default')
    expect(await requestNotificationPermission()).toBe('granted')
    expect(FakeNotification.requestPermission).toHaveBeenCalledTimes(1)
    expect(loadNotificationAsked()).toBe(true)
  })

  it('does not ask again once decided', async () => {
    withNotifications('denied')
    expect(await requestNotificationPermission()).toBe('denied')
    expect(FakeNotification.requestPermission).not.toHaveBeenCalled()
  })

  it('returns the current permission when the browser rejects the request', async () => {
    withNotifications('default')
    FakeNotification.requestPermission.mockRejectedValueOnce(new Error('blocked'))
    expect(await requestNotificationPermission()).toBe('default')
  })

  it('raiseAttention notifies only with permission and replaces the previous one', () => {
    withNotifications('granted')
    raiseAttention({ label: 'a', title: 'Your turn', body: 'Turn 3', tag: 'mage-g', notify: true })
    raiseAttention({ label: 'b', title: 'Response', body: '', tag: 'mage-g', notify: true })

    expect(FakeNotification.created.map((n) => n.title)).toEqual(['Your turn', 'Response'])
    expect(FakeNotification.created[0].options).toMatchObject({ body: 'Turn 3', tag: 'mage-g' })
    expect(FakeNotification.created[0].close).toHaveBeenCalled()

    const focus = vi.spyOn(window, 'focus').mockImplementation(() => {})
    FakeNotification.created[1].onclick!()
    expect(focus).toHaveBeenCalled()
    expect(FakeNotification.created[1].close).toHaveBeenCalled()

    clearAttention()
    expect(FakeNotification.created[1].close).toHaveBeenCalledTimes(2)
  })

  it('raiseAttention without permission or with notify=false only touches the title', () => {
    withNotifications('denied')
    raiseAttention({ label: 'a', title: 'a', body: '', tag: 't', notify: true })
    withNotifications('granted')
    raiseAttention({ label: 'b', title: 'b', body: '', tag: 't', notify: false })
    expect(FakeNotification.created).toEqual([])
  })
})

describe('favicon badge', () => {
  let link: HTMLLinkElement
  const images: { onload: (() => void) | null; src: string }[] = []

  beforeEach(() => {
    link = document.createElement('link')
    link.rel = 'icon'
    link.href = 'http://localhost/favicon.png'
    document.head.appendChild(link)
    images.length = 0
    vi.stubGlobal('Image', class { onload: (() => void) | null = null; src = ''; constructor() { images.push(this) } })
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({
      drawImage: vi.fn(), beginPath: vi.fn(), arc: vi.fn(), fill: vi.fn(), stroke: vi.fn(),
    } as unknown as CanvasRenderingContext2D)
    vi.spyOn(HTMLCanvasElement.prototype, 'toDataURL').mockReturnValue('data:image/png;base64,badge')
  })

  afterEach(() => {
    clearAttention()
    link.remove()
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('paints the red dot and restores the original icon', () => {
    raiseAttention({ label: 'a', title: 'a', body: '', tag: 't', notify: false })
    raiseAttention({ label: 'b', title: 'b', body: '', tag: 't', notify: false })
    expect(images).toHaveLength(1) // only when going from 0 to 1 alert
    expect(images[0].src).toBe('http://localhost/favicon.png')

    images[0].onload!()
    expect(link.href).toBe('data:image/png;base64,badge')

    clearAttention()
    expect(link.href).toBe('http://localhost/favicon.png')
  })

  it('does not paint the badge if the icon loads after clearing', () => {
    raiseAttention({ label: 'a', title: 'a', body: '', tag: 't', notify: false })
    clearAttention()
    images[0].onload!()
    expect(link.href).toBe('http://localhost/favicon.png')
  })
})

describe('useAttentionAlerts', () => {
  const me = makePlayer({ playerId: 'me', name: 'Me', controlled: true })
  const opp = makePlayer({ playerId: 'opp', name: 'Opp' })
  const gameAt = (turn: number, active: string): GameView => makeGameView({ turn, activePlayerId: active, players: [me, opp] })

  beforeEach(() => {
    document.title = 'XMage Nexus'
    withNotifications('granted')
  })

  afterEach(() => {
    cleanup()
    setHidden(false)
    clearAttention()
    vi.unstubAllGlobals()
  })

  function mount(hidden: boolean, enabled = true) {
    setHidden(hidden)
    return renderHook(({ game }) => useAttentionAlerts(game, 'g', null, null, enabled), { initialProps: { game: gameAt(1, 'opp') } })
  }

  it('with the tab hidden it alerts when my turn starts', () => {
    const { rerender } = mount(true)
    rerender({ game: gameAt(2, 'me') })
    expect(document.title).toBe('(1) Tu turno · XMage Nexus')
    expect(FakeNotification.created.map((n) => [n.title, n.options.body, n.options.tag])).toEqual([['Tu turno', 'Turno 2: te toca', 'mage-g']])
  })

  it('with the tab visible it does not alert', () => {
    const { rerender } = mount(false)
    rerender({ game: gameAt(2, 'me') })
    expect(document.title).toBe('XMage Nexus')
    expect(FakeNotification.created).toEqual([])
  })

  it('with notifications disabled it only marks the title', () => {
    const { rerender } = mount(true, false)
    rerender({ game: gameAt(2, 'me') })
    expect(document.title).toBe('(1) Tu turno · XMage Nexus')
    expect(FakeNotification.created).toEqual([])
  })

  it('coming back to the tab clears the alert', () => {
    const { rerender } = mount(true)
    rerender({ game: gameAt(2, 'me') })
    setHidden(false)
    act(() => { document.dispatchEvent(new Event('visibilitychange')) })
    expect(document.title).toBe('XMage Nexus')
  })

  it('unmounting clears the alert', () => {
    const { rerender, unmount } = mount(true)
    rerender({ game: gameAt(2, 'me') })
    unmount()
    expect(document.title).toBe('XMage Nexus')
  })

  it('asks for permission on the first click, not on mount', () => {
    withNotifications('default')
    mount(false)
    expect(FakeNotification.requestPermission).not.toHaveBeenCalled()
    act(() => { window.dispatchEvent(new Event('pointerdown')) })
    expect(FakeNotification.requestPermission).toHaveBeenCalledTimes(1)
    act(() => { window.dispatchEvent(new Event('pointerdown')) })
    expect(FakeNotification.requestPermission).toHaveBeenCalledTimes(1)
  })
})
