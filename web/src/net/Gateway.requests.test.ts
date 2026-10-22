import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { Gateway } from './Gateway'
import { clearErrors, recentErrors } from '../system/errorLog'

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

  triggerMessage(data: string) {
    this.onmessage?.({ data })
  }
}

function currentWs(g: Gateway): FakeWebSocket {
  return g.ws as unknown as FakeWebSocket
}

/** A proxy that is alive but silent on the action: inbound frames keep the heartbeat quiet. */
async function keepAlive(g: Gateway, ms: number): Promise<void> {
  for (let elapsed = 0; elapsed < ms; elapsed += 5_000) {
    await vi.advanceTimersByTimeAsync(Math.min(5_000, ms - elapsed))
    currentWs(g).triggerMessage(JSON.stringify({ type: 'info', message: 'alive' }))
  }
}

async function connectOpen(g: Gateway): Promise<void> {
  const p = g.connect('ws://proxy.test:8787')
  currentWs(g).triggerOpen()
  await vi.advanceTimersByTimeAsync(100)
  await p
}

describe('Gateway requests that never get an answer', () => {
  beforeEach(() => {
    FakeWebSocket.instances = []
    vi.useFakeTimers()
    vi.stubGlobal('WebSocket', FakeWebSocket)
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })

  it('an action the proxy never answers resolves TIMEOUT after 30 s', async () => {
    const g = new Gateway()
    await connectOpen(g)
    let res: unknown
    void g.send('getGameTypes').then((r) => {
      res = r
    })
    await keepAlive(g, 29_000)
    expect(res).toBeUndefined()
    await keepAlive(g, 1_000)
    expect(res).toMatchObject({ ok: false, errorCode: 'TIMEOUT' })
  })

  it('a long-running action such as validateDeck gets a longer window', async () => {
    const g = new Gateway()
    await connectOpen(g)
    let res: unknown
    void g.send('validateDeck', { deck: {} }).then((r) => {
      res = r
    })
    await keepAlive(g, 31_000)
    expect(res).toBeUndefined()
    await keepAlive(g, 90_000)
    expect(res).toMatchObject({ ok: false, errorCode: 'TIMEOUT' })
  })

  it('a login is not timed out at 30 s, because the proxy may take longer than that to log in', async () => {
    const g = new Gateway()
    await connectOpen(g)
    let res: unknown
    void g.send('connect', { host: 'h', port: 17171, username: 'u', password: 'p' }).then((r) => {
      res = r
    })
    await keepAlive(g, 31_000)
    expect(res).toBeUndefined()
    await keepAlive(g, 90_000)
    expect(res).toMatchObject({ ok: false, errorCode: 'TIMEOUT' })
  })

  it('an answer that arrives in time is not replaced by a timeout', async () => {
    const g = new Gateway()
    await connectOpen(g)
    const p = g.send('getGameTypes')
    currentWs(g).triggerMessage(JSON.stringify({ type: 'result', action: 'getGameTypes', requestId: '0', ok: true, data: ['A'] }))
    await vi.advanceTimersByTimeAsync(60_000)
    expect(await p).toMatchObject({ ok: true, data: ['A'] })
  })

  it('a frame whose dispatch throws is recorded and the frames after it still arrive', async () => {
    clearErrors()
    const seen: unknown[] = []
    const g = new Gateway({
      onMessage: (m) => {
        if ((m as { boom?: boolean }).boom) throw new TypeError('boom')
        seen.push(m)
      },
    })
    await connectOpen(g)
    expect(() =>
      currentWs(g).triggerMessage(JSON.stringify({ type: 'event', method: 'GAME_UPDATE', boom: true })),
    ).not.toThrow()
    currentWs(g).triggerMessage(JSON.stringify({ type: 'info', message: 'after' }))
    expect(seen).toEqual([{ type: 'info', message: 'after' }])
    expect(recentErrors().at(-1)?.text).toBe('boom')
  })
})
