import { describe, expect, it, vi, beforeEach } from 'vitest'
import { attachGateway } from './gateway'
import { setState } from './state'
import { reset } from './store'
import * as cmds from '../net/commands'

vi.mock('../net/commands', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../net/commands')>()
  return {
    ...actual,
    connect: vi.fn(),
    joinDraft: vi.fn(),
    joinTournament: vi.fn(),
  }
})

describe('attachGateway — re-unión al reconectar', () => {
  beforeEach(() => {
    reset()
    vi.mocked(cmds.connect).mockReset().mockResolvedValue({ ok: true } as never)
    vi.mocked(cmds.joinDraft).mockReset().mockResolvedValue({ ok: true } as never)
    vi.mocked(cmds.joinTournament).mockReset().mockResolvedValue({ ok: true } as never)
  })

  async function attachStub() {
    const events: { onOpen?: () => void } = {}
    attachGateway({ events, close: vi.fn() } as never)
    return events
  }

  it('re-une draft y torneo activos tras el re-login', async () => {
    const events = await attachStub()
    setState({
      conn: { serverHost: 'h', port: 1, username: 'u', password: 'x' },
      phase: 'lobby',
      draft: { draftId: 'd1', message: {} },
      tournament: { tournamentId: 't1', view: {} },
    } as never)
    await events.onOpen?.()
    expect(cmds.connect).toHaveBeenCalled()
    expect(cmds.joinTournament).toHaveBeenCalledWith('t1')
    expect(cmds.joinDraft).toHaveBeenCalledWith('d1')
  })

  it('sin draft/torneo no re-une nada', async () => {
    const events = await attachStub()
    setState({
      conn: { serverHost: 'h', port: 1, username: 'u', password: 'x' },
      phase: 'lobby',
      draft: null,
      tournament: null,
    } as never)
    await events.onOpen?.()
    expect(cmds.connect).toHaveBeenCalled()
    expect(cmds.joinTournament).not.toHaveBeenCalled()
    expect(cmds.joinDraft).not.toHaveBeenCalled()
  })

  it('en primer login (connecting) no hace nada', async () => {
    const events = await attachStub()
    setState({ conn: null, phase: 'connecting' } as never)
    await events.onOpen?.()
    expect(cmds.connect).not.toHaveBeenCalled()
  })
})
