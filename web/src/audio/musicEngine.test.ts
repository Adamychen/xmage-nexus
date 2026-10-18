import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { musicEngine } from './musicEngine'
import { soundManager } from './soundManager'

function fakeNode() {
  return {
    gain: {
      value: 0,
      setValueAtTime: vi.fn(),
      linearRampToValueAtTime: vi.fn(),
      exponentialRampToValueAtTime: vi.fn(),
      cancelScheduledValues: vi.fn(),
    },
    connect: vi.fn(),
    disconnect: vi.fn(),
  }
}

function fakeBus() {
  const ctx = { currentTime: 0, state: 'running', createGain: vi.fn(() => fakeNode()) }
  return { ctx, out: fakeNode() } as unknown as { ctx: AudioContext; out: GainNode }
}

describe('musicEngine modes', () => {
  let bus: ReturnType<typeof fakeBus>
  beforeEach(() => {
    vi.useFakeTimers()
    bus = fakeBus()
    vi.spyOn(soundManager, 'getMusicBus').mockReturnValue(bus)
    vi.spyOn(soundManager, 'isMusicAudible').mockReturnValue(false)
    vi.spyOn(soundManager, 'isUnlocked').mockReturnValue(true)
  })
  afterEach(() => {
    musicEngine.stop()
    vi.runOnlyPendingTimers()
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  it('waits for the audio unlock before starting the lobby theme', () => {
    vi.spyOn(soundManager, 'isUnlocked').mockReturnValue(false)
    musicEngine.start('lobby')
    expect(musicEngine.isRunning()).toBe(false)
    expect(soundManager.getMusicBus).not.toHaveBeenCalled()
  })

  it('starts the lobby theme once audio is unlocked', () => {
    musicEngine.start('lobby')
    expect(musicEngine.isRunning()).toBe(true)
  })

  it('ignores a game-theme stop while the lobby theme plays', () => {
    musicEngine.start('lobby')
    musicEngine.stop('game')
    expect(musicEngine.isRunning()).toBe(true)
    musicEngine.stop('lobby')
    expect(musicEngine.isRunning()).toBe(false)
  })

  it('switches from the lobby theme to the game theme', () => {
    musicEngine.start('lobby')
    musicEngine.start()
    expect(musicEngine.isRunning()).toBe(true)
    musicEngine.stop('lobby')
    expect(musicEngine.isRunning()).toBe(true)
    musicEngine.stop()
    expect(musicEngine.isRunning()).toBe(false)
  })
})
