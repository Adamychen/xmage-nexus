import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, fireEvent, cleanup, act } from '@testing-library/react'
import RollbackVoteDialog, { ROLLBACK_AUTO_DISMISS_MS, ROLLBACK_HIDE_AFTER_MS } from './RollbackVoteDialog'
import { setState, getState } from '../state/state'
import { reset, isBlockingModal } from '../state/store'
import type { RollbackVote } from '../state/store'
import { makeGameView, makePlayer } from '../__fixtures__/gameViews'
import * as cmds from '../net/commands'

vi.mock('../net/commands', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../net/commands')>()
  return {
    ...actual,
    sendPlayerAction: vi.fn().mockResolvedValue({ ok: true }),
    sendChatMessage: vi.fn().mockResolvedValue({ ok: true }),
  }
})

function vote(partial: Partial<RollbackVote> = {}): RollbackVote {
  return {
    gameId: 'g-1',
    requester: 'Alice',
    requesterUserId: 'u-alice',
    requestedByMe: false,
    turns: 0,
    requestedAtTurn: 3,
    voters: [
      { name: 'Alice', status: 'requested', me: false },
      { name: 'Bob', status: 'pending', me: true },
      { name: 'Carol', status: 'accepted', me: false },
      { name: 'Dave', status: 'pending', me: false },
    ],
    myVote: 'pending',
    outcome: 'voting',
    hidden: false,
    startedAt: Date.now(),
    ...partial,
  }
}

const statusOf = () => screen.getAllByTestId('rollback-voter').map((el) => el.getAttribute('data-status'))

describe('RollbackVoteDialog', () => {
  beforeEach(() => {
    reset()
    vi.clearAllMocks()
    setState({
      gameId: 'g-1',
      gameChatId: 'c-1',
      game: makeGameView({ turn: 3, players: [makePlayer({ playerId: 'p-bob', name: 'Bob', controlled: true })] }),
    })
  })

  afterEach(() => {
    cleanup()
    vi.useRealTimers()
  })

  it('renders nothing without a vote and blocks the board while one is shown', () => {
    const { container } = render(<RollbackVoteDialog />)
    expect(container.innerHTML).toBe('')
    expect(isBlockingModal(getState())).toBe(false)
    act(() => setState({ rollbackVote: vote() }))
    expect(screen.getByTestId('rollback-vote')).toBeTruthy()
    expect(isBlockingModal(getState())).toBe(true)
  })

  it('lists every player with their vote status', () => {
    setState({ rollbackVote: vote() })
    render(<RollbackVoteDialog />)
    expect(screen.getAllByTestId('rollback-voter').map((el) => el.textContent)).toEqual([
      expect.stringContaining('Alice'),
      expect.stringContaining('Bob'),
      expect.stringContaining('Carol'),
      expect.stringContaining('Dave'),
    ])
    expect(statusOf()).toEqual(['requested', 'pending', 'accepted', 'pending'])
    expect(screen.getByTestId('rollback-vote-outcome').getAttribute('data-outcome')).toBe('voting')
  })

  it('Accept sends the vote, announces it and switches to waiting', async () => {
    setState({ rollbackVote: vote() })
    render(<RollbackVoteDialog />)
    await act(async () => {
      fireEvent.click(screen.getByTestId('rollback-vote-accept'))
    })
    expect(cmds.sendPlayerAction).toHaveBeenCalledWith('ADD_PERMISSION_TO_ROLLBACK_TURN', 'g-1', 'u-alice')
    expect(cmds.sendChatMessage).toHaveBeenCalled()
    expect(statusOf()).toEqual(['requested', 'accepted', 'accepted', 'pending'])
    expect(screen.queryByTestId('rollback-vote-accept')).toBeNull()
    expect(screen.queryByTestId('rollback-vote-close')).toBeNull()
  })

  it('Deny sends the deny action and shows the denied outcome', async () => {
    setState({ rollbackVote: vote() })
    render(<RollbackVoteDialog />)
    await act(async () => {
      fireEvent.click(screen.getByTestId('rollback-vote-deny'))
    })
    expect(cmds.sendPlayerAction).toHaveBeenCalledWith('DENY_PERMISSION_TO_ROLLBACK_TURN', 'g-1', 'u-alice')
    expect(screen.getByTestId('rollback-vote-outcome').getAttribute('data-outcome')).toBe('denied')
    expect(screen.getByTestId('rollback-vote-close')).toBeTruthy()
  })

  it('after the resolution Close dismisses it, and it auto-dismisses otherwise', () => {
    vi.useFakeTimers()
    setState({ rollbackVote: vote({ outcome: 'applied', appliedTurn: 3, myVote: 'accepted' }) })
    render(<RollbackVoteDialog />)
    expect(screen.getByTestId('rollback-vote-outcome').getAttribute('data-outcome')).toBe('applied')
    act(() => { vi.advanceTimersByTime(ROLLBACK_AUTO_DISMISS_MS + 10) })
    expect(getState().rollbackVote).toBeNull()

    act(() => setState({ rollbackVote: vote({ outcome: 'denied', deniedBy: 'Dave', myVote: 'accepted' }) }))
    fireEvent.click(screen.getByTestId('rollback-vote-close'))
    expect(getState().rollbackVote).toBeNull()
  })

  it('while waiting on others, the hide escape appears only after a while', () => {
    vi.useFakeTimers()
    setState({ rollbackVote: vote({ myVote: 'accepted' }) })
    render(<RollbackVoteDialog />)
    expect(screen.queryByTestId('rollback-vote-hide')).toBeNull()
    act(() => { vi.advanceTimersByTime(ROLLBACK_HIDE_AFTER_MS + 10) })
    fireEvent.click(screen.getByTestId('rollback-vote-hide'))
    expect(getState().rollbackVote?.hidden).toBe(true)
    expect(screen.queryByTestId('rollback-vote')).toBeNull()
    expect(isBlockingModal(getState())).toBe(false)
  })

  it('warns when the game moved on past the turn of the request', () => {
    setState({
      rollbackVote: vote({ myVote: 'accepted' }),
      game: makeGameView({ turn: 4, players: [makePlayer({ playerId: 'p-bob', name: 'Bob', controlled: true })] }),
    })
    render(<RollbackVoteDialog />)
    expect(screen.getByRole('alert').textContent).toMatch(/4/)
  })
})
