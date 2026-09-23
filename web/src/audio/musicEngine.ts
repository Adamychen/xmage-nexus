import { soundManager } from './soundManager'
import type { MusicIntensity } from './musicIntensity'

const A2 = 110
const semis = (root: number, n: number) => root * Math.pow(2, n / 12)

const CALM: number[][] = [
  [0, 3, 7],
  [-4, 0, 3],
  [3, 7, 10],
  [-2, 2, 5],
]

const DIRE: number[][] = [
  [0, 3, 7],
  [1, 5, 8],
  [0, 3, 7],
  [-5, -1, 2],
]

const BPM: Record<MusicIntensity, number> = { 0: 60, 1: 78, 2: 96 }
const CUTOFF: Record<MusicIntensity, number> = { 0: 520, 1: 900, 2: 1500 }

export function progressionFor(intensity: MusicIntensity): number[][] {
  return intensity === 2 ? DIRE : CALM
}

export function barSeconds(intensity: MusicIntensity): number {
  return (60 / BPM[intensity]) * 4
}

class MusicEngine {
  private wanted = false
  private running = false
  private intensity: MusicIntensity = 0
  private timer: ReturnType<typeof setInterval> | null = null
  private nextBar = 0
  private bar = 0
  private out: GainNode | null = null
  private noise: AudioBuffer | null = null

  start() {
    this.wanted = true
    this.tryStart()
  }

  stop() {
    this.wanted = false
    if (!this.running) return
    this.running = false
    if (this.timer) clearInterval(this.timer)
    this.timer = null
    const out = this.out
    this.out = null
    if (out) {
      try {
        const now = out.context.currentTime
        out.gain.cancelScheduledValues(now)
        out.gain.setValueAtTime(out.gain.value, now)
        out.gain.linearRampToValueAtTime(0, now + 1.2)
        setTimeout(() => {
          try { out.disconnect() } catch {}
        }, 1400)
      } catch {}
    }
  }

  setIntensity(level: MusicIntensity) {
    this.intensity = level
    if (this.wanted && !this.running) this.tryStart()
  }

  getIntensity(): MusicIntensity {
    return this.intensity
  }

  isRunning(): boolean {
    return this.running
  }

  private tryStart() {
    if (this.running || !this.wanted) return
    const bus = soundManager.getMusicBus()
    if (!bus) return
    const { ctx } = bus
    try {
      this.out = ctx.createGain()
      this.out.gain.setValueAtTime(0, ctx.currentTime)
      this.out.gain.linearRampToValueAtTime(1, ctx.currentTime + 3)
      this.out.connect(bus.out)
    } catch {
      this.out = null
      return
    }
    this.running = true
    this.bar = 0
    this.nextBar = ctx.currentTime + 0.1
    this.timer = setInterval(() => this.schedule(ctx), 250)
    this.schedule(ctx)
  }

  private schedule(ctx: AudioContext) {
    if (!this.running || !this.out) return
    while (this.nextBar < ctx.currentTime + 1.2) {
      if (soundManager.isMusicAudible() && ctx.state === 'running') {
        try {
          this.scheduleBar(ctx, this.nextBar)
        } catch {}
      }
      this.nextBar += barSeconds(this.intensity)
      this.bar += 1
    }
  }

  private noiseBuffer(ctx: AudioContext): AudioBuffer {
    if (!this.noise) {
      const buf = ctx.createBuffer(1, Math.floor(ctx.sampleRate * 0.2), ctx.sampleRate)
      const data = buf.getChannelData(0)
      for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1
      this.noise = buf
    }
    return this.noise
  }

  private scheduleBar(ctx: AudioContext, t0: number) {
    const out = this.out!
    const level = this.intensity
    const dur = barSeconds(level)
    const beat = dur / 4
    const chord = progressionFor(level)[this.bar % 4]

    const filter = ctx.createBiquadFilter()
    filter.type = 'lowpass'
    filter.frequency.setValueAtTime(CUTOFF[level], t0)
    filter.Q.value = 0.7
    const padGain = ctx.createGain()
    padGain.gain.setValueAtTime(0, t0)
    padGain.gain.linearRampToValueAtTime(0.05, t0 + Math.min(1.4, dur * 0.35))
    padGain.gain.setValueAtTime(0.05, t0 + dur * 0.85)
    padGain.gain.linearRampToValueAtTime(0, t0 + dur + 1.2)
    filter.connect(padGain)
    padGain.connect(out)
    for (const n of chord) {
      for (const detune of [-7, 6]) {
        const osc = ctx.createOscillator()
        osc.type = level === 2 ? 'sawtooth' : 'triangle'
        osc.frequency.setValueAtTime(semis(A2 * 2, n), t0)
        osc.detune.setValueAtTime(detune, t0)
        osc.connect(filter)
        osc.start(t0)
        osc.stop(t0 + dur + 1.3)
      }
    }

    if (level >= 1) {
      const root = semis(A2 / 2, chord[0])
      const hits = level === 2 ? [0, 1, 2, 3] : [0, 2]
      for (const b of hits) this.pulse(ctx, t0 + b * beat, root, level === 2 ? 0.22 : 0.16)
    }

    if (level === 2) {
      for (let i = 0; i < 8; i++) this.tick(ctx, t0 + i * (beat / 2), i % 2 === 0 ? 0.03 : 0.018)
    }

    const sparkles = level === 0 ? 2 : level === 1 ? 3 : 4
    for (let i = 0; i < sparkles; i++) {
      const n = chord[(this.bar + i) % chord.length] + 24
      this.bell(ctx, t0 + (i * dur) / sparkles + beat * 0.5, semis(A2 * 2, n), level === 2 ? 0.02 : 0.028)
    }
  }

  private pulse(ctx: AudioContext, t: number, freq: number, peak: number) {
    const osc = ctx.createOscillator()
    const g = ctx.createGain()
    osc.type = 'sine'
    osc.frequency.setValueAtTime(freq * 2, t)
    osc.frequency.exponentialRampToValueAtTime(freq, t + 0.12)
    g.gain.setValueAtTime(0, t)
    g.gain.linearRampToValueAtTime(peak, t + 0.01)
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.5)
    osc.connect(g)
    g.connect(this.out!)
    osc.start(t)
    osc.stop(t + 0.55)
  }

  private tick(ctx: AudioContext, t: number, peak: number) {
    const src = ctx.createBufferSource()
    src.buffer = this.noiseBuffer(ctx)
    const hp = ctx.createBiquadFilter()
    hp.type = 'highpass'
    hp.frequency.value = 6000
    const g = ctx.createGain()
    g.gain.setValueAtTime(peak, t)
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.06)
    src.connect(hp)
    hp.connect(g)
    g.connect(this.out!)
    src.start(t)
    src.stop(t + 0.08)
  }

  private bell(ctx: AudioContext, t: number, freq: number, peak: number) {
    const osc = ctx.createOscillator()
    const g = ctx.createGain()
    osc.type = 'sine'
    osc.frequency.setValueAtTime(freq, t)
    g.gain.setValueAtTime(0, t)
    g.gain.linearRampToValueAtTime(peak, t + 0.02)
    g.gain.exponentialRampToValueAtTime(0.0001, t + 2.4)
    osc.connect(g)
    g.connect(this.out!)
    osc.start(t)
    osc.stop(t + 2.5)
  }
}

export const musicEngine = new MusicEngine()
