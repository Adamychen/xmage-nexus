import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { buildDiagnosticBundle, downloadDiagnostics } from './diagnostics'
import { clearFrames, recordFrame } from '../net/frameBuffer'
import { getState, setState } from '../state/state'
import type { ProxyMessage } from '../net/types'

describe('diagnostics (P7)', () => {
  const prevConn = getState().conn

  beforeEach(() => {
    clearFrames()
  })

  afterEach(() => {
    clearFrames()
    setState({ conn: prevConn } as never)
    vi.unstubAllGlobals()
  })

  it('nunca incluye la contraseña', () => {
    setState({
      conn: { wsHost: 'h', proxyPort: 1, serverHost: 's', port: 2, username: 'u', password: 'SECRETA' },
    } as never)
    const bundle = buildDiagnosticBundle()
    expect(JSON.stringify(bundle)).not.toContain('SECRETA')
    expect(bundle.conn.username).toBe('u')
    expect(bundle.conn.serverHost).toBe('s')
  })

  it('incluye log y frames recientes', () => {
    recordFrame({ type: 'error', message: 'x' } as ProxyMessage)
    const bundle = buildDiagnosticBundle()
    expect(bundle.appVersion).toBeTruthy()
    expect(bundle.frames.map((f) => f.kind)).toContain('error')
    expect(Array.isArray(bundle.log)).toBe(true)
  })

  it('downloadDiagnostics genera un JSON descargable', () => {
    const createObjectURL = vi.fn().mockReturnValue('blob:diag')
    const revokeObjectURL = vi.fn()
    vi.stubGlobal('URL', { createObjectURL, revokeObjectURL })
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})
    expect(downloadDiagnostics()).toBe(true)
    expect(createObjectURL).toHaveBeenCalled()
    expect(click).toHaveBeenCalled()
  })
})
