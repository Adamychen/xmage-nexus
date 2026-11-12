import { afterEach, describe, expect, it } from 'vitest'
import { mergeOutReason, outReasonKey, parseOutReason } from './outReason'
import { getState, setState } from '../state/state'
import { sniffOutReason } from '../state/actions'
import { makeGameView, makePlayer } from '../__fixtures__/gameViews'
import { handleChatMessage } from '../state/events/chat'
import type { Snapshot } from '../state/events/context'

const named = (name: string) => `<font color='#20B2AA'>${name}</font>`

function inGame(beaOut: boolean) {
  setState({
    gameId: 'g1',
    outReasons: {},
    game: makeGameView({
      players: [
        makePlayer({ playerId: 'p1', name: 'Ana', controlled: true, commandList: [] }),
        makePlayer({ playerId: 'p2', name: 'Bea', hasLeft: beaOut, commandList: [] }),
      ],
    }),
  })
}

const reasonOf = (player: string) => getState().outReasons[outReasonKey('g1', player)]

describe('outReason', () => {
  afterEach(() => setState({ gameId: null, game: null, outReasons: {}, phase: 'idle', chatMessages: [] }))

  it('BRD-30: the server lines for a concession, a quit, a timeout and a loss are told apart', () => {
    expect(parseOutReason(`${named('Bea')} has conceded.`)).toEqual({ player: 'Bea', reason: 'conceded' })
    expect(parseOutReason(`${named('Bea')} quits the match.`)).toEqual({ player: 'Bea', reason: 'left' })
    expect(parseOutReason(`${named('Bea')} has run out of time, losing the match.`)).toEqual({ player: 'Bea', reason: 'left' })
    expect(parseOutReason(`${named('Bea')} was idle for too long, losing the Match.`)).toEqual({ player: 'Bea', reason: 'left' })
    expect(parseOutReason(`${named('Bea')} has lost the game`)).toEqual({ player: 'Bea', reason: 'died' })
    expect(parseOutReason(`${named('Bea')} casts Lightning Bolt`)).toBeNull()
  })

  it('BRD-30: the more specific reason wins over the loss logged with it', () => {
    expect(mergeOutReason('conceded', 'died')).toBe('conceded')
    expect(mergeOutReason('died', 'left')).toBe('left')
    expect(mergeOutReason(undefined, 'died')).toBe('died')
  })

  it('BRD-30: a concession reads as conceded and a quit as left, in the order the server logs them', () => {
    inGame(false)
    sniffOutReason(`${named('Bea')} has conceded.`, 'g1')
    sniffOutReason(`${named('Bea')} has lost the game`, 'g1')
    expect(reasonOf('Bea')).toBe('conceded')

    inGame(false)
    sniffOutReason(`${named('Bea')} has lost the game`, 'g1')
    sniffOutReason(`${named('Bea')} quits the match.`, 'g1')
    expect(reasonOf('Bea')).toBe('left')
  })

  it('BRD-30: the reason is read from the game log, which reaches the client as game chat', () => {
    inGame(false)
    setState({ phase: 'game' })
    handleChatMessage({ message: `${named('Bea')} has conceded.`, messageType: 'GAME', username: '' }, null, getState() as unknown as Snapshot)
    expect(reasonOf('Bea')).toBe('conceded')
  })

  it('BRD-30: a dead player who closes the table later stays dead', () => {
    inGame(false)
    sniffOutReason(`${named('Bea')} has lost the game`, 'g1')
    inGame(true)
    setState({ outReasons: { [outReasonKey('g1', 'Bea')]: 'died' } })
    sniffOutReason(`${named('Bea')} has lost the game`, 'g1')
    sniffOutReason(`${named('Bea')} quits the match.`, 'g1')
    expect(reasonOf('Bea')).toBe('died')
  })
})
