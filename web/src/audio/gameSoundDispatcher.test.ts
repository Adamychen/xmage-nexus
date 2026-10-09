import { describe, expect, it, vi, beforeEach } from 'vitest'
import { dispatchGameSounds } from './gameSoundDispatcher'
import { soundManager } from './soundManager'
import type { GameView } from '../net/types.generated'

vi.mock('./soundManager', () => ({
  soundManager: { play: vi.fn(), setSettings: vi.fn(), setMusicVolume: vi.fn() },
}))

const play = soundManager.play as unknown as ReturnType<typeof vi.fn>

function view(myPriority: boolean, over: Partial<GameView> = {}): GameView {
  return {
    step: 'MAIN1',
    turn: 3,
    myHand: {},
    stack: {},
    players: [{ playerId: 'me', controlled: true, life: 20, hasPriority: myPriority, battlefield: {}, graveyard: {} }],
    ...over,
  } as unknown as GameView
}

const priorityPlays = () => play.mock.calls.filter(([key]) => key === 'priority').length

describe('dispatchGameSounds priority cue (issue #12)', () => {
  beforeEach(() => play.mockClear())

  // Shape notes, true in the real protocol and in the fake scenarios
  // (fixtures/scenarios/humanGame.ts emitSelect / emitUpdateAndSelect): a
  // priority window opens with a GAME_SELECT that carries the gameView, and
  // that view already has my `hasPriority` flipped (the server sets the
  // priority player before it sends the ask, HumanPlayer.prepareForResponse).
  // So the flip must be readable on a GAME_SELECT frame, not only on a
  // GAME_UPDATE.

  it('every-prompt: dings on a phase change and on a priority gain', () => {
    dispatchGameSounds(view(true), view(true), 'GAME_SELECT', 'every-prompt')
    expect(priorityPlays()).toBe(1)

    play.mockClear()
    dispatchGameSounds(view(false), view(true), 'GAME_UPDATE', 'every-prompt')
    expect(priorityPlays()).toBe(1)
  })

  it('every-prompt: dings once when a prompt also carries the priority gain', () => {
    dispatchGameSounds(view(false), view(true), 'GAME_SELECT', 'every-prompt')
    expect(priorityPlays()).toBe(1)
  })

  it('every-prompt: dings on the first prompt of a game, with no previous view', () => {
    dispatchGameSounds(null, view(true), 'GAME_SELECT', 'every-prompt')
    expect(priorityPlays()).toBe(1)
  })

  it('on-gain: dings when the priority window opens (the flip rides the GAME_SELECT frame)', () => {
    dispatchGameSounds(view(false), view(true), 'GAME_SELECT', 'on-gain')
    expect(priorityPlays()).toBe(1)
  })

  it('on-gain: silent on a phase change where the opponent keeps priority', () => {
    dispatchGameSounds(view(true), view(false), 'GAME_SELECT', 'on-gain')
    expect(priorityPlays()).toBe(0)

    play.mockClear()
    dispatchGameSounds(view(false), view(false), 'GAME_SELECT', 'on-gain')
    expect(priorityPlays()).toBe(0)
  })

  it('on-gain: silent on a re-ask while I already hold priority', () => {
    dispatchGameSounds(view(true), view(true), 'GAME_SELECT', 'on-gain')
    expect(priorityPlays()).toBe(0)

    play.mockClear()
    dispatchGameSounds(view(true), view(true), 'GAME_PLAY_MANA', 'on-gain')
    expect(priorityPlays()).toBe(0)
  })

  it('on-gain: silent on the first prompt of a game, where the gain cannot be proven', () => {
    dispatchGameSounds(null, view(true), 'GAME_SELECT', 'on-gain')
    expect(priorityPlays()).toBe(0)
  })

  it('on-gain: still catches a flip that arrives outside a prompt', () => {
    dispatchGameSounds(view(false), view(true), 'GAME_UPDATE', 'on-gain')
    expect(priorityPlays()).toBe(1)
  })

  it('off: never plays the priority cue', () => {
    dispatchGameSounds(view(true), view(true), 'GAME_SELECT', 'off')
    dispatchGameSounds(view(false), view(true), 'GAME_SELECT', 'off')
    dispatchGameSounds(view(false), view(true), 'GAME_UPDATE', 'off')
    expect(priorityPlays()).toBe(0)
  })

  it('no mode plays the cue twice for one dispatch', () => {
    for (const mode of ['every-prompt', 'on-gain', 'off'] as const) {
      play.mockClear()
      dispatchGameSounds(view(false), view(true), 'GAME_SELECT', mode)
      expect(priorityPlays(), mode).toBeLessThanOrEqual(1)
    }
  })

  it('leaves the other cues alone in every mode', () => {
    const prev = view(true)
    const next = view(true, { myHand: { a: { id: 'a' } as never } })
    for (const mode of ['every-prompt', 'on-gain', 'off'] as const) {
      play.mockClear()
      dispatchGameSounds(prev, next, 'GAME_UPDATE', mode)
      expect(play.mock.calls.filter(([key]) => key === 'draw').length, mode).toBe(1)
    }
  })
})