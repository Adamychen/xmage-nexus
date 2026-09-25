import { beforeEach, describe, expect, it, vi } from 'vitest'
import { makeCard, makeGameView, makePlayer } from '../__fixtures__/gameViews'
import type { GameView } from '../net/types'
import { getState, setState } from './state'
import { handleMessage, requestRollback, voteRollback, maybeAutoPass, isRollbackPending, hideRollbackVote } from './store'
import { reset } from './gateway'
import { ROLLBACK_ACCEPT_CHAT, ROLLBACK_PENDING_TTL_MS, parseRollbackTurns, rollbackAcceptChatText, isRollbackAcceptChat } from './rollbackVote'
import * as cmds from '../net/commands'
import { togglePhaseStop } from '../game/phaseStops'

vi.mock('../net/commands', () => ({
  setGateway: vi.fn(),
  getGateway: vi.fn(),
  joinGame: vi.fn(),
  getGameChatId: vi.fn().mockResolvedValue(undefined),
  joinChat: vi.fn(),
  sendChatMessage: vi.fn().mockResolvedValue({ ok: true }),
  sendPlayerAction: vi.fn().mockResolvedValue({ ok: true }),
  sendPlayerBoolean: vi.fn(),
  sendPlayerUUID: vi.fn(),
}))

const GAME = 'g-4p'
const NAMES = ['Alice', 'Bob', 'Carol', 'Dave']

function commander(opts: { me: string; turn: number; step?: string; priority?: string }): GameView {
  return makeGameView({
    turn: opts.turn,
    phase: opts.step === 'UPKEEP' ? 'BEGINNING' : 'PRECOMBAT_MAIN',
    step: opts.step ?? 'PRECOMBAT_MAIN',
    rollbackTurnsAllowed: true,
    myPlayerId: `p-${opts.me}`,
    myHand: { h1: makeCard({ id: 'h1', name: 'Sol Ring' }) },
    players: NAMES.map((name) =>
      makePlayer({ playerId: `p-${name}`, name, controlled: name === opts.me, hasPriority: name === (opts.priority ?? 'Alice') }),
    ),
  })
}

function update(view: GameView, id = 10) {
  handleMessage({ type: 'event', method: 'GAME_UPDATE', messageId: id, objectId: GAME, data: view })
}

function chat(username: string, message: string, messageType: 'TALK' | 'GAME' = 'TALK', id = 50) {
  handleMessage({
    type: 'event',
    method: 'CHATMESSAGE',
    messageId: id,
    objectId: 'c-4p',
    data: { chatId: 'c-4p', username, message, messageType },
  } as never)
}

function incomingRequest(from: string, message: string, id = 20) {
  handleMessage({
    type: 'event',
    method: 'USER_REQUEST_DIALOG',
    messageId: id,
    objectId: GAME,
    data: {
      title: 'Request by Bob',
      message,
      gameId: GAME,
      relatedUserId: `u-${from}`,
      relatedUserName: from,
      button1Text: 'Accept',
      button1Action: 'ADD_PERMISSION_TO_ROLLBACK_TURN',
      button2Text: 'Deny',
      button2Action: 'DENY_PERMISSION_TO_ROLLBACK_TURN',
    },
  } as never)
}

const statuses = () => Object.fromEntries((getState().rollbackVote?.voters ?? []).map((v) => [v.name, v.status]))

describe('rollback vote (4-player commander)', () => {
  beforeEach(() => {
    reset()
    vi.clearAllMocks()
    setState({ gameChatId: 'c-4p' })
  })

  it('parses the requested turn count from the server message', () => {
    expect(parseRollbackTurns('Allow rollback to the start of the current turn?')).toBe(0)
    expect(parseRollbackTurns('Allow rollback to the start of the previous turn?')).toBe(1)
    expect(parseRollbackTurns('Allow to rollback 3 turns?')).toBe(3)
  })

  it('an incoming request opens the vote with the requester and three pending voters', () => {
    update(commander({ me: 'Bob', turn: 3 }))
    incomingRequest('Alice', 'Allow rollback to the start of the current turn?')
    const v = getState().rollbackVote!
    expect(getState().userRequest).toBeNull()
    expect(v.requester).toBe('Alice')
    expect(v.requestedByMe).toBe(false)
    expect(v.turns).toBe(0)
    expect(v.requestedAtTurn).toBe(3)
    expect(v.myVote).toBe('pending')
    expect(statuses()).toEqual({ Alice: 'requested', Bob: 'pending', Carol: 'pending', Dave: 'pending' })
    expect(v.voters.find((x) => x.me)?.name).toBe('Bob')
  })

  it('all three accept: my accept is sent and announced, others arrive by chat, the announce resolves it', async () => {
    const pre = commander({ me: 'Bob', turn: 3, step: 'DECLARE_BLOCKERS' })
    update(pre)
    incomingRequest('Alice', 'Allow rollback to the start of the current turn?')

    await voteRollback(GAME, true, 'u-Alice')
    expect(cmds.sendPlayerAction).toHaveBeenCalledWith('ADD_PERMISSION_TO_ROLLBACK_TURN', GAME, 'u-Alice')
    expect(cmds.sendChatMessage).toHaveBeenCalledWith('c-4p', expect.stringMatching(/^accepted the rollback request \(turn 3, \d\d:\d\d:\d\d\)$/))
    expect(getState().rollbackPendingFor).toBe(GAME)
    expect(statuses().Bob).toBe('accepted')

    chat('Carol', `${ROLLBACK_ACCEPT_CHAT} (turn 3, 10:00:01)`, 'TALK', 51)
    expect(statuses()).toEqual({ Alice: 'requested', Bob: 'accepted', Carol: 'accepted', Dave: 'pending' })
    expect(getState().rollbackVote?.outcome).toBe('voting')

    chat('', "<font color='red'>Player request: Rolling back to start of turn 3</font>", 'GAME', 52)
    expect(getState().rollbackVote?.outcome).toBe('applied')
    expect(getState().rollbackVote?.appliedTurn).toBe(3)
    expect(statuses().Dave).toBe('accepted')

    update(commander({ me: 'Bob', turn: 3, step: 'UPKEEP' }), 11)
    expect(getState().game?.step).toBe('UPKEEP')
    expect(getState().rollbackPendingFor).toBeNull()
  })

  it('one accepts and another denies: the vote ends denied and old views keep being discarded', async () => {
    const pre = commander({ me: 'Bob', turn: 5 })
    update(pre)
    incomingRequest('Alice', 'Allow rollback to the start of the previous turn?')
    await voteRollback(GAME, true, 'u-Alice')
    chat('Carol', ROLLBACK_ACCEPT_CHAT, 'TALK', 51)
    chat('', "Rollback request denied by <font color='#20B2AA'>Dave</font>", 'GAME', 52)

    const v = getState().rollbackVote!
    expect(v.outcome).toBe('denied')
    expect(v.deniedBy).toBe('Dave')
    expect(statuses()).toEqual({ Alice: 'requested', Bob: 'accepted', Carol: 'accepted', Dave: 'denied' })
    expect(getState().rollbackPendingFor).toBeNull()

    update(commander({ me: 'Bob', turn: 4, step: 'UPKEEP' }), 11)
    expect(getState().game?.turn).toBe(5)
  })

  it('denying my own vote sends DENY and closes the vote as denied by me', async () => {
    update(commander({ me: 'Bob', turn: 3 }))
    incomingRequest('Alice', 'Allow rollback to the start of the current turn?')
    await voteRollback(GAME, false, 'u-Alice')
    expect(cmds.sendPlayerAction).toHaveBeenCalledWith('DENY_PERMISSION_TO_ROLLBACK_TURN', GAME, 'u-Alice')
    expect(cmds.sendChatMessage).not.toHaveBeenCalled()
    expect(getState().rollbackVote?.outcome).toBe('denied')
    expect(getState().rollbackVote?.deniedBy).toBe('Bob')
    expect(getState().rollbackPendingFor).toBeNull()
  })

  it('a voter that never answers: the wait survives while shown, then expires once hidden', async () => {
    update(commander({ me: 'Bob', turn: 5 }))
    incomingRequest('Alice', 'Allow rollback to the start of the previous turn?')
    await voteRollback(GAME, true, 'u-Alice')
    const armedAt = getState().rollbackPendingAt!
    const later = armedAt + ROLLBACK_PENDING_TTL_MS + 1

    expect(isRollbackPending(getState(), GAME, later)).toBe(true)
    hideRollbackVote()
    expect(isRollbackPending(getState(), GAME, armedAt + 1000)).toBe(true)
    expect(isRollbackPending(getState(), GAME, later)).toBe(false)

    vi.spyOn(Date, 'now').mockReturnValue(later)
    try {
      update(commander({ me: 'Bob', turn: 4, step: 'COMBAT_DAMAGE' }), 11)
      expect(getState().game?.turn).toBe(5)
    } finally {
      vi.restoreAllMocks()
    }
  })

  it('a late announce after expiry re-arms the wait and the restored view is accepted', async () => {
    update(commander({ me: 'Bob', turn: 5 }))
    incomingRequest('Alice', 'Allow rollback to the start of the previous turn?')
    await voteRollback(GAME, true, 'u-Alice')
    hideRollbackVote()
    const later = getState().rollbackPendingAt! + ROLLBACK_PENDING_TTL_MS + 1
    vi.spyOn(Date, 'now').mockReturnValue(later)
    try {
      chat('', 'Player request: Rolling back to start of turn 4', 'GAME', 52)
      expect(getState().rollbackVote?.outcome).toBe('applied')
      expect(getState().rollbackVote?.hidden).toBe(false)
      update(commander({ me: 'Bob', turn: 4, step: 'UPKEEP' }), 11)
      expect(getState().game?.turn).toBe(4)
    } finally {
      vi.restoreAllMocks()
    }
  })

  it('the game advances between request and last vote: the server counts from the new turn', async () => {
    update(commander({ me: 'Bob', turn: 3 }))
    incomingRequest('Alice', 'Allow rollback to the start of the current turn?')
    update(commander({ me: 'Bob', turn: 4, priority: 'Bob' }), 11)
    expect(getState().game?.turn).toBe(4)
    expect(getState().rollbackVote?.requestedAtTurn).toBe(3)

    await voteRollback(GAME, true, 'u-Alice')
    chat('', 'Player request: Rolling back to start of turn 4', 'GAME', 52)
    expect(getState().rollbackVote?.appliedTurn).toBe(4)
    update(commander({ me: 'Bob', turn: 4, step: 'UPKEEP' }), 12)
    expect(getState().game?.turn).toBe(4)
    expect(getState().game?.step).toBe('UPKEEP')
  })

  it('the requester sees their own vote with three pending players and resolution', async () => {
    update(commander({ me: 'Alice', turn: 3 }))
    await requestRollback(GAME, 1)
    expect(cmds.sendPlayerAction).toHaveBeenCalledWith('ROLLBACK_TURNS', GAME, 1)
    const v = getState().rollbackVote!
    expect(v.requestedByMe).toBe(true)
    expect(v.myVote).toBeNull()
    expect(statuses()).toEqual({ Alice: 'requested', Bob: 'pending', Carol: 'pending', Dave: 'pending' })

    chat('Bob', ROLLBACK_ACCEPT_CHAT, 'TALK', 51)
    chat('Carol', ROLLBACK_ACCEPT_CHAT, 'TALK', 52)
    chat('Dave', ROLLBACK_ACCEPT_CHAT, 'TALK', 53)
    expect(statuses()).toEqual({ Alice: 'requested', Bob: 'accepted', Carol: 'accepted', Dave: 'accepted' })

    update(commander({ me: 'Alice', turn: 2, step: 'UPKEEP' }), 11)
    expect(getState().game?.turn).toBe(2)
    expect(getState().rollbackVote?.outcome).toBe('applied')
    expect(getState().rollbackVote?.appliedTurn).toBe(2)
  })

  it('the accept chat text varies so the server anti-spam never drops a repeated accept', () => {
    const a = rollbackAcceptChatText(3, new Date(2026, 8, 25, 10, 0, 1))
    const b = rollbackAcceptChatText(3, new Date(2026, 8, 25, 10, 0, 2))
    expect(a).toBe('accepted the rollback request (turn 3, 10:00:01)')
    expect(a).not.toBe(b)
    expect(isRollbackAcceptChat(a)).toBe(true)
    expect(isRollbackAcceptChat(ROLLBACK_ACCEPT_CHAT)).toBe(true)
    expect(isRollbackAcceptChat('accepted the rollback request?? no')).toBe(false)
  })

  it('an accept chat from a non-voter or with other text is ignored', async () => {
    update(commander({ me: 'Alice', turn: 3 }))
    await requestRollback(GAME, 0)
    chat('Mallory', ROLLBACK_ACCEPT_CHAT, 'TALK', 51)
    chat('Bob', 'accepted the rollback request?? no', 'TALK', 52)
    expect(statuses()).toEqual({ Alice: 'requested', Bob: 'pending', Carol: 'pending', Dave: 'pending' })
  })

  it('server refusal to the requester ends the vote as failed', async () => {
    update(commander({ me: 'Alice', turn: 3 }))
    await requestRollback(GAME, 3)
    handleMessage({
      type: 'event',
      method: 'GAME_INFORM_PERSONAL',
      messageId: 30,
      objectId: GAME,
      data: { message: 'That turn is not available for rollback.' },
    } as never)
    expect(getState().rollbackVote?.outcome).toBe('failed')
    expect(getState().rollbackPendingFor).toBeNull()
  })

  it('auto-pass does not pass priority while the vote is open', async () => {
    const view = commander({ me: 'Alice', turn: 3, priority: 'Alice' })
    update(view)
    setState({
      settings: { ...getState().settings, autoPass: true, smartStops: false },
      phaseStops: togglePhaseStop(getState().phaseStops, 'opponentTurn', 'main1'),
      feedback: null,
    })
    maybeAutoPass(view)
    const baseline = vi.mocked(cmds.sendPlayerBoolean).mock.calls.length
    expect(baseline).toBe(1)

    await requestRollback(GAME, 0)
    maybeAutoPass(view)
    expect(vi.mocked(cmds.sendPlayerBoolean).mock.calls.length).toBe(baseline)
  })

  it('a non-rollback user request still goes to the generic dialog', () => {
    update(commander({ me: 'Bob', turn: 3 }))
    handleMessage({
      type: 'event',
      method: 'USER_REQUEST_DIALOG',
      messageId: 21,
      objectId: GAME,
      data: {
        title: 'User request',
        message: 'Allow user <b>Eve</b> for this match to see your hand cards?',
        gameId: GAME,
        relatedUserId: 'u-Eve',
        button1Text: 'Accept',
        button1Action: 'ADD_PERMISSION_TO_SEE_HAND_CARDS',
      },
    } as never)
    expect(getState().rollbackVote).toBeNull()
    expect(getState().userRequest?.buttons[0].action).toBe('ADD_PERMISSION_TO_SEE_HAND_CARDS')
  })
})
