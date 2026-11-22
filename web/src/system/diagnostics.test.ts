import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { buildDiagnosticBundle, downloadDiagnostics } from './diagnostics'
import { clearFrames, recordFrame } from '../net/frameBuffer'
import { getState, setState } from '../state/state'
import { clearStackHold } from '../board/stackHold'
import type { ProxyMessage } from '../net/types'

describe('diagnostics (P7)', () => {
  const prevConn = getState().conn

  beforeEach(() => {
    clearFrames()
    clearStackHold()
    setState({ game: null } as never)
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

  it('incluye la pila del servidor y la pila mostrada', () => {
    setState({
      game: { turn: 3, step: 'PRECOMBAT_MAIN', players: [], stack: { s1: { id: 's1', name: 'Lightning Bolt' } } },
    } as never)
    const bundle = buildDiagnosticBundle()
    expect(bundle.game?.stack).toEqual([{ id: 's1', name: 'Lightning Bolt', ability: false }])
    expect(bundle.stackHold).toEqual({ shown: [], held: [], queued: 0, busy: false })
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
