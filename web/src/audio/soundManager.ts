import type { AudioSettings, SoundCategory, SoundKey } from './types'
import { synthesizeSound } from './soundSynthesizer'

const DEFAULT_SETTINGS: AudioSettings = {
  soundEnabled: true,
  masterVolume: 0.8,
  sfxVolume: 0.8,
  uiVolume: 0.7,
}

const THROTTLE_MS = 35

class SoundManager {
  private ctx: AudioContext | null = null
  private masterGain: GainNode | null = null
  private sfxGain: GainNode | null = null
  private uiGain: GainNode | null = null
  private buffers: Map<SoundKey, AudioBuffer> = new Map()
  private lastPlayed: Map<SoundKey, number> = new Map()
  private settings: AudioSettings = { ...DEFAULT_SETTINGS }
  private initialized = false

  init(settings?: AudioSettings) {
    if (settings) {
      this.settings = { ...settings }
    }
    if (typeof window === 'undefined' || this.initialized) return
    this.initialized = true

    const unlock = () => {
      this.ensureContext()
      if (this.ctx) {
        if (this.ctx.state === 'suspended') {
          void this.ctx.resume()
        }
        try {
          const buf = this.ctx.createBuffer(1, 1, 22050)
          const src = this.ctx.createBufferSource()
          src.buffer = buf
          src.connect(this.ctx.destination)
          src.start(0)
        } catch {}
        if (this.ctx.state === 'running') {
          window.removeEventListener('pointerdown', unlock)
          window.removeEventListener('click', unlock)
          window.removeEventListener('keydown', unlock)
          window.removeEventListener('touchstart', unlock)
        }
      }
    }

    window.addEventListener('pointerdown', unlock, { passive: true })
    window.addEventListener('click', unlock, { passive: true })
    window.addEventListener('keydown', unlock, { passive: true })
    window.addEventListener('touchstart', unlock, { passive: true })
  }

  private ensureContext(): boolean {
    if (typeof window === 'undefined') return false
    const AudioCtxClass = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!AudioCtxClass) return false

    if (!this.ctx) {
      try {
        this.ctx = new AudioCtxClass()
        this.masterGain = this.ctx.createGain()
        this.sfxGain = this.ctx.createGain()
        this.uiGain = this.ctx.createGain()

        this.sfxGain.connect(this.masterGain)
        this.uiGain.connect(this.masterGain)
        this.masterGain.connect(this.ctx.destination)
        this.applySettings()
      } catch {
        return false
      }
    }

    return true
  }

  setSettings(newSettings: AudioSettings) {
    this.settings = { ...newSettings }
    this.applySettings()
  }

  getSettings(): AudioSettings {
    return { ...this.settings }
  }

  private applySettings() {
    if (!this.masterGain || !this.sfxGain || !this.uiGain) return
    const { soundEnabled, masterVolume, sfxVolume, uiVolume } = this.settings
    this.masterGain.gain.value = soundEnabled ? Math.max(0, Math.min(1, masterVolume)) : 0
    this.sfxGain.gain.value = Math.max(0, Math.min(1, sfxVolume))
    this.uiGain.gain.value = Math.max(0, Math.min(1, uiVolume))
  }

  private getBuffer(key: SoundKey): AudioBuffer | null {
    if (!this.ctx) return null
    let buf = this.buffers.get(key)
    if (!buf) {
      try {
        buf = synthesizeSound(this.ctx, key)
        this.buffers.set(key, buf)
      } catch {
        return null
      }
    }
    return buf
  }

  async loadSound(key: SoundKey, url: string): Promise<boolean> {
    if (!this.ensureContext() || !this.ctx) return false
    try {
      const res = await fetch(url)
      if (!res.ok) return false
      const arrayBuffer = await res.arrayBuffer()
      const audioBuffer = await this.ctx.decodeAudioData(arrayBuffer)
      this.buffers.set(key, audioBuffer)
      return true
    } catch {
      return false
    }
  }

  clearBuffers() {
    this.buffers.clear()
  }

  play(key: SoundKey, category: SoundCategory = 'game') {
    if (!this.settings.soundEnabled) return

    const now = Date.now()
    const last = this.lastPlayed.get(key) ?? 0
    const throttle = key === 'draw' ? 90 : THROTTLE_MS
    if (now - last < throttle) return
    this.lastPlayed.set(key, now)

    if (!this.ensureContext() || !this.ctx) return

    if (this.ctx.state === 'suspended') {
      void this.ctx.resume()
    }

    const buffer = this.getBuffer(key)
    if (!buffer) return

    try {
      const source = this.ctx.createBufferSource()
      source.buffer = buffer

      if (key === 'tap' || key === 'play_card' || key === 'draw' || key === 'ui_click') {
        source.playbackRate.value = 1 + (Math.random() - 0.5) * 0.08
      }

      const targetGain = category === 'ui' ? this.uiGain : this.sfxGain
      if (!targetGain) return

      source.connect(targetGain)
      source.start(0)
    } catch {}
  }
}

export const soundManager = new SoundManager()
