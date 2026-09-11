import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { doConnect, reset } from './gateway'
import { getState } from './state'
import * as cmds from '../net/commands'

vi.mock('../net/commands', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../net/commands')>()
  return {
    ...actual,
    setGateway: vi.fn(),
    connect: vi.fn(),
    disconnect: vi.fn(),
    getRoomChatId: vi.fn(),
    updatePreferences: vi.fn(),
  }
})

class FakeWebSocket {
  static CONNECTING = 0
  static OPEN = 1
  static CLOSING = 2
  static CLOSED = 3
  static instances: FakeWebSocket[] = []

  readonly url: string
  readyState = FakeWebSocket.CONNECTING
  sent: string[] = []
  onopen: (() => void) | null = null
  onmessage: ((ev: { data: unknown }) => void) | null = null
  onclose: ((ev: { reason?: string; code?: number }) => void) | null = null
  onerror: (() => void) | null = null

  constructor(url: string) {
    this.url = url
    FakeWebSocket.instances.push(this)
  }

  send(data: string) {
    this.sent.push(data)
  }

  close() {
    this.readyState = FakeWebSocket.CLOSED
  }

  triggerOpen() {
    this.readyState = FakeWebSocket.OPEN
    this.onopen?.()
  }
}

describe('doConnect — intentos concurrentes', () => {
  beforeEach(() => {
    FakeWebSocket.instances = []
    vi.useFakeTimers()
    vi.stubGlobal('WebSocket', FakeWebSocket)
    reset()
    vi.mocked(cmds.connect).mockReset().mockResolvedValue({ ok: true } as never)
    vi.mocked(cmds.disconnect).mockReset().mockResolvedValue({ ok: true } as never)
    vi.mocked(cmds.getRoomChatId).mockReset().mockResolvedValue('room-1')
    vi.mocked(cmds.updatePreferences).mockReset().mockResolvedValue({ ok: true } as never)
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })

  it('dedupe el doble montaje de StrictMode: un solo WS y un solo login, sin error tardío', async () => {
    const first = doConnect('localhost', 8787, 'localhost', 17171, 'u', 'p')
    const second = doConnect('localhost', 8787, 'localhost', 17171, 'u', 'p')
    expect(second).toBe(first)
    expect(FakeWebSocket.instances).toHaveLength(1)

    FakeWebSocket.instances[0].triggerOpen()
    await vi.advanceTimersByTimeAsync(100)
    await first
    expect(getState().phase).toBe('lobby')
    expect(getState().error).toBeNull()
    expect(cmds.connect).toHaveBeenCalledTimes(1)

    // el timeout del intento descartado ya no puede volver al login
    await vi.advanceTimersByTimeAsync(6000)
    expect(getState().phase).toBe('lobby')
    expect(getState().error).toBeNull()
  })

  it('un intento anterior que expira no pisa el estado del intento vigente', async () => {
    const slow = doConnect('slow-host', 8787, 'localhost', 17171, 'u', 'p')
    const fast = doConnect('fast-host', 8788, 'localhost', 17171, 'u', 'p')
    expect(FakeWebSocket.instances).toHaveLength(2)

    FakeWebSocket.instances[1].triggerOpen()
    await vi.advanceTimersByTimeAsync(100)
    await fast
    expect(getState().phase).toBe('lobby')

    await vi.advanceTimersByTimeAsync(6000)
    await slow
    expect(getState().phase).toBe('lobby')
    expect(getState().error).toBeNull()
  })

  it('tras un fallo se puede reintentar (in-flight se limpia)', async () => {
    const failed = doConnect('localhost', 8787, 'localhost', 17171, 'u', 'p')
    await vi.advanceTimersByTimeAsync(6000)
    await failed
    expect(getState().phase).toBe('idle')
    expect(getState().error).toMatch(/no se pudo conectar al proxy/)

    const retry = doConnect('localhost', 8787, 'localhost', 17171, 'u', 'p')
    expect(FakeWebSocket.instances).toHaveLength(2)
    FakeWebSocket.instances[1].triggerOpen()
    await vi.advanceTimersByTimeAsync(100)
    await retry
    expect(getState().phase).toBe('lobby')
    expect(getState().error).toBeNull()
  })
})
