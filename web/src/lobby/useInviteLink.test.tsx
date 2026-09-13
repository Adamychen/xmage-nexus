import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { act, cleanup, renderHook } from '@testing-library/react'
import { useInviteLink } from './useInviteLink'
import { setState } from '../state/state'
import { doConnect } from '../state/gateway'
import { confirmDialog } from '../ui/confirmDialog'

vi.mock('../state/gateway', () => ({ doConnect: vi.fn() }))
vi.mock('../ui/confirmDialog', () => ({ confirmDialog: vi.fn() }))

const oldConn: any = {
  wsHost: 'localhost', proxyPort: 8787,
  serverHost: 'server-a', port: 17171,
  username: 'u', password: 'x',
}
const newConn: any = { ...oldConn, serverHost: 'server-b', port: 17172 }
const table: any = { tableId: 't1', tableName: 't' }

function deps(over: Record<string, unknown> = {}) {
  return {
    conn: oldConn,
    tables: [],
    hasLobby: false,
    joinHuman: vi.fn(),
    watchTable: vi.fn(),
    setNotice: vi.fn(),
    ...over,
  }
}

describe('useInviteLink server switch', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    setState({ pendingDeepLink: null, error: null } as any)
  })

  afterEach(() => {
    cleanup()
  })

  it('reanuda la invitación tras aceptar el cambio de servidor (AUDIT bloqueante)', async () => {
    vi.mocked(confirmDialog).mockResolvedValue(true)
    await act(async () => {
      setState({ pendingDeepLink: { kind: 'watch', tableId: 't1', serverHost: 'server-b', serverPort: 17172 } } as any)
    })
    const d = deps()
    const view = renderHook((p: any) => useInviteLink(p), { initialProps: d as any })
    await act(async () => {})
    expect(confirmDialog).toHaveBeenCalledTimes(1)
    expect(doConnect).toHaveBeenCalledTimes(1)

    await act(async () => {
      view.rerender({ ...d, conn: newConn, tables: [table], hasLobby: true })
    })
    await act(async () => {})
    expect(d.watchTable).toHaveBeenCalledTimes(1)
    expect(d.watchTable).toHaveBeenCalledWith(table)
    expect(confirmDialog).toHaveBeenCalledTimes(1)
  })

    it('descarta la invitación al rechazar el cambio de servidor', async () => {

    vi.mocked(confirmDialog).mockResolvedValue(false)
    await act(async () => {
      setState({ pendingDeepLink: { kind: 'watch', tableId: 't1', serverHost: 'server-b', serverPort: 17172 } } as any)
    })
    const d = deps()
    renderHook((p: any) => useInviteLink(p), { initialProps: d as any })
    await act(async () => {})
    expect(confirmDialog).toHaveBeenCalledTimes(1)
    expect(doConnect).not.toHaveBeenCalled()
    expect(d.watchTable).not.toHaveBeenCalled()
  })

  it('deja rastro visible al cancelar la invitación (C.13-mayores §3)', async () => {
    vi.mocked(confirmDialog).mockResolvedValue(false)
    await act(async () => {
      setState({ pendingDeepLink: { kind: 'watch', tableId: 't1', serverHost: 'server-b', serverPort: 17172 } } as any)
    })
    const d = deps()
    renderHook((p: any) => useInviteLink(p), { initialProps: d as any })
    await act(async () => {})
    expect(d.setNotice).toHaveBeenCalledTimes(1)
    expect(String(d.setNotice.mock.calls[0][0])).toMatch(/cancelada/i)
  })

  it('muestra estado pendiente mientras reintenta la mesa ausente (C.13-mayores §3)', async () => {
    await act(async () => {
      setState({ pendingDeepLink: { kind: 'join', tableId: 't-ausente' } } as any)
    })
    const d = deps({ hasLobby: true, tables: [] })
    renderHook((p: any) => useInviteLink(p), { initialProps: d as any })
    await act(async () => {})
    expect(d.joinHuman).not.toHaveBeenCalled()
    expect(d.setNotice).toHaveBeenCalledTimes(1)
    expect(String(d.setNotice.mock.calls[0][0])).toMatch(/buscando/i)
  })

  it('avisa al agotar los reintentos de mesa ausente (C.13-mayores §3)', async () => {
    vi.useFakeTimers()
    try {
      await act(async () => {
        setState({ pendingDeepLink: { kind: 'join', tableId: 't-ausente' } } as any)
      })
      const d = deps({ hasLobby: true, tables: [] })
      renderHook((p: any) => useInviteLink(p), { initialProps: d as any })
      await act(async () => {})
      for (let i = 0; i < 11; i++) {
        await act(async () => {
          await vi.advanceTimersByTimeAsync(1000)
        })
      }
      expect(d.joinHuman).not.toHaveBeenCalled()
      const msgs = d.setNotice.mock.calls.map((c) => String(c[0]))
      expect(msgs.some((m) => /ya no existe/i.test(m))).toBe(true)
    } finally {
      vi.useRealTimers()
    }
  })

  it('avisa con servidor inválido sin dialogar ni unir (AUDIT)', async () => {
    await act(async () => {
      setState({ pendingDeepLink: { kind: 'join', tableId: 't1', serverRaw: 'sin-puerto' } } as any)
    })
    const d = deps({ hasLobby: true, tables: [table] })
    renderHook((p: any) => useInviteLink(p), { initialProps: d as any })
    await act(async () => {})
    expect(confirmDialog).not.toHaveBeenCalled()
    expect(doConnect).not.toHaveBeenCalled()
    expect(d.joinHuman).not.toHaveBeenCalled()
    expect(d.setNotice).toHaveBeenCalledTimes(1)
    expect(String(d.setNotice.mock.calls[0][0])).toContain('sin-puerto')
  })
})
