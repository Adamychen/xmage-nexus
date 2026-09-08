import { beforeEach, describe, expect, it, vi } from 'vitest'
import { soundManager } from './soundManager'
import { synthesizeSound } from './soundSynthesizer'
import { dispatchGameSounds } from './gameSoundDispatcher'
import type { SoundKey } from './types'
import type { GameView } from '../net/types.generated'

const ALL_SOUND_KEYS: SoundKey[] = [
  'tap',
  'play_card',
  'draw',
  'stack_cast',
  'priority',
  'combat_hit',
  'life_gain',
  'life_loss',
  'destroy',
  'game_start',
  'victory',
  'defeat',
  'timer_tick',
  'ui_click',
  'prompt_open',
  'whisper',
]

function createMockAudioContext(sampleRate = 44100): AudioContext {
  return {
    sampleRate,
    state: 'running',
    resume: vi.fn().mockResolvedValue(undefined),
    createBuffer: (channels: number, length: number, sr: number) => {
      const data = new Float32Array(length)
      return {
        numberOfChannels: channels,
        length,
        sampleRate: sr,
        duration: length / sr,
        getChannelData: () => data,
      } as unknown as AudioBuffer
    },
    createGain: () => ({
      gain: { value: 1 },
      connect: vi.fn(),
    }),
    createBufferSource: () => ({
      buffer: null,
      playbackRate: { value: 1 },
      connect: vi.fn(),
      start: vi.fn(),
      stop: vi.fn(),
    }),
    destination: {},
  } as unknown as AudioContext
}

describe('soundSynthesizer', () => {
  const ctx = createMockAudioContext()

  it.each(ALL_SOUND_KEYS)('synthesizes non-empty buffer for %s', (key) => {
    const buf = synthesizeSound(ctx, key)
    expect(buf).toBeDefined()
    expect(buf.length).toBeGreaterThan(0)
    expect(buf.sampleRate).toBe(44100)
    const data = buf.getChannelData(0)
    const hasSignal = data.some((sample) => Math.abs(sample) > 0.001)
    expect(hasSignal).toBe(true)
  })
})

describe('soundManager', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    soundManager.setSettings({
      soundEnabled: true,
      masterVolume: 0.8,
      sfxVolume: 0.8,
      uiVolume: 0.7,
    })
  })

  it('updates and returns settings', () => {
    soundManager.setSettings({
      soundEnabled: false,
      masterVolume: 0.5,
      sfxVolume: 0.4,
      uiVolume: 0.3,
    })
    expect(soundManager.getSettings()).toEqual({
      soundEnabled: false,
      masterVolume: 0.5,
      sfxVolume: 0.4,
      uiVolume: 0.3,
    })
  })

  it('handles play safely in mock environments without error', () => {
    expect(() => soundManager.play('tap', 'game')).not.toThrow()
    expect(() => soundManager.play('ui_click', 'ui')).not.toThrow()
  })

  it('skips playback when soundEnabled is false', () => {
    soundManager.setSettings({
      soundEnabled: false,
      masterVolume: 0.8,
      sfxVolume: 0.8,
      uiVolume: 0.7,
    })
    expect(() => soundManager.play('tap', 'game')).not.toThrow()
  })
})

describe('gameSoundDispatcher', () => {
  beforeEach(() => {
    vi.spyOn(soundManager, 'play').mockImplementation(() => {})
  })

  it('plays priority on GAME_SELECT method', () => {
    const game = {
      players: [{ controlled: true, hasPriority: true, name: 'Alice' }],
    } as unknown as GameView
    dispatchGameSounds(null, game, 'GAME_SELECT')
    expect(soundManager.play).toHaveBeenCalledWith('priority', 'game')
  })

  it('plays priority when controlled player gains priority', () => {
    const prev = {
      players: [{ controlled: true, hasPriority: false, name: 'Alice' }],
    } as unknown as GameView
    const next = {
      players: [{ controlled: true, hasPriority: true, name: 'Alice' }],
    } as unknown as GameView
    dispatchGameSounds(prev, next, 'GAME_UPDATE')
    expect(soundManager.play).toHaveBeenCalledWith('priority', 'game')
  })

  it('plays stack_cast when stack grows', () => {
    const prev = {
      stack: {},
    } as unknown as GameView
    const next = {
      stack: { s1: { id: 's1' } },
    } as unknown as GameView
    dispatchGameSounds(prev, next)
    expect(soundManager.play).toHaveBeenCalledWith('stack_cast', 'game')
  })

  it('plays tap when tapped count increases', () => {
    const prev = {
      players: [
        {
          controlled: true,
          battlefield: { c1: { id: 'c1', tapped: false } },
        },
      ],
    } as unknown as GameView
    const next = {
      players: [
        {
          controlled: true,
          battlefield: { c1: { id: 'c1', tapped: true } },
        },
      ],
    } as unknown as GameView
    dispatchGameSounds(prev, next)
    expect(soundManager.play).toHaveBeenCalledWith('tap', 'game')
  })

  it('plays play_card when battlefield card count increases', () => {
    const prev = {
      players: [
        {
          controlled: true,
          battlefield: {},
        },
      ],
    } as unknown as GameView
    const next = {
      players: [
        {
          controlled: true,
          battlefield: { c1: { id: 'c1', tapped: false } },
        },
      ],
    } as unknown as GameView
    dispatchGameSounds(prev, next)
    expect(soundManager.play).toHaveBeenCalledWith('play_card', 'game')
  })

  it('plays draw when hand count increases', () => {
    const prev = {
      myHand: { c1: { id: 'c1' } },
    } as unknown as GameView
    const next = {
      myHand: { c1: { id: 'c1' }, c2: { id: 'c2' } },
    } as unknown as GameView
    dispatchGameSounds(prev, next)
    expect(soundManager.play).toHaveBeenCalledWith('draw', 'game')
  })

  it('plays life_loss or combat_hit on damage', () => {
    const prev = {
      phase: 'COMBAT',
      step: 'DECLARE_BLOCKERS',
      players: [{ controlled: true, life: 20, name: 'Alice' }],
    } as unknown as GameView
    const next = {
      phase: 'COMBAT',
      step: 'COMBAT_DAMAGE',
      players: [{ controlled: true, life: 17, name: 'Alice' }],
    } as unknown as GameView
    dispatchGameSounds(prev, next)
    expect(soundManager.play).toHaveBeenCalledWith('combat_hit', 'game')

    const prev2 = {
      phase: 'MAIN_PRE',
      step: 'PRECOMBAT_MAIN',
      players: [{ controlled: true, life: 20, name: 'Alice' }],
    } as unknown as GameView
    const next2 = {
      phase: 'MAIN_PRE',
      step: 'PRECOMBAT_MAIN',
      players: [{ controlled: true, life: 18, name: 'Alice' }],
    } as unknown as GameView
    dispatchGameSounds(prev2, next2)
    expect(soundManager.play).toHaveBeenCalledWith('life_loss', 'game')
  })

  it('plays life_gain when life increases', () => {
    const prev = {
      players: [{ controlled: true, life: 15, name: 'Alice' }],
    } as unknown as GameView
    const next = {
      players: [{ controlled: true, life: 19, name: 'Alice' }],
    } as unknown as GameView
    dispatchGameSounds(prev, next)
    expect(soundManager.play).toHaveBeenCalledWith('life_gain', 'game')
  })

  it('plays destroy when graveyard grows', () => {
    const prev = {
      players: [{ controlled: true, graveyard: { c1: { id: 'c1' } } }],
    } as unknown as GameView
    const next = {
      players: [{ controlled: true, graveyard: { c1: { id: 'c1' }, c2: { id: 'c2' } } }],
    } as unknown as GameView
    dispatchGameSounds(prev, next)
    expect(soundManager.play).toHaveBeenCalledWith('destroy', 'game')
  })
})
