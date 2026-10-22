import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { DemoSocket } from './DemoSocket'
import { DEMO_USERNAME } from './data'
import { doConnect, reset } from '../state/gateway'
import { getState } from '../state/state'

describe('demo login through the in-browser core', () => {
  beforeEach(() => {
    vi.stubGlobal('WebSocket', DemoSocket)
  })

  afterEach(() => {
    reset()
    vi.unstubAllGlobals()
  })

  it('logs in and reaches the lobby with the demo tables', async () => {
    await doConnect('demo', 0, 'demo.xmage.nexus', 17171, DEMO_USERNAME, '', 'ar', 12)
    await vi.waitFor(() => expect(getState().phase).toBe('lobby'), { timeout: 5000 })
    await vi.waitFor(() => expect(getState().lobby?.tables.length ?? 0).toBeGreaterThan(0), { timeout: 5000 })
    expect(getState().error).toBeNull()
  })
})
