import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { Gateway } from '../net/Gateway'
import { handleMessage } from './eventHandler'
import { getState, setState } from './state'
import { recentErrors, clearErrors } from '../system/errorLog'

class FakeWebSocket {
  static CONNECTING = 0
  static OPEN = 1
  static CLOSED = 3
  static instances: FakeWebSocket[] = []

  readyState = FakeWebSocket.CONNECTING
  onopen: (() => void) | null = null
  onmessage: ((ev: { data: unknown }) => void) | null = null
  onclose: ((ev: { reason?: string; code?: number }) => void) | null = null
  onerror: (() => void) | null = null

  constructor() {
    FakeWebSocket.instances.push(this)
  }

  send() {}

  close() {
    this.readyState = FakeWebSocket.CLOSED
  }

  triggerOpen() {
    this.readyState = FakeWebSocket.OPEN
    this.onopen?.()
  }

  triggerMessage(data: unknown) {
    this.onmessage?.({ data: JSON.stringify(data) })
  }
}

describe('malformed event frames', () => {
  beforeEach(() => {
    FakeWebSocket.instances = []
    vi.useFakeTimers()
    vi.stubGlobal('WebSocket', FakeWebSocket)
    clearErrors()
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })

  it('an event without a method is ignored instead of throwing', () => {
    expect(() => handleMessage({ type: 'event', objectId: 'g1', data: {} } as never)).not.toThrow()
  })

  it('a GAME_UPDATE with a null player and a method-less event do not stop the gateway', async () => {
    const g = new Gateway({ onMessage: handleMessage })
    const p = g.connect('ws://proxy.test:8787')
    const ws = FakeWebSocket.instances[0]
    ws.triggerOpen()
    await vi.advanceTimersByTimeAsync(100)
    await p
    setState({ phase: 'game', gameId: 'g1' } as never)
    expect(() => ws.triggerMessage({ type: 'event', method: 'GAME_UPDATE', objectId: 'g1', data: { gameView: { myHand: {}, phase: 'PLAY', players: [null] } } })).not.toThrow()
    expect(() => ws.triggerMessage({ type: 'event', objectId: 'g1', data: {} })).not.toThrow()
    ws.triggerMessage({ type: 'info', message: 'still here' })
    expect(getState().log.at(-1)?.text).toBe('still here')
    expect(recentErrors().length).toBeGreaterThan(0)
    g.close()
  })
})
