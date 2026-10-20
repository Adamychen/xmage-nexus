import { describe, expect, it } from 'vitest'
import { synthesizeSound } from './soundSynthesizer'

const sampleRate = 44100

function fakeContext() {
  return {
    sampleRate,
    createBuffer: (_channels: number, length: number) => {
      const data = new Float32Array(length)
      return { length, getChannelData: () => data }
    },
  } as unknown as AudioContext
}

describe('projectile sounds', () => {
  it.each(['projectile_launch', 'projectile_impact', 'card_land', 'coin_flip', 'shuffle', 'dice_roll'] as const)('%s is finite, audible and within range', (key) => {
    const buf = synthesizeSound(fakeContext(), key)
    const data = buf.getChannelData(0)
    let peak = 0
    let sum = 0
    for (const v of data) {
      expect(Number.isFinite(v)).toBe(true)
      peak = Math.max(peak, Math.abs(v))
      sum += v * v
    }
    expect(peak).toBeGreaterThan(0.1)
    expect(peak).toBeLessThanOrEqual(1)
    expect(Math.sqrt(sum / data.length)).toBeGreaterThan(0.01)
  })
})
