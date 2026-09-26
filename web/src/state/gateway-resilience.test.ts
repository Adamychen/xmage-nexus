import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { attachGateway, handleServerLink, RELOGIN_RETRIES } from './gateway'
import { getState, setState } from './state'
import { reset } from './store'
import { saveActiveGame, loadActiveGame, isSameAccount } from './persistence'
import { gameEventOrder, noteGameEvent } from './gameUtils'
import * as cmds from '../net/commands'

vi.mock('../net/commands', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../net/commands')>()
  return {
    ...actual,
    connect: vi.fn(),
    joinGame: vi.fn(),
    watchGame: vi.fn(),
    getGameChatId: vi.fn(),
    joinDraft: vi.fn(),
    joinTournament: vi.fn(),
  }
})

const conn = { wsHost: 'localhost', proxyPort: 8787, serverHost: 'h', port: 17171, username: 'u', password: 'x' }

function attachStub(token: { streamId: string; seq: number } | null = null) {
  const g = {
    events: {} as { onOpen?: () => Promise<void> | void; onClose?: (r: string) => void; onMessage?: (m: unknown) => void },
    close: vi.fn(),
    resumeToken: () => token,
    isOpen: true,
  }
  attachGateway(g as never)
  return g
}

describe('session resilience', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    reset()
    vi.mocked(cmds.connect).mockReset().mockResolvedValue({ ok: true, data: { attached: true } } as never)
    vi.mocked(cmds.joinGame).mockReset().mockResolvedValue({ ok: true } as never)
    vi.mocked(cmds.watchGame).mockReset().mockResolvedValue({ ok: true } as never)
    vi.mocked(cmds.getGameChatId).mockReset().mockResolvedValue('chat-1')
    vi.mocked(cmds.joinDraft).mockReset().mockResolvedValue({ ok: true } as never)
    vi.mocked(cmds.joinTournament).mockReset().mockResolvedValue({ ok: true } as never)
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('a socket that drops mid-game shows the reconnect banner without leaving the board', () => {
    const g = attachStub()
    setState({ conn, phase: 'game', gameId: 'g1' } as never)
    g.events.onClose?.('close(1006)')
    expect(getState().link).toBe('ws-down')
    expect(getState().phase).toBe('game')
  })

  it('the re-login sends the resume token and skips the rejoin when the proxy replayed the gap', async () => {
    const g = attachStub({ streamId: 's1', seq: 42 })
    saveActiveGame('g1', 't1')
    setState({ conn, phase: 'game', gameId: 'g1' } as never)
    vi.mocked(cmds.connect).mockResolvedValue({ ok: true, data: { attached: true, resumed: true } } as never)
    await g.events.onOpen?.()
    expect(vi.mocked(cmds.connect).mock.calls[0][6]).toEqual({ streamId: 's1', seq: 42 })
    expect(cmds.joinGame).not.toHaveBeenCalled()
    expect(getState().link).toBe('ok')
  })

  it('without a resumable stream the re-login rejoins the game', async () => {
    const g = attachStub()
    saveActiveGame('g1', 't1')
    setState({ conn, phase: 'game', gameId: 'g1' } as never)
    vi.mocked(cmds.connect).mockResolvedValue({ ok: true, data: { attached: true, resumed: false } } as never)
    await g.events.onOpen?.()
    expect(cmds.joinGame).toHaveBeenCalledWith('g1')
  })

  it('a refused re-login is retried visibly until it succeeds', async () => {
    const g = attachStub()
    saveActiveGame('g1', 't1')
    setState({ conn, phase: 'game', gameId: 'g1' } as never)
    vi.mocked(cmds.connect)
      .mockResolvedValueOnce({ ok: false, error: 'User u already connected' } as never)
      .mockResolvedValueOnce({ ok: false, errorCode: 'WARMING_UP' } as never)
      .mockResolvedValue({ ok: true, data: { attached: false } } as never)
    const done = g.events.onOpen?.()
    await vi.advanceTimersByTimeAsync(0)
    expect(getState().link).toBe('relogin-retry')
    expect(getState().linkAttempt).toBe(1)
    await vi.advanceTimersByTimeAsync(1500)
    expect(getState().linkAttempt).toBe(2)
    await vi.advanceTimersByTimeAsync(3000)
    await done
    expect(cmds.connect).toHaveBeenCalledTimes(3)
    expect(getState().link).toBe('ok')
    expect(getState().phase).toBe('game')
    expect(cmds.joinGame).toHaveBeenCalledWith('g1')
  })

  it('gives up after the last retry and sends the player to log in again, keeping the game to resume', async () => {
    const g = attachStub()
    saveActiveGame('g1', 't1')
    setState({ conn, phase: 'game', gameId: 'g1' } as never)
    vi.mocked(cmds.connect).mockResolvedValue({ ok: false, error: 'boom' } as never)
    const done = g.events.onOpen?.()
    await vi.advanceTimersByTimeAsync(120_000)
    await done
    expect(cmds.connect).toHaveBeenCalledTimes(RELOGIN_RETRIES)
    expect(getState().phase).toBe('idle')
    expect(getState().link).toBe('ok')
    expect(getState().error).toContain('boom')
    expect(loadActiveGame()?.gameId).toBe('g1')
  })

  it('stops retrying when the socket dropped again (its reopen starts over)', async () => {
    const g = attachStub()
    setState({ conn, phase: 'lobby' } as never)
    vi.mocked(cmds.connect).mockResolvedValue({ ok: false, error: 'not connected' } as never)
    g.isOpen = false
    await g.events.onOpen?.()
    await vi.advanceTimersByTimeAsync(60_000)
    expect(cmds.connect).toHaveBeenCalledTimes(1)
  })

  it('the proxy losing the XMage server keeps the board and rejoins once it is back', async () => {
    attachStub()
    saveActiveGame('g1', 't1')
    setState({ conn, phase: 'game', gameId: 'g1' } as never)
    noteGameEvent('g1', 900)
    handleServerLink({ type: 'serverLink', state: 'lost' })
    expect(getState().link).toBe('server-lost')
    expect(getState().phase).toBe('game')
    expect(gameEventOrder('g1', 3)).toBe('unknown')
    handleServerLink({ type: 'serverLink', state: 'retrying', attempt: 2 })
    expect(getState().linkAttempt).toBe(2)
    handleServerLink({ type: 'serverLink', state: 'restored', attempt: 2 })
    expect(getState().link).toBe('ok')
    expect(cmds.joinGame).toHaveBeenCalledWith('g1')
  })

  it('tells the player when another login of the account took the session over', () => {
    attachStub()
    setState({ conn, phase: 'game', gameId: 'g1' } as never)
    handleServerLink({ type: 'serverLink', state: 'failed' })
    const generic = getState().error
    handleServerLink({ type: 'serverLink', state: 'failed', reason: 'superseded' })
    expect(getState().error).toBeTruthy()
    expect(getState().error).not.toBe(generic)
  })

  it('serverLink frames reach the handler through the gateway', () => {
    const g = attachStub()
    setState({ conn, phase: 'lobby' } as never)
    g.events.onMessage?.({ type: 'serverLink', state: 'lost' })
    expect(getState().link).toBe('server-lost')
    g.events.onMessage?.({ type: 'serverLink', state: 'failed' })
    expect(getState().link).toBe('ok')
    expect(getState().error).toBeTruthy()
  })
})

describe('isSameAccount', () => {
  it('matches the saved account case-insensitively and nothing else', () => {
    expect(isSameAccount(conn, 'H', 17171, 'U')).toBe(true)
    expect(isSameAccount(conn, 'h', 17172, 'u')).toBe(false)
    expect(isSameAccount(conn, 'other', 17171, 'u')).toBe(false)
    expect(isSameAccount(conn, 'h', 17171, 'someone')).toBe(false)
    expect(isSameAccount(null, 'h', 17171, 'u')).toBe(false)
  })
})
