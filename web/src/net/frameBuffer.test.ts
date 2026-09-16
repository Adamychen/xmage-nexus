import { beforeEach, describe, expect, it } from 'vitest'
import { clearFrames, FRAME_BUFFER_LIMITS, recentFrames, recordFrame } from './frameBuffer'
import type { ProxyMessage } from './types'

describe('frameBuffer (P7)', () => {
  beforeEach(() => {
    clearFrames()
  })

  it('resume eventos por método y resultados por acción', () => {
    recordFrame({ type: 'event', method: 'GAME_SELECT', messageId: 1 } as ProxyMessage)
    recordFrame({ type: 'result', action: 'sendPlayerBoolean', ok: true } as ProxyMessage)
    recordFrame({ type: 'error', message: 'boom' } as ProxyMessage)
    expect(recentFrames().map((f) => f.kind)).toEqual([
      'event:GAME_SELECT',
      'result:sendPlayerBoolean:ok',
      'error',
    ])
  })

  it('guarda el payload completo solo si es pequeño', () => {
    recordFrame({ type: 'info', message: 'hola' } as ProxyMessage)
    expect(recentFrames()[0].full).toBeDefined()
    const big = { type: 'event', method: 'GAME_UPDATE', messageId: 2, data: { pad: 'x'.repeat(100_000) } }
    recordFrame(big as unknown as ProxyMessage)
    const last = recentFrames()[1]
    expect(last.full).toBeUndefined()
    expect(last.bytes).toBeGreaterThan(FRAME_BUFFER_LIMITS.MAX_FULL_BYTES)
    expect(last.digest?.method).toBe('GAME_UPDATE')
  })

  it('recorta al límite y expone copia', () => {
    for (let i = 0; i < FRAME_BUFFER_LIMITS.MAX_FRAMES + 10; i++) {
      recordFrame({ type: 'info', message: `m${i}` } as ProxyMessage)
    }
    expect(recentFrames()).toHaveLength(FRAME_BUFFER_LIMITS.MAX_FRAMES)
  })
})
