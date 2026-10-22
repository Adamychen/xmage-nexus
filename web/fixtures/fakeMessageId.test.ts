import { describe, expect, it, vi } from 'vitest'
import { FakeServerCore, type FakeConn, type FakeSocket, type Scenario } from './fakeCore'

class RecordingSocket implements FakeSocket {
  readonly frames: { messageId: number; method: string }[] = []
  isOpen(): boolean {
    return true
  }
  send(data: string): void {
    const frame = JSON.parse(data) as { type: string; messageId?: number; method?: string }
    if (frame.type === 'event') this.frames.push({ messageId: frame.messageId ?? -1, method: frame.method ?? '' })
  }
  close(): void {}
}

describe('FakeServerCore messageId', () => {
  it('orders events from different connections of one server in a single increasing sequence', () => {
    const conns: FakeConn[] = []
    const scenario: Scenario = { onConnect: (conn) => { conns.push(conn) } }
    const core = new FakeServerCore(() => scenario)
    const receiver = new RecordingSocket()
    core.attach(new RecordingSocket())
    core.attach(receiver)
    const [a, b] = conns

    a.broadcast('GAME_UPDATE', {}, 'g1')
    b.broadcast('GAME_SELECT', {}, 'g1')
    a.broadcast('GAME_TARGET', {}, 'g1')
    b.broadcast('GAME_UPDATE', {}, 'g1')

    const ids = receiver.frames.map((f) => f.messageId)
    expect(ids).toHaveLength(4)
    for (let i = 1; i < ids.length; i++) {
      expect(ids[i], `messageId ${i} must be greater than the previous one`).toBeGreaterThan(ids[i - 1])
    }
  })

  it('keeps the sequence increasing when delivery is delayed (echoDelayMs)', () => {
    vi.useFakeTimers()
    try {
      const conns: FakeConn[] = []
      const scenario: Scenario = { onConnect: (conn) => { conns.push(conn) } }
      const core = new FakeServerCore(() => scenario, { echoDelayMs: 50 })
      const receiver = new RecordingSocket()
      core.attach(new RecordingSocket())
      core.attach(receiver)
      const [a, b] = conns

      a.broadcast('GAME_UPDATE', {}, 'g1')
      vi.advanceTimersByTime(10)
      b.broadcast('GAME_SELECT', {}, 'g1')
      a.broadcast('GAME_TARGET', {}, 'g1')
      vi.advanceTimersByTime(10)
      b.broadcast('GAME_UPDATE', {}, 'g1')
      expect(receiver.frames, 'nothing is delivered before the delay').toHaveLength(0)

      vi.advanceTimersByTime(100)
      const ids = receiver.frames.map((f) => f.messageId)
      expect(ids).toHaveLength(4)
      for (let i = 1; i < ids.length; i++) {
        expect(ids[i], `messageId ${i} must be greater than the previous one`).toBeGreaterThan(ids[i - 1])
      }
    } finally {
      vi.useRealTimers()
    }
  })
})
