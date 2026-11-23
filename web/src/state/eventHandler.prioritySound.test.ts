import { describe, expect, it, beforeEach, vi } from 'vitest'
import { handleMessage } from './eventHandler'
import { maybeAutoPass } from './actions'
import { getState, setState } from './state'
import { initialSettings } from './slices/settings'
import { makeCard, makeGameView, makePlayer } from '../__fixtures__/gameViews'
import { soundManager } from '../audio/soundManager'
import * as cmds from '../net/commands'
import type { PrioritySoundMode } from '../audio/prioritySound'

vi.mock('../net/commands', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../net/commands')>()
  const stubbed: Record<string, unknown> = {}
  for (const [name, value] of Object.entries(actual)) {
    stubbed[name] = typeof value === 'function' ? vi.fn().mockResolvedValue(null) : value
  }
  return stubbed
})

vi.mock('../audio/soundManager', () => ({
  soundManager: { play: vi.fn(), setSettings: vi.fn(), setMusicVolume: vi.fn() },
}))

const play = vi.mocked(soundManager.play)

/** A two-player view where my own player does or does not hold priority. */
function viewWith(myPriority: boolean) {
  return makeGameView({
    players: [
      makePlayer({ playerId: 'me', name: 'Me', controlled: true, isHuman: true, isActive: true, hasPriority: myPriority }),
      makePlayer({ playerId: 'opp', name: 'Opp' }),
    ],
    myPlayerId: 'me',
    activePlayerId: 'me',
    priorityPlayerName: myPriority ? 'Me' : 'Opp',
  })
}

const priorityCues = () => play.mock.calls.filter(([key]) => key === 'priority').length

// The priority window opens with a GAME_SELECT that carries the gameView, and
// that view already has my `hasPriority` true (the server sets the priority
// player before it sends the ask, HumanPlayer.prepareForResponse). This is the
// shape the real server sends and the fake scenarios replay
// (fixtures/scenarios/humanGame.ts emitSelect), so a cue gated on
// `method !== 'GAME_SELECT'` never fires in a real game.
function feedPriorityWindow(myPriorityBefore: boolean, mode: PrioritySoundMode) {
  setState({ game: viewWith(!myPriorityBefore), settings: { ...initialSettings.settings, prioritySound: mode } })
  handleMessage({
    type: 'event',
    method: 'GAME_SELECT',
    objectId: 'g-ps',
    data: { message: 'Play instants and activated abilities', gameView: viewWith(myPriorityBefore) },
  } as never)
}

describe('priority cue wiring (issue #12)', () => {
  beforeEach(() => {
    play.mockClear()
    setState({ phase: 'game', gameId: 'g-ps', feedback: null, events: [] })
  })

  it('the window that gives me priority arrives as GAME_SELECT, not as a plain update', () => {
    feedPriorityWindow(true, 'every-prompt')
    expect(getState().game?.players?.find((p) => p.controlled)?.hasPriority).toBe(true)
    expect(priorityCues()).toBe(1)
  })

  it('on-gain sounds when the priority window opens', () => {
    feedPriorityWindow(true, 'on-gain')
    expect(priorityCues()).toBe(1)
  })

  it('on-gain stays silent on a prompt that does not give me priority', () => {
    feedPriorityWindow(false, 'on-gain')
    expect(priorityCues()).toBe(0)
  })

  it('off never sounds', () => {
    feedPriorityWindow(true, 'off')
    expect(priorityCues()).toBe(0)
  })

  it('every-prompt still sounds (the default must not change)', () => {
    feedPriorityWindow(true, 'every-prompt')
    expect(priorityCues()).toBe(1)
  })
})

const NO_STOPS = { yourTurn: {}, opponentTurn: {} }

/**
 * A priority window of my own, as the server opens it: the `GAME_SELECT` carries
 * the view and `handleGameEvent` records it as the `priorityRequest` the client
 * then decides about.
 */
function openWindow(over: Parameters<typeof makeGameView>[0] = {}, stops = NO_STOPS, smartStops = true) {
  // The view already on screen sits on the same turn and step: a window that went
  // backwards would be dropped as stale before any cue.
  setState({
    game: { ...viewWith(false), ...over },
    settings: { ...initialSettings.settings, prioritySound: 'on-stop', smartStops, phaseStops: stops },
  })
  handleMessage({
    type: 'event',
    method: 'GAME_SELECT',
    objectId: 'g-ps',
    data: { message: 'Play instants and activated abilities', gameView: { ...viewWith(true), ...over } },
  } as never)
  return getState().game!
}

/** A card the player could cast: `decideStop` keeps the window for it. */
const CASTABLE = { objects: { shock: { basicManaAbilities: [], basicPlayAbilities: [], basicCastAbilities: [{ id: 'c', value: 'Cast Shock' }], other: [] } } }

describe('SET-14 · the on-stop priority cue', () => {
  beforeEach(() => {
    play.mockClear()
    vi.mocked(cmds.sendPlayerBoolean).mockClear()
    setState({ phase: 'game', gameId: 'g-ps', feedback: null, combat: null, rollbackVote: null, events: [] })
  })

  it('SET-14: a window the client passes by itself never sounds', () => {
    const game = openWindow()
    expect(priorityCues()).toBe(0)
    maybeAutoPass(game)
    expect(cmds.sendPlayerBoolean).toHaveBeenCalledWith(false, 'g-ps')
    expect(priorityCues()).toBe(0)
  })

  it('SET-14: a window the client keeps for a playable card sounds once', () => {
    const game = openWindow({ canPlayObjects: CASTABLE, myHand: { h1: makeCard({ name: 'Shock', parentId: 'h1' }) } })
    maybeAutoPass(game)
    maybeAutoPass(game)
    expect(cmds.sendPlayerBoolean).not.toHaveBeenCalled()
    expect(priorityCues()).toBe(1)
  })

  it('SET-14: a phase the player marked as a stop sounds, the same phase without it does not', () => {
    maybeAutoPass(openWindow({ step: 'UPKEEP' }))
    expect(cmds.sendPlayerBoolean).toHaveBeenCalledTimes(1)
    expect(priorityCues()).toBe(0)

    maybeAutoPass(openWindow({ step: 'UPKEEP' }, { yourTurn: { upkeep: true }, opponentTurn: {} }))
    expect(cmds.sendPlayerBoolean).toHaveBeenCalledTimes(1)
    expect(priorityCues()).toBe(1)
  })

  it('SET-14: a pending combat selection sounds, on a window that would otherwise be passed', () => {
    const game = openWindow()
    maybeAutoPass(game)
    expect(cmds.sendPlayerBoolean).toHaveBeenCalledTimes(1)
    expect(priorityCues()).toBe(0)

    setState({ combat: { mode: 'block', selectable: ['c1'], special: false, chosen: [] } })
    maybeAutoPass(game)
    expect(priorityCues()).toBe(1)
  })

  it('SET-14: a rollback vote in progress sounds, on a window that would otherwise be passed', () => {
    const game = openWindow()
    maybeAutoPass(game)
    expect(cmds.sendPlayerBoolean).toHaveBeenCalledTimes(1)
    expect(priorityCues()).toBe(0)

    setState({ rollbackVote: { gameId: 'g-ps', outcome: 'voting', turns: 1, votes: {}, asked: Date.now() } as never })
    maybeAutoPass(game)
    expect(priorityCues()).toBe(1)
  })

  it('SET-14: a stop that comes with a dialog stays silent, the dialog already sounded', () => {
    const game = openWindow()
    setState({ feedback: { method: 'GAME_ASK', gameId: 'g-ps', title: '', message: 'Pay {1}?', mode: 'boolean', options: [], min: 0, max: 0 } as never })
    play.mockClear()
    maybeAutoPass(game)
    expect(cmds.sendPlayerBoolean).not.toHaveBeenCalled()
    expect(priorityCues()).toBe(0)
  })

  it('SET-14: with smart stops off it behaves as on-gain', () => {
    const game = openWindow({}, NO_STOPS, false)
    expect(priorityCues()).toBe(1)
    maybeAutoPass(game)
    expect(priorityCues()).toBe(1)
  })
})
