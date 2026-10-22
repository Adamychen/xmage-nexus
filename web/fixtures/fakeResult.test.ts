import { describe, expect, it } from 'vitest'
import { DEFAULT_RESULTS, FakeServerCore, type FakeSocket, type Scenario } from './fakeCore'

class ResultSocket implements FakeSocket {
  readonly results: { requestId: number; ok: boolean; data?: unknown }[] = []
  isOpen(): boolean {
    return true
  }
  send(data: string): void {
    const frame = JSON.parse(data) as { type: string; requestId?: number; ok?: boolean; data?: unknown }
    if (frame.type === 'result') this.results.push({ requestId: frame.requestId ?? -1, ok: frame.ok ?? false, data: frame.data })
  }
  close(): void {}
}

function requestOnce(scenario: Scenario, action = 'getGameTypes'): ResultSocket {
  const core = new FakeServerCore(() => scenario)
  const socket = new ResultSocket()
  core.attach(socket).message(JSON.stringify({ action, requestId: 1, args: {} }))
  return socket
}

describe('FakeServerCore results', () => {
  it('answers once with the failure when the handler fails the request', () => {
    const socket = requestOnce({
      onAction: (conn, action, _args, requestId) => conn.fail(requestId, action, 'boom'),
    })
    expect(socket.results).toHaveLength(1)
    expect(socket.results[0].ok).toBe(false)
  })

  it('answers once with the handler data when the handler answers the request', () => {
    const socket = requestOnce({
      onAction: (conn, action, _args, requestId) => conn.ok(requestId, action, ['custom']),
    })
    expect(socket.results).toEqual([{ requestId: 1, ok: true, data: ['custom'] }])
  })

  it('answers with the default result when the handler does not answer', () => {
    const socket = requestOnce({})
    expect(socket.results).toEqual([{ requestId: 1, ok: true, data: DEFAULT_RESULTS.getGameTypes }])
  })

  it('answers once with an error when the handler throws', () => {
    const socket = requestOnce({
      onAction: () => {
        throw new Error('broken fixture')
      },
    })
    expect(socket.results).toHaveLength(1)
    expect(socket.results[0].ok).toBe(false)
  })
})
