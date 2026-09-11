import { EventEmitter } from 'node:events'
import WebSocket from 'ws'

export interface ProxyResult {
  type?: string
  action?: string
  requestId?: string | number
  ok: boolean
  data?: unknown
  error?: string
  errorCode?: string
}

export interface ProxyEvent {
  type: string
  method?: string
  messageId?: number
  objectId?: string | null
  data?: unknown
}

interface Pending {
  resolve: (result: ProxyResult) => void
  reject: (error: Error) => void
  timer: NodeJS.Timeout
}

export class ProxyClient extends EventEmitter {
  private ws: WebSocket | null = null
  private seq = 0
  private readonly pending = new Map<string, Pending>()
  private readonly url: string
  private reconnectEnabled = false
  private userClosed = false
  private reconnectAttempts = 0
  private reconnectTimer: NodeJS.Timeout | null = null
  private opening: Promise<void> | null = null

  constructor(url: string) {
    super()
    this.url = url
  }

  get isOpen(): boolean {
    return this.ws !== null && this.ws.readyState === WebSocket.OPEN
  }

  get autoReconnect(): boolean {
    return this.reconnectEnabled
  }

  setAutoReconnect(enabled: boolean): void {
    this.reconnectEnabled = enabled
    if (!enabled && this.reconnectTimer) {
      clearTimeout(this.reconnectTimer)
      this.reconnectTimer = null
    }
  }

  open(timeoutMs = 10_000): Promise<void> {
    if (this.isOpen) return Promise.resolve()
    if (this.opening) return this.opening
    this.userClosed = false
    const attempt = new Promise<void>((resolve, reject) => {
      const ws = new WebSocket(this.url)
      this.ws = ws
      const timer = setTimeout(() => {
        ws.terminate()
        reject(new Error(`timeout abriendo ${this.url}`))
      }, timeoutMs)
      ws.once('open', () => {
        clearTimeout(timer)
        resolve()
      })
      ws.once('error', (error: Error) => {
        clearTimeout(timer)
        reject(error)
      })
      ws.on('message', (raw: WebSocket.RawData) => this.onMessage(String(raw)))
      ws.on('close', () => {
        if (this.ws === ws) this.ws = null
        for (const pending of this.pending.values()) {
          clearTimeout(pending.timer)
          pending.reject(new Error('websocket del proxy cerrado'))
        }
        this.pending.clear()
        this.emit('closed')
        if (this.reconnectEnabled && !this.userClosed) this.scheduleReconnect()
      })
    })
    this.opening = attempt.finally(() => {
      this.opening = null
    })
    return this.opening
  }

  close(): void {
    this.userClosed = true
    this.reconnectEnabled = false
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer)
      this.reconnectTimer = null
    }
    const ws = this.ws
    this.ws = null
    for (const pending of this.pending.values()) clearTimeout(pending.timer)
    this.pending.clear()
    ws?.close()
  }

  private scheduleReconnect(): void {
    if (this.reconnectTimer || this.userClosed || !this.reconnectEnabled) return
    const delay = Math.min(1_000 * 2 ** this.reconnectAttempts, 10_000)
    this.reconnectAttempts++
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null
      void this.tryReopen()
    }, delay)
    this.reconnectTimer.unref?.()
  }

  private async tryReopen(): Promise<void> {
    if (this.userClosed || !this.reconnectEnabled || this.isOpen) return
    try {
      await this.open(10_000)
      this.reconnectAttempts = 0
      this.emit('reopened')
    } catch {
      this.scheduleReconnect()
    }
  }

  request(action: string, args: Record<string, unknown> = {}, timeoutMs = 20_000): Promise<ProxyResult> {
    const ws = this.ws
    if (!ws || ws.readyState !== WebSocket.OPEN) {
      return Promise.reject(new Error('proxy no conectado — usa mage_connect'))
    }
    const requestId = `m${++this.seq}`
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(requestId)
        reject(new Error(`timeout esperando resultado de ${action}`))
      }, timeoutMs)
      this.pending.set(requestId, { resolve, reject, timer })
      ws.send(JSON.stringify({ requestId, action, args }))
    })
  }

  async requestOk(action: string, args: Record<string, unknown> = {}, timeoutMs = 20_000): Promise<unknown> {
    const result = await this.request(action, args, timeoutMs)
    if (!result.ok) {
      const detail = typeof result.error === 'string' ? result.error : JSON.stringify(result.error ?? '')
      throw new Error(`${action} falló${result.errorCode ? ` [${result.errorCode}]` : ''}: ${detail}`)
    }
    return result.data
  }

  private onMessage(raw: string): void {
    let message: ProxyResult & ProxyEvent
    try {
      message = JSON.parse(raw) as ProxyResult & ProxyEvent
    } catch {
      this.emit('parse-error', raw)
      return
    }
    if (message.type === 'result') {
      const pending = this.pending.get(String(message.requestId))
      if (pending) {
        this.pending.delete(String(message.requestId))
        clearTimeout(pending.timer)
        pending.resolve(message)
      }
      this.emit('result', message)
      return
    }
    this.emit('message', message)
    if (message.type === 'event') this.emit('event', message)
  }
}
