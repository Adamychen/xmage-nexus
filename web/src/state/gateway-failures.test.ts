import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { attachGateway, handleServerLink, RELOGIN_RETRIES } from './gateway'
import { getState, setState } from './state'
import { reset } from './store'
import { saveActiveDraft, loadActiveDraft } from './persistence'
import { handleTournamentOver } from './events/tournament'
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

function attachStub() {
  const g = {
    events: {} as { onOpen?: () => Promise<void> | void; onClose?: (r: string) => void; onMessage?: (m: unknown) => void },
    close: vi.fn(),
    resumeToken: () => null,
    isOpen: true,
  }
  attachGateway(g as never)
  return g
}

describe('re-login chains and tournament restore', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    reset()
    vi.mocked(cmds.connect).mockReset().mockResolvedValue({ ok: true, data: { attached: true } } as never)
    vi.mocked(cmds.joinGame).mockReset().mockResolvedValue({ ok: true } as never)
    vi.mocked(cmds.joinTournament).mockReset().mockResolvedValue({ ok: true } as never)
    vi.mocked(cmds.joinDraft).mockReset().mockResolvedValue({ ok: true } as never)
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('a drop and reopen during the re-login back-off leaves one re-login chain per open', async () => {
    const g = attachStub()
    setState({ conn, phase: 'lobby' } as never)
    vi.mocked(cmds.connect).mockResolvedValue({ ok: false, error: 'boom' } as never)
    const first = g.events.onOpen?.()
    await vi.advanceTimersByTimeAsync(500)
    const second = g.events.onOpen?.()
    await vi.advanceTimersByTimeAsync(1100)
    expect(cmds.connect).toHaveBeenCalledTimes(2)
    await vi.advanceTimersByTimeAsync(120_000)
    await Promise.all([first, second])
    expect(cmds.connect).toHaveBeenCalledTimes(1 + RELOGIN_RETRIES)
  })

  it('a finished tournament is not joined again on the next restore', async () => {
    attachStub()
    setState({ conn, phase: 'lobby', tournament: { tournamentId: 'tournament-1', view: {} } } as never)
    saveActiveDraft({ draftId: 'draft-1', message: {} } as never, 'tournament-1')
    handleTournamentOver({ message: 'Torneo terminado' })
    expect(getState().tournament).toBeNull()
    expect(loadActiveDraft()?.tournamentId ?? null).toBeNull()
    handleServerLink({ type: 'serverLink', state: 'restored' } as never)
    expect(cmds.joinTournament).not.toHaveBeenCalled()
  })
})
