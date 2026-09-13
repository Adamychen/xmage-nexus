import { cleanup, render } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import FloatingChat from './FloatingChat'

const props = {
  users: [],
  chatPrefill: '',
  onPrefillUsed: () => {},
  unreadChat: 0,
  onMessageRead: () => {},
  onSelectUser: () => {},
  onOpenRoomLeaderboard: () => {},
  open: true,
  onOpenChange: () => {},
}

function stubLocalStorage() {
  const store = new Map<string, string>()
  vi.stubGlobal('localStorage', {
    getItem: (k: string) => (store.has(k) ? store.get(k)! : null),
    setItem: (k: string, v: string) => void store.set(k, String(v)),
    removeItem: (k: string) => void store.delete(k),
    clear: () => store.clear(),
  })
  return store
}

beforeEach(() => {
  stubLocalStorage()
})

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

describe('FloatingChat drag (C.13 nit: pos stale)', () => {
  it('persiste la gota exacta del drag, no la posición anterior', () => {
    const { container } = render(<FloatingChat {...props} />)
    const header = container.querySelector('.floating-chat-header') as HTMLElement
    expect(header).not.toBeNull()
    // jsdom no tiene PointerEvent y fireEvent pierde clientX/Y: despacho manual.
    const dispatchPointer = (type: string, x: number, y: number) => {
      const ev = new Event(type, { bubbles: true, cancelable: true }) as Event & { clientX: number; clientY: number; pointerId: number }
      ev.clientX = x
      ev.clientY = y
      ev.pointerId = 1
      header.dispatchEvent(ev)
    }
    dispatchPointer('pointerdown', 200, 200)
    dispatchPointer('pointermove', 260, 290)
    dispatchPointer('pointerup', 260, 290)
    const raw = (globalThis as any).localStorage.getItem('floating_chat_pos')
    expect(raw).not.toBeNull()
    // jsdom: rect a 0, ventana 1024×768 → gota en (60, 90)
    expect(JSON.parse(raw)).toEqual({ left: 60, top: 90 })
  })
})
