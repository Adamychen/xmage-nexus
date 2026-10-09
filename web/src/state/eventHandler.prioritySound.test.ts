import { describe, expect, it, beforeEach, vi } from 'vitest'
import { handleMessage } from './eventHandler'
import { getState, setState } from './state'
import { initialSettings } from './slices/settings'
import { makeGameView, makePlayer } from '../__fixtures__/gameViews'
import { soundManager } from '../audio/soundManager'
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
