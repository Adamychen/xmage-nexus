import type { EventEnvelope, LobbyEnvelope, ProxyMessage, ResultEnvelope } from './types'
import { recordFrame } from './frameBuffer'

export interface GatewayEvents {
  onMessage?: (msg: ProxyMessage) => void
  onOpen?: () => void
  onClose?: (reason: string) => void
  /** The page is going away (reload, close, navigation): last chance to save state. */
  onPageHide?: () => void
}

/** Idle time before the client probes the connection with a `ping`. */
export const HEARTBEAT_INTERVAL_MS = 15000
/** A probe without any inbound frame within this time means a dead socket. */
export const HEARTBEAT_TIMEOUT_MS = 10000

interface PendingRequest<T = unknown> {
  id: string
  action: string
  resolve: (res: ResultEnvelope & { data?: T }) => void
}

/**
 * Cliente WebSocket del proxy: reconexión con backoff, promesas por acción,
 * y notificación de mensajes al listener (store).
 */
export class Gateway {
  ws: WebSocket | null = null
  events: GatewayEvents = {}
  private url = ''
  private pending = new Map<string, PendingRequest>()
  private pendingByAction = new Map<string, string[]>()
  private seq = 0
  private reconnectAttempts = 0
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null
  private userClosed = false
  private connectedAt = 0
  private lastInboundAt = 0
  private probeSentAt = 0
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null
  private probeCheckTimer: ReturnType<typeof setTimeout> | null = null
  private readonly onWake = () => this.probe()
  private readonly onLeave = () => {
    this.events.onPageHide?.()
    this.announceLeaving()
  }
  private streamId: string | null = null
  private lastSeq = 0

  constructor(events: GatewayEvents = {}) {
    this.events = events
  }

  get isOpen() {
    return this.ws?.readyState === WebSocket.OPEN
  }

  /** The proxy numbers every session frame (`seq`) of a stream; a re-login sends
   *  this back so the proxy replays exactly the frames missed while away. */
  resumeToken(): { streamId: string; seq: number } | null {
    return this.streamId ? { streamId: this.streamId, seq: this.lastSeq } : null
  }

  /** Continues a stream from before a page reload: the next login presents it,
   *  and replayed frames above `seq` pass the duplicate filter. */
  seedResume(token: { streamId: string; seq: number }) {
    this.streamId = token.streamId
    this.lastSeq = token.seq
  }

  get elapsedSecs() {
    return this.isOpen ? Math.round((Date.now() - this.connectedAt) / 1000) : 0
  }

  connect(url: string): Promise<void> {
    this.url = url
    this.userClosed = false
    this.reconnectAttempts = 0
    this.open()
    return this.waitOpen(5000)
  }

  private open() {
    this.cleanup()
    const ws = new WebSocket(this.url)
    this.ws = ws
    ws.onopen = () => {
      this.reconnectAttempts = 0
      this.connectedAt = Date.now()
      this.lastInboundAt = this.connectedAt
      this.startHeartbeat()
      this.events.onOpen?.()
    }
    ws.onmessage = (ev) => {
      this.lastInboundAt = Date.now()
      this.handleMessage(ev.data)
    }
    ws.onerror = () => ws.close()
    ws.onclose = (ev) => {
      if (this.ws !== ws) return
      this.connectionLost(ev.reason || `close(${ev.code})`)
    }
  }

  private connectionLost(reason: string) {
    this.stopHeartbeat()
    this.events.onClose?.(reason)
    this.rejectAll(reason)
    if (!this.userClosed && this.url) this.scheduleReconnect()
  }

  /**
   * Half-open sockets (a tunnel or NAT that stalls without closing, a laptop
   * waking up) stay OPEN in the browser for minutes while every action goes
   * nowhere: the game looks frozen until a reload. An idle connection is
   * probed with a `ping`; no inbound frame in time drops the socket and the
   * normal reconnect + rejoin path takes over.
   */
  private startHeartbeat() {
    this.stopHeartbeat()
    this.heartbeatTimer = setInterval(() => this.heartbeatTick(), HEARTBEAT_INTERVAL_MS / 3)
    if (typeof window !== 'undefined') {
      window.addEventListener('online', this.onWake)
      window.addEventListener('focus', this.onWake)
      window.addEventListener('pagehide', this.onLeave)
    }
    if (typeof document !== 'undefined') document.addEventListener('visibilitychange', this.onWake)
  }

  private stopHeartbeat() {
    if (this.heartbeatTimer) clearInterval(this.heartbeatTimer)
    if (this.probeCheckTimer) clearTimeout(this.probeCheckTimer)
    this.heartbeatTimer = null
    this.probeCheckTimer = null
    this.probeSentAt = 0
    if (typeof window !== 'undefined') {
      window.removeEventListener('online', this.onWake)
      window.removeEventListener('focus', this.onWake)
      window.removeEventListener('pagehide', this.onLeave)
    }
    if (typeof document !== 'undefined') document.removeEventListener('visibilitychange', this.onWake)
  }

  private heartbeatTick() {
    if (!this.isOpen) return
    const now = Date.now()
    if (this.probeSentAt && this.lastInboundAt < this.probeSentAt) {
      if (now - this.probeSentAt >= HEARTBEAT_TIMEOUT_MS) this.dropDeadSocket()
      return
    }
    if (now - this.lastInboundAt >= HEARTBEAT_INTERVAL_MS) this.probe()
  }

  private probe() {
    if (!this.isOpen) return
    if (this.probeSentAt && this.lastInboundAt < this.probeSentAt) return
    this.probeSentAt = Date.now()
    try {
      this.ws?.send(JSON.stringify({ requestId: `hb-${this.probeSentAt}`, action: 'ping', args: {} }))
    } catch {
      this.dropDeadSocket()
      return
    }
    if (this.probeCheckTimer) clearTimeout(this.probeCheckTimer)
    this.probeCheckTimer = setTimeout(() => this.heartbeatTick(), HEARTBEAT_TIMEOUT_MS)
  }

  /**
   * The page is being closed, reloaded or navigated away: the proxy then keeps
   * the session only for a short grace period instead of the one for a dropped
   * connection, so the opponent of a player who closed the tab does not wait
   * minutes (a reload is back within seconds).
   */
  private announceLeaving() {
    if (!this.isOpen) return
    try {
      this.ws?.send(JSON.stringify({ action: 'leaving', args: {} }))
    } catch {
      // closing anyway
    }
  }

  private dropDeadSocket() {
    const ws = this.ws
    if (!ws) return
    this.ws = null
    ws.onmessage = null
    try {
      ws.close()
    } catch {
      // already closing
    }
    this.connectionLost('heartbeat timeout')
  }

  private cleanup() {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer)
      this.reconnectTimer = null
    }
    this.stopHeartbeat()
  }

  private scheduleReconnect() {
    const delay = Math.min(1000 * 2 ** this.reconnectAttempts, 10000)
    this.reconnectAttempts++
    this.reconnectTimer = setTimeout(() => this.open(), delay)
  }

  private waitOpen(timeoutMs: number): Promise<void> {
    return new Promise((resolve, reject) => {
      const started = Date.now()
      const tick = () => {
        if (this.isOpen) return resolve()
        if (Date.now() - started > timeoutMs) return reject(new Error('timeout connecting to proxy'))
        setTimeout(tick, 50)
      }
      tick()
    })
  }

  private handleMessage(data: unknown) {
    const raw = String(data)
    let msg: ProxyMessage
    try {
      msg = JSON.parse(raw) as ProxyMessage
    } catch {
      console.warn('[gateway] mensaje no JSON', data)
      return
    }
    if (msg.type === 'result') {
      this.adoptStream(msg)
      this.resolvePending(msg)
    }
    const seq = (msg as { seq?: unknown }).seq
    if (typeof seq === 'number') {
      // already processed before the socket dropped: the resume replays from
      // the last seq sent, but a frame may have been in flight both ways
      if (seq <= this.lastSeq) return
      this.lastSeq = seq
    }
    recordFrame(msg, raw.length)
    this.events.onMessage?.(msg)
  }

  /** A login onto another proxy stream (a new proxy session) restarts its numbering. */
  private adoptStream(msg: ResultEnvelope) {
    if (msg.action !== 'connect' || !msg.ok) return
    const streamId = (msg.data as { streamId?: unknown } | undefined)?.streamId
    if (typeof streamId !== 'string') return
    if (streamId !== this.streamId) {
      this.streamId = streamId
      this.lastSeq = 0
    }
  }

  private resolvePending(msg: ResultEnvelope) {
    let requestId = msg.requestId === undefined || msg.requestId === null ? undefined : String(msg.requestId)
    if (requestId === undefined) {
      const ids = this.pendingByAction.get(msg.action)
      requestId = ids?.shift()
      if (ids && !ids.length) this.pendingByAction.delete(msg.action)
    } else {
      const ids = this.pendingByAction.get(msg.action)
      if (ids) {
        const index = ids.indexOf(requestId)
        if (index >= 0) ids.splice(index, 1)
        if (!ids.length) this.pendingByAction.delete(msg.action)
      }
    }
    if (!requestId) return
    const req = this.pending.get(requestId)
    if (!req) return
    this.pending.delete(requestId)
    req.resolve(msg)
  }

  private rejectAll(reason: string) {
    for (const [, req] of this.pending) {
      req.resolve({ type: 'result', action: req.action, requestId: req.id, ok: false, error: reason, data: undefined })
    }
    this.pending.clear()
    this.pendingByAction.clear()
  }

  /** Envía una acción y resuelve con el result del proxy (emparejado por requestId). */
  send<T = unknown>(action: string, args: Record<string, unknown> = {}): Promise<ResultEnvelope & { data?: T }> {
    if (!this.isOpen) return Promise.resolve({ type: 'result', action, ok: false, error: 'not connected', errorCode: 'NOT_CONNECTED', data: undefined })
    const id = String(this.seq++)
    return new Promise<ResultEnvelope & { data?: T }>((resolve) => {
      this.pending.set(id, { id, action, resolve: resolve as PendingRequest['resolve'] })
      const ids = this.pendingByAction.get(action) ?? []
      ids.push(id)
      this.pendingByAction.set(action, ids)
      this.ws?.send(JSON.stringify({ requestId: id, action, args }))
    })
  }

  close() {
    this.userClosed = true
    this.cleanup()
    this.ws?.close()
    this.ws = null
    this.rejectAll('disconnected')
  }
}

/** Tipos de evento que el store debe interpretar. */
export function isEvent(msg: ProxyMessage): msg is EventEnvelope {
  return msg.type === 'event'
}

export function isLobby(msg: ProxyMessage): msg is LobbyEnvelope {
  return msg.type === 'lobby'
}
