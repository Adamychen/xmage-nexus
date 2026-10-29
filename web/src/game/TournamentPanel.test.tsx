import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import TournamentPanel from './TournamentPanel'
import ConfirmHost from '../ui/ConfirmHost'
import { setState } from '../state/store'
import { getState } from '../state/state'
import { switchLanguage } from '../i18n'
import type { ChatMessageEvent, TournamentPlayerView, TournamentView } from '../net/types'
import { getTournament, quitTournament } from '../net/commands'

vi.mock('../net/commands', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../net/commands')>()),
  getTournament: vi.fn(async () => null),
  getTournamentChatId: vi.fn(async () => null),
  quitTournament: vi.fn(async () => ({ ok: true })),
}))
vi.mock('../lobby/ChatBox', () => ({
  default: () => <div data-testid="chat-box-stub">Chat Stub</div>,
}))

const NAME = 'Modern Swiss #7'

function player(name: string, points: number, state = 'Dueling'): TournamentPlayerView {
  return { name, flagName: 'es', state, points, results: '', history: '', quit: false }
}

function duelView(overrides: Partial<TournamentView> = {}): TournamentView {
  const now = Date.now()
  return {
    tournamentName: NAME,
    tournamentType: 'Constructed Swiss / Constructed - Modern 3 rounds',
    tournamentState: 'Dueling',
    startTime: now - 3600_000,
    endTime: null,
    stepStartTime: now - 90_000,
    serverTime: now,
    constructionTime: 600,
    watchingAllowed: true,
    rounds: [
      {
        games: [
          { roundNum: 1, players: 'alice - bob', state: 'Finished (12:30)', result: 'Player alice is the winner', tableId: 't-r1', matchId: 'm-r1' },
          { roundNum: 1, players: 'alice - bob', state: 'Finished (10:02)', result: 'Player alice is the winner', tableId: 't-r1', matchId: 'm-r1' },
        ],
      },
      {
        games: [
          { roundNum: 2, players: 'alice - bob', state: 'Finished (9:02)', result: 'Player alice is the winner', tableId: 't-r2', matchId: 'm-r2' },
          { roundNum: 2, players: 'alice - bob', state: 'Dueling (3:10)', result: '', tableId: 't-r2', matchId: 'm-r2', gameId: 'g-live' },
          { roundNum: 2, players: 'charlie - diana', state: 'Finished (7:00)', result: 'Player diana is the winner', tableId: 't-r2b', matchId: 'm-r2b' },
        ],
      },
    ],
    players: [player('alice', 6), player('bob', 0, 'Eliminated'), player('charlie', 3), player('diana', 3)],
    runningInfo: '',
    ...overrides,
  } as TournamentView
}

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
  setState({ tournament: null, construct: null, draftOverAt: null, tournamentChatId: null, conn: undefined } as never)
})

const mockStorage: Record<string, string> = {}

beforeEach(async () => {
  await switchLanguage('en')
  for (const k of Object.keys(mockStorage)) delete mockStorage[k]
  vi.stubGlobal('localStorage', {
    getItem: (key: string) => mockStorage[key] ?? null,
    setItem: (key: string, value: string) => {
      mockStorage[key] = String(value)
    },
    removeItem: (key: string) => {
      delete mockStorage[key]
    },
  })
  vi.mocked(quitTournament).mockClear()
})

function pointerEvent(type: string, init: { clientX: number; clientY: number }) {
  return new window.MouseEvent(type, { bubbles: true, cancelable: true, button: 0, ...init })
}

function setViewer(username: string | undefined) {
  setState({ conn: username ? { username } : undefined } as never)
}

function openPanel(view: TournamentView = duelView(), extra: Record<string, unknown> = {}) {
  setState({ tournament: { tournamentId: 't1', view }, construct: null, draftOverAt: null, ...extra } as never)
  return render(<TournamentPanel />)
}

function showMini(view: TournamentView = duelView()) {
  const utils = openPanel(view)
  fireEvent.click(screen.getByTestId('tournament-panel-collapse'))
  return utils
}

describe('TournamentPanel — docked side panel (TRN-17)', () => {
  it('TRN-17: the expanded panel is a docked complementary region, not a modal: no dialog role, no backdrop, no aria-modal', () => {
    setViewer('zoe')
    openPanel()
    expect(screen.queryByRole('dialog')).toBeNull()
    const panel = screen.getByRole('complementary', { name: NAME })
    expect(panel.getAttribute('aria-modal')).toBeNull()
    expect(panel.classList.contains('is-docked')).toBe(true)
    expect(panel.getAttribute('data-testid')).toBe('tournament-panel')
    expect(document.querySelector('.tournament-panel-backdrop')).toBeNull()
  })

  it('TRN-17: the tournament name is shown once, as the panel heading', () => {
    setViewer('zoe')
    openPanel()
    const panel = screen.getByTestId('tournament-panel')
    expect(panel.textContent?.split(NAME).length).toBe(2)
    expect(screen.getByRole('heading', { name: NAME })).toBe(screen.getByTestId('tournament-panel-name'))
    expect(screen.getByTestId('tournament-panel-kicker').textContent).toContain('Round 2')
  })

  it('TRN-17: the tabs switch between Standings, Rounds and Chat, and the rounds are the default', () => {
    setViewer('zoe')
    openPanel()
    act(() => setState({ tournamentChatId: 'chat-1' } as never))
    expect(screen.getByRole('tab', { name: 'Rounds' }).getAttribute('aria-selected')).toBe('true')
    expect(screen.getByTestId('bracket-round')).toBeDefined()
    fireEvent.click(screen.getByRole('tab', { name: 'Standings' }))
    expect(screen.getByTestId('standings-table')).toBeDefined()
    expect(screen.queryByTestId('bracket-round')).toBeNull()
    fireEvent.click(screen.getByRole('tab', { name: 'Chat' }))
    expect(screen.queryByTestId('standings-table')).toBeNull()
    expect(screen.queryByTestId('bracket-round')).toBeNull()
  })

  it('TRN-17: the chat tab renders the tournament chat inside the panel', () => {
    setViewer('zoe')
    openPanel()
    act(() => setState({ tournamentChatId: 'chat-1' } as never))
    fireEvent.click(screen.getByRole('tab', { name: 'Chat' }))
    const chat = screen.getByTestId('tournament-panel-chat')
    expect(within(chat).getByTestId('chat-box-stub')).toBeDefined()
    expect(screen.getByTestId('tournament-panel').contains(chat)).toBe(true)
  })

  it('TRN-17: Escape collapses the panel to the pill and focus returns to the pill', () => {
    setViewer('zoe')
    openPanel()
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(screen.queryByTestId('tournament-panel')).toBeNull()
    const pill = screen.getByTestId('tournament-panel-mini')
    expect(document.activeElement).toBe(pill)
  })

  it('TRN-17: the minimize button collapses the panel and the pill expands it again with focus in the panel', () => {
    setViewer('zoe')
    openPanel()
    fireEvent.click(screen.getByRole('button', { name: 'Minimize' }))
    expect(screen.queryByTestId('tournament-panel')).toBeNull()
    fireEvent.click(screen.getByTestId('tournament-panel-mini'))
    expect(screen.getByTestId('tournament-panel')).toBeDefined()
    expect(screen.getByTestId('tournament-panel').contains(document.activeElement)).toBe(true)
  })

  it('TRN-17: the close button collapses the panel as well', () => {
    setViewer('zoe')
    openPanel()
    fireEvent.click(screen.getByRole('button', { name: 'Close' }))
    expect(screen.getByTestId('tournament-panel-mini')).toBeDefined()
  })

  it('TRN-17: a participant sees the pill with the round, the match score and the position', () => {
    setViewer('alice')
    showMini()
    const mini = screen.getByTestId('tournament-panel-mini')
    expect(screen.getByTestId('tournament-mini-round').textContent).toBe('R2')
    expect(screen.getByTestId('tournament-mini-score').textContent).toBe('alice 1–0 bob')
    expect(screen.getByTestId('tournament-mini-standing').textContent).toBe('1st · 6 points')
    expect(mini.textContent).not.toContain('Dueling')
  })

  it('TRN-17: a spectator sees the pill with the name and the phase', () => {
    setViewer('zoe')
    showMini()
    const mini = screen.getByTestId('tournament-panel-mini') as HTMLElement
    expect(mini.textContent).toContain(`${NAME} — Dueling`)
    expect(screen.queryByTestId('tournament-mini-score')).toBeNull()
  })

  it('TRN-17: a participant between rounds sees the pill with the name and the phase', () => {
    setViewer('bob')
    const rounds = duelView().rounds
    showMini(duelView({ rounds: [rounds[0], { games: [rounds[1].games[2]] }] }))
    expect(screen.queryByTestId('tournament-mini-score')).toBeNull()
    expect((screen.getByTestId('tournament-panel-mini') as HTMLElement).textContent).toContain(`${NAME} — Dueling`)
  })

  it('TRN-17: the pill shows the tournament state in English, not the raw server text', () => {
    setViewer('zoe')
    showMini(duelView({ tournamentState: 'Drafting', rounds: [] }))
    const mini = screen.getByTestId('tournament-panel-mini') as HTMLElement
    expect(mini.textContent).toContain('Drafting')
    expect(mini.textContent).not.toContain('En draft')
  })

  it('TRN-17: the pill remains draggable, keeps its position and does not open the panel after a drag', () => {
    setViewer('zoe')
    showMini()
    const mini = screen.getByTestId('tournament-panel-mini') as HTMLElement
    fireEvent(mini, pointerEvent('pointerdown', { clientX: 100, clientY: 100 }))
    fireEvent(mini, pointerEvent('pointermove', { clientX: 200, clientY: 150 }))
    fireEvent(mini, pointerEvent('pointerup', { clientX: 200, clientY: 150 }))
    expect(mini.style.left).toBe('100px')
    expect(mini.style.top).toBe('50px')
    expect(JSON.parse(localStorage.getItem('tournament_mini_pos') as string)).toEqual({ left: 100, top: 50 })
    fireEvent.click(mini)
    expect(screen.queryByTestId('tournament-panel')).toBeNull()
    fireEvent.click(mini)
    expect(screen.getByTestId('tournament-panel')).toBeDefined()
  })

  it('TRN-17: a saved pill position outside the window is clamped back into view', () => {
    localStorage.setItem('tournament_mini_pos', JSON.stringify({ left: 5000, top: 5000 }))
    setViewer('zoe')
    showMini()
    const mini = screen.getByTestId('tournament-panel-mini') as HTMLElement
    expect(mini.style.left).toBe('696px')
    expect(mini.style.top).toBe('724px')
  })

  it('TRN-17: a stalled construction after the draft shows the banner in the panel', () => {
    setViewer('zoe')
    setState({ tournament: { tournamentId: 't1', view: duelView() }, construct: null, draftOverAt: Date.now() - 60000 } as never)
    render(<TournamentPanel />)
    expect(screen.getByTestId('tournament-stalled-banner')).toBeDefined()
  })

  it('TRN-17: no stalled banner with a recent draft over or once the construct has arrived', () => {
    setViewer('zoe')
    setState({ tournament: { tournamentId: 't1', view: duelView() }, construct: null, draftOverAt: Date.now() } as never)
    const { unmount } = render(<TournamentPanel />)
    expect(screen.queryByTestId('tournament-stalled-banner')).toBeNull()
    unmount()
    cleanup()
    setState({
      tournament: { tournamentId: 't1', view: duelView() },
      construct: { deckName: 'Pool', pool: {}, tableId: 't1', parentTableId: null, timeLeft: 600 },
      draftOverAt: Date.now() - 60000,
    } as never)
    render(<TournamentPanel />)
    expect(screen.queryByTestId('tournament-stalled-banner')).toBeNull()
  })
})

describe('TournamentPanel — one leave action (TRN-16)', () => {
  it('TRN-16: a participant has exactly one leave button in the panel, and it asks for confirmation first', async () => {
    setViewer('alice')
    setState({ tournament: { tournamentId: 't1', view: duelView() }, construct: null, draftOverAt: null } as never)
    render(
      <>
        <TournamentPanel />
        <ConfirmHost />
      </>,
    )
    const panel = screen.getByTestId('tournament-panel')
    const leaves = within(panel).getAllByRole('button').filter((b) => /leave/i.test(b.textContent ?? ''))
    expect(leaves).toHaveLength(1)
    fireEvent.click(leaves[0])
    expect(await screen.findByTestId('confirm-modal')).not.toBeNull()
    expect(quitTournament).not.toHaveBeenCalled()
    fireEvent.click(screen.getByTestId('confirm-modal-ok'))
    await waitFor(() => expect(quitTournament).toHaveBeenCalledWith('t1'))
  })

  it('TRN-16: a spectator gets no leave action in the panel', () => {
    setViewer('zoe')
    openPanel()
    expect(screen.queryByTestId('tournament-panel-quit')).toBeNull()
    expect(screen.getByTestId('tournament-panel').textContent).not.toMatch(/leave/i)
  })
})

describe('TournamentPanel — live refresh (TRN-15)', () => {
  it('TRN-15: says Updated N s ago in the footer, and the pill polls getTournament with the joined id', async () => {
    vi.useFakeTimers()
    vi.clearAllMocks()
    try {
      vi.mocked(getTournament).mockResolvedValue(duelView({ rounds: [{ games: [] }] }) as never)
      setViewer('zoe')
      setState({ tournament: { tournamentId: 't1', view: duelView() } } as never)
      render(<TournamentPanel />)
      expect(screen.getByTestId('tournament-updated').textContent).toBe('Updated 0 s ago')
      expect(vi.mocked(getTournament)).not.toHaveBeenCalled()
      await act(async () => {
        await vi.advanceTimersByTimeAsync(8000)
      })
      expect(vi.mocked(getTournament)).toHaveBeenCalledWith('t1')
      expect((getState().tournament?.view as { rounds: unknown[] } | undefined)?.rounds).toHaveLength(1)
    } finally {
      vi.useRealTimers()
    }
  })

  it('TRN-15: does not overwrite the view when the tournament changed before the poll answered', async () => {
    vi.useFakeTimers()
    vi.clearAllMocks()
    try {
      vi.mocked(getTournament).mockImplementation(async (tid: string) => {
        await new Promise((r) => setTimeout(r, 10))
        return duelView({ tournamentName: tid, rounds: [] }) as never
      })
      setState({ tournament: { tournamentId: 't1', view: duelView() } } as never)
      render(<TournamentPanel />)
      setState({ tournament: { tournamentId: 't2', view: duelView({ tournamentName: 'Other' }) } } as never)
      await act(async () => {
        await vi.advanceTimersByTimeAsync(20000)
      })
      for (const call of vi.mocked(getTournament).mock.calls) {
        expect(call[0]).not.toBe('t1')
      }
      expect(getState().tournament?.tournamentId).toBe('t2')
    } finally {
      vi.useRealTimers()
    }
  })
})

describe('TournamentPanel — unread tournament chat (TRN-20)', () => {
  const CHAT_ID = 'chat-1'

  function talk(username: string, message = 'hello'): ChatMessageEvent {
    return { chatId: CHAT_ID, username, message, messageType: 'TALK' }
  }

  function receive(...messages: ChatMessageEvent[]) {
    act(() => setState({ chatMessages: [...getState().chatMessages, ...messages] } as never))
  }

  function openWithChat(extra: Record<string, unknown> = {}) {
    setViewer('zoe')
    const utils = openPanel(duelView(), { chatMessages: [], ...extra })
    act(() => setState({ tournamentChatId: CHAT_ID } as never))
    return utils
  }

  afterEach(() => {
    setState({ chatMessages: [] } as never)
  })

  it('TRN-20: a message that arrives while another tab is showing badges the Chat tab', () => {
    openWithChat()
    expect(screen.getByRole('tab', { name: 'Rounds' }).getAttribute('aria-selected')).toBe('true')
    receive(talk('bob', 'anyone up for a rematch?'))
    const badge = within(screen.getByTestId('tournament-panel-tab-chat')).getByTestId('tournament-panel-tab-chat-unread')
    expect(badge.textContent).toBe('1')
    expect(badge.getAttribute('aria-label')).toBe('Unread messages: 1')
  })

  it('TRN-20: the collapsed pill shows the same count', () => {
    openWithChat()
    fireEvent.click(screen.getByTestId('tournament-panel-collapse'))
    receive(talk('bob'), talk('carol'))
    expect(screen.getByTestId('tournament-mini-unread').textContent).toBe('2')
  })

  it('TRN-20: above nine the badge says 9+ while the label keeps the exact count', () => {
    openWithChat()
    receive(...Array.from({ length: 9 }, (_, i) => talk('bob', `m${i}`)))
    expect(screen.getByTestId('tournament-panel-tab-chat-unread').textContent).toBe('9')
    receive(talk('bob', 'tenth'))
    const badge = screen.getByTestId('tournament-panel-tab-chat-unread')
    expect(badge.textContent).toBe('9+')
    expect(badge.getAttribute('aria-label')).toBe('Unread messages: 10')
  })

  it('TRN-20: opening the Chat tab clears the count, and messages seen there are not counted after switching away', () => {
    openWithChat()
    receive(talk('bob'), talk('carol'))
    expect(screen.getByTestId('tournament-panel-tab-chat-unread').textContent).toBe('2')
    fireEvent.click(screen.getByTestId('tournament-panel-tab-chat'))
    expect(screen.queryByTestId('tournament-panel-tab-chat-unread')).toBeNull()
    receive(talk('dave'))
    expect(screen.queryByTestId('tournament-panel-tab-chat-unread')).toBeNull()
    fireEvent.click(screen.getByRole('tab', { name: 'Standings' }))
    receive(talk('erin'))
    expect(screen.getByTestId('tournament-panel-tab-chat-unread').textContent).toBe('1')
  })

  it('TRN-20: opening the panel from the pill with the Chat tab selected clears the pill count', () => {
    openWithChat()
    fireEvent.click(screen.getByTestId('tournament-panel-tab-chat'))
    fireEvent.click(screen.getByTestId('tournament-panel-collapse'))
    receive(talk('bob'))
    expect(screen.getByTestId('tournament-mini-unread').textContent).toBe('1')
    fireEvent.click(screen.getByTestId('tournament-panel-mini'))
    expect(screen.queryByTestId('tournament-mini-unread')).toBeNull()
    expect(screen.queryByTestId('tournament-panel-tab-chat-unread')).toBeNull()
  })

  it('TRN-20: your own messages and system lines do not show a badge', () => {
    openWithChat()
    receive(
      talk('zoe', 'my own line'),
      { chatId: CHAT_ID, username: '', message: 'carol has joined', messageType: 'SYSTEM' },
      { chatId: CHAT_ID, username: 'server', message: 'Round 2 starts', messageType: 'TALK' },
      { chatId: 'room-chat', username: 'bob', message: 'in another chat', messageType: 'TALK' },
    )
    expect(screen.queryByTestId('tournament-panel-tab-chat-unread')).toBeNull()
  })

  it('TRN-20: history received before the panel opened is not counted as unread', () => {
    openWithChat({ chatMessages: [talk('bob', 'old'), talk('carol', 'older')] })
    expect(screen.queryByTestId('tournament-panel-tab-chat-unread')).toBeNull()
    receive(talk('dave'))
    expect(screen.getByTestId('tournament-panel-tab-chat-unread').textContent).toBe('1')
  })
})
