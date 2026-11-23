import { beforeEach, describe, expect, it, vi } from 'vitest'
import { effectivePrioritySound, normalizePrioritySound, playPriorityStopCue, PRIORITY_SOUND_MODES } from './prioritySound'
import { soundManager } from './soundManager'

vi.mock('./soundManager', () => ({
  soundManager: { play: vi.fn(), setSettings: vi.fn(), setMusicVolume: vi.fn() },
}))

const play = vi.mocked(soundManager.play)

describe('normalizePrioritySound', () => {
  it('defaults to every-prompt', () => {
    expect(normalizePrioritySound(undefined)).toBe('every-prompt')
    expect(normalizePrioritySound(null)).toBe('every-prompt')
    expect(normalizePrioritySound('nope')).toBe('every-prompt')
    expect(normalizePrioritySound(0)).toBe('every-prompt')
  })

  it('keeps each valid mode', () => {
    expect(normalizePrioritySound('every-prompt')).toBe('every-prompt')
    expect(normalizePrioritySound('on-gain')).toBe('on-gain')
    expect(normalizePrioritySound('on-stop')).toBe('on-stop')
    expect(normalizePrioritySound('off')).toBe('off')
  })
})

describe('effectivePrioritySound', () => {
  it('only on-stop depends on the smart stops', () => {
    for (const mode of PRIORITY_SOUND_MODES) {
      expect(effectivePrioritySound(mode, true)).toBe(mode)
      expect(effectivePrioritySound(mode, false)).toBe(mode === 'on-stop' ? 'on-gain' : mode)
    }
  })
})

describe('playPriorityStopCue', () => {
  beforeEach(() => play.mockClear())

  it('sounds for a stop the player has to act on', () => {
    for (const reason of ['rollback-vote', 'controlled-priority', 'combat', 'phase-stop'] as const) {
      play.mockClear()
      playPriorityStopCue('on-stop', true, reason)
      expect(play.mock.calls.map(([key]) => key), reason).toEqual(['priority'])
    }
  })

  it('leaves a stop that opened a dialog to the prompt cue', () => {
    playPriorityStopCue('on-stop', true, 'prompt')
    expect(play).not.toHaveBeenCalled()
  })

  it('belongs to on-stop alone: the other modes are decided by the view diff', () => {
    for (const mode of ['every-prompt', 'on-gain', 'off'] as const) {
      playPriorityStopCue(mode, true, 'phase-stop')
    }
    playPriorityStopCue('on-stop', false, 'phase-stop')
    expect(play).not.toHaveBeenCalled()
  })
})
