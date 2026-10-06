import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { Gateway, HEARTBEAT_INTERVAL_MS, HEARTBEAT_TIMEOUT_MS } from './Gateway'

/** WebSocket simulado: estáticos de readyState, y helpers para disparar onopen/onmessage/onclose. */
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

  triggerClose(reason = '', code = 1006) {
    this.readyState = FakeWebSocket.CLOSED
    this.onclose?.({ reason, code })
  }
}

function currentWs(g: Gateway): FakeWebSocket {
  return g.ws as unknown as FakeWebSocket
}

async function connectOpen(g: Gateway): Promise<void> {
  const p = g.connect('ws://proxy.test:8787')
  currentWs(g).triggerOpen()
  await vi.advanceTimersByTimeAsync(100)
  await p
}

describe('Gateway', () => {
  beforeEach(() => {
    FakeWebSocket.instances = []
    vi.useFakeTimers()
    vi.stubGlobal('WebSocket', FakeWebSocket)
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })

  it('connect() resolves once onopen fires', async () => {
    const g = new Gateway()
    const p = g.connect('ws://proxy.test:8787')
    expect(g.isOpen).toBe(false)
    currentWs(g).triggerOpen()
    await vi.advanceTimersByTimeAsync(100)
    await p
    expect(g.isOpen).toBe(true)
  })

  it('send() resolves with the result matched by requestId', async () => {
    const g = new Gateway()
    await connectOpen(g)
    const first = g.send('getGameTypes')
    const second = g.send('getGameTypes')
    currentWs(g).triggerMessage(JSON.stringify({ type: 'result', action: 'getGameTypes', requestId: '0', ok: true, data: ['A'] }))
    const r1 = await first
    expect(r1.data).toEqual(['A'])
    currentWs(g).triggerMessage(JSON.stringify({ type: 'result', action: 'getGameTypes', requestId: '1', ok: true, data: ['B'] }))
    const r2 = await second
    expect(r2.data).toEqual(['B'])
    expect(currentWs(g).sent).toHaveLength(2)
    expect(JSON.parse(currentWs(g).sent[0])).toMatchObject({ requestId: '0', action: 'getGameTypes' })
    expect(JSON.parse(currentWs(g).sent[1])).toMatchObject({ requestId: '1', action: 'getGameTypes' })
  })

  it('does not confuse concurrent requests with the same action when results arrive out of order', async () => {
    const g = new Gateway()
    await connectOpen(g)
    const first = g.send('getGameTypes')
    const second = g.send('getGameTypes')
    currentWs(g).triggerMessage(JSON.stringify({ type: 'result', action: 'getGameTypes', requestId: '1', ok: true, data: ['second'] }))
    currentWs(g).triggerMessage(JSON.stringify({ type: 'result', action: 'getGameTypes', requestId: '0', ok: true, data: ['first'] }))
    expect((await first).data).toEqual(['first'])
    expect((await second).data).toEqual(['second'])
  })

  it('sends actions of different names without cross-matching results', async () => {
    const g = new Gateway()
    await connectOpen(g)
    const pA = g.send('actionA')
    const pB = g.send('actionB')
    currentWs(g).triggerMessage(JSON.stringify({ type: 'result', action: 'actionB', ok: true, data: 'B' }))
    const rB = await pB
    expect(rB.data).toBe('B')
    currentWs(g).triggerMessage(JSON.stringify({ type: 'result', action: 'actionA', ok: true, data: 'A' }))
    const rA = await pA
    expect(rA.data).toBe('A')
  })

  it('close() rejects pending requests with "disconnected"', async () => {
    const g = new Gateway()
    await connectOpen(g)
    const p = g.send('joinTable', { tableId: 't1' })
    g.close()
    const res = await p
    expect(res.ok).toBe(false)
    expect(res.error).toBe('disconnected')
    expect(g.isOpen).toBe(false)
  })

  it('send() while disconnected resolves with "not connected"', async () => {
    const g = new Gateway()
    const res = await g.send('quitMatch')
    expect(res.ok).toBe(false)
    expect(res.error).toBe('not connected')
  })

  it('reconnects after an unexpected close with backoff', async () => {
    const g = new Gateway()
    await connectOpen(g)
    const first = currentWs(g)
    const onClose = vi.fn()
    g.events.onClose = onClose
    first.triggerClose('gone', 1006)
    expect(onClose).toHaveBeenCalledWith('gone')
    expect(FakeWebSocket.instances).toHaveLength(1)
    expect(g.isOpen).toBe(false)
    await vi.advanceTimersByTimeAsync(1000)
    expect(FakeWebSocket.instances).toHaveLength(2)
    const second = currentWs(g)
    expect(second).not.toBe(first)
    expect(g.isOpen).toBe(false)
    second.triggerOpen()
    expect(g.isOpen).toBe(true)
  })

  it('does not reconnect after a user-initiated close', async () => {
    const g = new Gateway()
    await connectOpen(g)
    g.close()
    await vi.advanceTimersByTimeAsync(20000)
    expect(FakeWebSocket.instances).toHaveLength(1)
  })

  describe('heartbeat (half-open sockets)', () => {
    const pings = (ws: FakeWebSocket) => ws.sent.map((m) => JSON.parse(m)).filter((m) => m.action === 'ping')

    it('probes an idle connection and keeps it while the proxy answers', async () => {
      const g = new Gateway()
      await connectOpen(g)
      const ws = currentWs(g)
      await vi.advanceTimersByTimeAsync(HEARTBEAT_INTERVAL_MS + 100)
      expect(pings(ws)).toHaveLength(1)
      ws.triggerMessage(JSON.stringify({ type: 'result', action: 'ping', requestId: pings(ws)[0].requestId, ok: true, data: 'pong' }))
      await vi.advanceTimersByTimeAsync(HEARTBEAT_TIMEOUT_MS + 100)
      expect(currentWs(g)).toBe(ws)
      expect(FakeWebSocket.instances).toHaveLength(1)
    })

    it('drops a socket that stops answering, fails pending actions and reconnects', async () => {
      const onClose = vi.fn()
      const onOpen = vi.fn()
      const g = new Gateway({ onClose, onOpen })
      await connectOpen(g)
      const ws = currentWs(g)
      const pending = g.send('sendPlayerUUID', { gameId: 'g-1' })
      await vi.advanceTimersByTimeAsync(HEARTBEAT_INTERVAL_MS + HEARTBEAT_TIMEOUT_MS + 200)
      expect(pings(ws)).toHaveLength(1)
      expect(onClose).toHaveBeenCalledWith('heartbeat timeout')
      await expect(pending).resolves.toMatchObject({ ok: false, error: 'heartbeat timeout' })
      await vi.advanceTimersByTimeAsync(1100)
      expect(FakeWebSocket.instances).toHaveLength(2)
      FakeWebSocket.instances[1].triggerOpen()
      expect(onOpen).toHaveBeenCalledTimes(2)
    })

    it('any inbound frame counts as alive (no probe while events flow)', async () => {
      const g = new Gateway()
      await connectOpen(g)
      const ws = currentWs(g)
      for (let i = 0; i < 6; i++) {
        await vi.advanceTimersByTimeAsync(HEARTBEAT_INTERVAL_MS / 2)
        ws.triggerMessage(JSON.stringify({ type: 'info', message: 'tick' }))
      }
      expect(pings(ws)).toHaveLength(0)
    })

    it('stops probing after a user close', async () => {
      const g = new Gateway()
      await connectOpen(g)
      const ws = currentWs(g)
      g.close()
      await vi.advanceTimersByTimeAsync(HEARTBEAT_INTERVAL_MS * 3)
      expect(pings(ws)).toHaveLength(0)
      expect(FakeWebSocket.instances).toHaveLength(1)
    })
  })

  describe('resumable stream', () => {
    const connectResult = (requestId: string, data: Record<string, unknown>) =>
      JSON.stringify({ type: 'result', action: 'connect', requestId, ok: true, data })
    const event = (seq: number, method: string) =>
      JSON.stringify({ seq, type: 'event', method, messageId: seq })

    it('tracks the last frame of the proxy stream for the resume token', async () => {
      const g = new Gateway()
      await connectOpen(g)
      expect(g.resumeToken()).toBeNull()
      const ws = currentWs(g)
      void g.send('connect', {})
      ws.triggerMessage(connectResult('0', { attached: false, streamId: 's1' }))
      ws.triggerMessage(event(1, 'GAME_INIT'))
      ws.triggerMessage(event(2, 'GAME_SELECT'))
      expect(g.resumeToken()).toEqual({ streamId: 's1', seq: 2 })
    })

    it('drops a replayed frame it already processed', async () => {
      const seen: string[] = []
      const g = new Gateway({ onMessage: (m) => { if (m.type === 'event') seen.push(m.method) } })
      await connectOpen(g)
      const ws = currentWs(g)
      void g.send('connect', {})
      ws.triggerMessage(connectResult('0', { streamId: 's1' }))
      ws.triggerMessage(event(1, 'A'))
      ws.triggerMessage(event(2, 'B'))
      ws.triggerMessage(event(2, 'B'))
      ws.triggerMessage(event(3, 'C'))
      ws.triggerMessage(JSON.stringify({ type: 'event', method: 'REPLAY', messageId: 9 }))
      expect(seen).toEqual(['A', 'B', 'C', 'REPLAY'])
    })

    it('a login onto another stream restarts the numbering', async () => {
      const seen: string[] = []
      const g = new Gateway({ onMessage: (m) => { if (m.type === 'event') seen.push(m.method) } })
      await connectOpen(g)
      const ws = currentWs(g)
      void g.send('connect', {})
      ws.triggerMessage(connectResult('0', { streamId: 's1' }))
      ws.triggerMessage(event(40, 'OLD'))
      void g.send('connect', {})
      ws.triggerMessage(connectResult('1', { streamId: 's2' }))
      ws.triggerMessage(event(1, 'NEW'))
      expect(seen).toEqual(['OLD', 'NEW'])
      expect(g.resumeToken()).toEqual({ streamId: 's2', seq: 1 })
    })

    it('keeps the numbering when it re-attaches to the same stream', async () => {
      const g = new Gateway()
      await connectOpen(g)
      const ws = currentWs(g)
      void g.send('connect', {})
      ws.triggerMessage(connectResult('0', { streamId: 's1' }))
      ws.triggerMessage(event(7, 'A'))
      void g.send('connect', {})
      ws.triggerMessage(connectResult('1', { streamId: 's1', attached: true, resumed: false }))
      expect(g.resumeToken()).toEqual({ streamId: 's1', seq: 7 })
    })

    it('a seeded token continues the stream of the page before a reload', async () => {
      const seen: string[] = []
      const g = new Gateway({ onMessage: (m) => { if (m.type === 'event') seen.push(m.method) } })
      g.seedResume({ streamId: 's1', seq: 5 })
      expect(g.resumeToken()).toEqual({ streamId: 's1', seq: 5 })
      await connectOpen(g)
      const ws = currentWs(g)
      void g.send('connect', {})
      ws.triggerMessage(connectResult('0', { streamId: 's1', attached: true, resumed: true }))
      ws.triggerMessage(event(5, 'SEEN_BEFORE_RELOAD'))
      ws.triggerMessage(event(6, 'GAP'))
      expect(seen).toEqual(['GAP'])
      expect(g.resumeToken()).toEqual({ streamId: 's1', seq: 6 })
    })
  })

  describe('leaving', () => {
    it('gives the app a chance to save state when the page goes away', async () => {
      const onPageHide = vi.fn()
      const g = new Gateway({ onPageHide })
      await connectOpen(g)
      window.dispatchEvent(new Event('pagehide'))
      expect(onPageHide).toHaveBeenCalledTimes(1)
    })

    it('tells the proxy when the page is being closed', async () => {
      const g = new Gateway()
      await connectOpen(g)
      window.dispatchEvent(new Event('pagehide'))
      const sent = currentWs(g).sent.map((m) => JSON.parse(m) as { action: string })
      expect(sent.map((m) => m.action)).toContain('leaving')
    })

    it('stays silent once the socket is closed by the app', async () => {
      const g = new Gateway()
      await connectOpen(g)
      const ws = currentWs(g)
      g.close()
      window.dispatchEvent(new Event('pagehide'))
      expect(ws.sent.some((m) => m.includes('leaving'))).toBe(false)
    })
  })
})
