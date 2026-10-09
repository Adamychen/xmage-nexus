import { describe, expect, it, vi, beforeEach } from 'vitest'
import { attachGateway } from './gateway'
import { getState, setState } from './state'
import { reset } from './store'
import { clearActiveDraft, loadActiveDraft, saveActiveDraft, saveActiveGame, loadActiveGame, clearActiveGame } from './persistence'
import * as cmds from '../net/commands'

vi.mock('../net/commands', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../net/commands')>()
  return {
    ...actual,
    connect: vi.fn(),
    joinDraft: vi.fn(),
    joinTournament: vi.fn(),
    joinGame: vi.fn(),
    watchGame: vi.fn(),
    getGameChatId: vi.fn(),
  }
})

describe('attachGateway — re-unión al reconectar', () => {
  beforeEach(() => {
    reset()
    vi.mocked(cmds.connect).mockReset().mockResolvedValue({ ok: true } as never)
    vi.mocked(cmds.joinDraft).mockReset().mockResolvedValue({ ok: true } as never)
    vi.mocked(cmds.joinTournament).mockReset().mockResolvedValue({ ok: true } as never)
    vi.mocked(cmds.joinGame).mockReset().mockResolvedValue({ ok: true } as never)
    vi.mocked(cmds.watchGame).mockReset().mockResolvedValue({ ok: true } as never)
    vi.mocked(cmds.getGameChatId).mockReset().mockResolvedValue(null as never)
  })

  async function attachStub() {
    const events: { onOpen?: () => void } = {}
    attachGateway({ events, close: vi.fn(), resumeToken: () => null, isOpen: true } as never)
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

  const snapshot = (id: string, picking = true) =>
    ({ draftId: id, message: { draftView: { boosterNum: 1 }, draftPickView: { picking } } }) as never

  it('tras recargar (sin estado en memoria) re-pinta la instantánea y re-une draft y torneo', async () => {
    const events = await attachStub()
    saveActiveDraft(snapshot('draft-persisted'), 't-persisted')
    setState({
      conn: { serverHost: 'h', port: 1, username: 'u', password: 'x' },
      phase: 'lobby',
      draft: null,
      tournament: null,
    } as never)
    await events.onOpen?.()
    const restored = getState()
    expect(restored.draft?.draftId).toBe('draft-persisted')
    expect(restored.lastDraftMethod).toBe('DRAFT_INIT')
    expect(typeof restored.lastDraftEventAt).toBe('number')
    expect(cmds.joinDraft).toHaveBeenCalledWith('draft-persisted')
    expect(cmds.joinTournament).toHaveBeenCalledWith('t-persisted')
  })

  it('la instantánea en espera no habilita el pick (sin DRAFT_PICK fresco)', async () => {
    const events = await attachStub()
    saveActiveDraft(snapshot('draft-persisted', false))
    setState({
      conn: { serverHost: 'h', port: 1, username: 'u', password: 'x' },
      phase: 'lobby',
      draft: null,
      tournament: null,
    } as never)
    await events.onOpen?.()
    expect(getState().draft?.draftId).toBe('draft-persisted')
    expect(getState().lastDraftMethod).toBeNull()
  })

  it('si joinDraft falla (draft ya terminado) descarta la instantánea persistida', async () => {
    vi.mocked(cmds.joinDraft).mockResolvedValue({ ok: false } as never)
    const events = await attachStub()
    saveActiveDraft(snapshot('draft-viejo'), 't-viejo')
    setState({
      conn: { serverHost: 'h', port: 1, username: 'u', password: 'x' },
      phase: 'lobby',
      draft: null,
      tournament: null,
    } as never)
    await events.onOpen?.()
    await vi.waitFor(() => expect(loadActiveDraft()).toBeNull())
    await vi.waitFor(() => expect(getState().draft).toBeNull())
  })

  it('reset limpia el draft persistido', () => {
    saveActiveDraft(snapshot('draft-persisted'), 't-persisted')
    expect(loadActiveDraft()).not.toBeNull()
    reset()
    expect(loadActiveDraft()).toBeNull()
    clearActiveDraft()
  })

  // A restore that quietly gives up reads to the player as "the client broke": the board
  // disappears and nothing says why. Both of these used to land silently.
  it('si la partida ya no está, baja al lobby y dice por qué', async () => {
    vi.mocked(cmds.joinGame).mockResolvedValue({ ok: false, error: 'game not found' } as never)
    const events = await attachStub()
    saveActiveGame('g-cerrada')
    setState({
      conn: { serverHost: 'h', port: 1, username: 'u', password: 'x' },
      phase: 'game',
      gameId: 'g-cerrada',
      game: { turn: 3 },
      resumingGameId: 'g-cerrada',
    } as never)

    await events.onOpen?.()

    await vi.waitFor(() => expect(getState().phase).toBe('lobby'))
    expect(getState().error).toBeTruthy()
    expect(getState().game).toBeNull()
    expect(loadActiveGame()).toBeNull()
  })

  it('si el partido que veías acabó, también lo dice', async () => {
    vi.mocked(cmds.watchGame).mockResolvedValue({ ok: false } as never)
    const events = await attachStub()
    saveActiveGame('g-vista', null, 'watcher')
    setState({
      conn: { serverHost: 'h', port: 1, username: 'u', password: 'x' },
      phase: 'game',
      gameId: 'g-vista',
      game: { turn: 2 },
    } as never)

    await events.onOpen?.()

    await vi.waitFor(() => expect(getState().error).toBeTruthy())
    expect(getState().phase).toBe('lobby')
    expect(loadActiveGame()).toBeNull()
    clearActiveGame()
  })
})
