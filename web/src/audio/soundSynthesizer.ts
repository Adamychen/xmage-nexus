import type { SoundKey } from './types'

function makeBuffer(ctx: AudioContext, duration: number): AudioBuffer {
  return ctx.createBuffer(1, Math.max(1, Math.floor(ctx.sampleRate * duration)), ctx.sampleRate)
}

export function synthesizeSound(ctx: AudioContext, key: SoundKey): AudioBuffer {
  switch (key) {
    case 'tap': {
      const duration = 0.05
      const buf = makeBuffer(ctx, duration)
      const data = buf.getChannelData(0)
      const sr = ctx.sampleRate
      for (let i = 0; i < data.length; i++) {
        const t = i / sr
        const env = Math.exp(-t * 85)
        const freq = 580 * Math.exp(-t * 90) + 120
        const sine = Math.sin(2 * Math.PI * freq * t)
        const noise = (Math.random() * 2 - 1) * Math.exp(-t * 350) * 0.4
        data[i] = (sine * 0.8 + noise) * env * 0.9
      }
      return buf
    }

    case 'play_card': {
      const duration = 0.11
      const buf = makeBuffer(ctx, duration)
      const data = buf.getChannelData(0)
      const sr = ctx.sampleRate
      for (let i = 0; i < data.length; i++) {
        const t = i / sr
        const slide = (Math.random() * 2 - 1) * 0.25 * Math.exp(-t * 80)
        const env = Math.exp(-t * 38)
        const freq = 140 * Math.exp(-t * 40) + 50
        const thump = Math.sin(2 * Math.PI * freq * t) * env
        data[i] = Math.tanh((thump * 0.85 + slide) * 1.3) * 0.85
      }
      return buf
    }

    case 'draw': {
      const duration = 0.1
      const buf = makeBuffer(ctx, duration)
      const data = buf.getChannelData(0)
      const sr = ctx.sampleRate
      let b0 = 0
      let b1 = 0
      for (let i = 0; i < data.length; i++) {
        const t = i / sr
        const env = Math.sin(Math.PI * Math.pow(t / duration, 0.6)) * Math.exp(-t * 18)
        const white = Math.random() * 2 - 1
        b0 = 0.92 * b0 + white * 0.08
        b1 = 0.88 * b1 + b0 * 0.12
        const tone = Math.sin(2 * Math.PI * (420 - 220 * (t / duration)) * t) * 0.4
        const flickT = Math.abs(t - 0.025)
        const flick = Math.exp(-flickT * 180) * Math.sin(2 * Math.PI * 520 * t) * 0.5
        data[i] = (b1 * 3.5 + tone + flick) * env * 1.05
      }
      return buf
    }

    case 'stack_cast': {
      const duration = 0.28
      const buf = makeBuffer(ctx, duration)
      const data = buf.getChannelData(0)
      const sr = ctx.sampleRate
      for (let i = 0; i < data.length; i++) {
        const t = i / sr
        const attack = Math.min(1, t / 0.015)
        const decay = Math.exp(-t * 12)
        const env = attack * decay
        const s1 = Math.sin(2 * Math.PI * 329.63 * t)
        const s2 = Math.sin(2 * Math.PI * 440 * t) * 0.7
        const s3 = Math.sin(2 * Math.PI * 659.25 * t) * 0.5
        const whoosh = (Math.random() * 2 - 1) * Math.exp(-t * 20) * 0.12
        data[i] = (s1 + s2 + s3 + whoosh) * env * 0.35
      }
      return buf
    }

    case 'priority': {
      const duration = 0.38
      const buf = makeBuffer(ctx, duration)
      const data = buf.getChannelData(0)
      const sr = ctx.sampleRate
      for (let i = 0; i < data.length; i++) {
        const t = i / sr
        const attack = Math.min(1, t / 0.008)
        const decay = Math.exp(-t * 7.5)
        const env = attack * decay
        const f1 = Math.sin(2 * Math.PI * 523.25 * t)
        const f2 = Math.sin(2 * Math.PI * 783.99 * t) * 0.4
        const f3 = Math.sin(2 * Math.PI * 1568 * t) * 0.15
        data[i] = (f1 + f2 + f3) * env * 0.4
      }
      return buf
    }

    case 'combat_hit': {
      const duration = 0.16
      const buf = makeBuffer(ctx, duration)
      const data = buf.getChannelData(0)
      const sr = ctx.sampleRate
      for (let i = 0; i < data.length; i++) {
        const t = i / sr
        const env = Math.exp(-t * 22)
        const freq = 120 * Math.exp(-t * 35) + 38
        const crunch = t < 0.015 ? (Math.random() * 2 - 1) * 0.3 : 0
        const body = Math.sin(2 * Math.PI * freq * t)
        data[i] = Math.tanh((body + crunch) * 1.3) * env * 0.65
      }
      return buf
    }

    case 'life_gain': {
      const duration = 0.32
      const buf = makeBuffer(ctx, duration)
      const data = buf.getChannelData(0)
      const sr = ctx.sampleRate
      for (let i = 0; i < data.length; i++) {
        const t = i / sr
        const env = Math.exp(-t * 8)
        const f1 = Math.sin(2 * Math.PI * 440 * t) * (t < 0.09 ? 0.6 : 0.2)
        const f2 = t >= 0.08 ? Math.sin(2 * Math.PI * 880 * (t - 0.08)) * 0.6 : 0
        const f3 = t >= 0.08 ? Math.sin(2 * Math.PI * 1320 * (t - 0.08)) * 0.25 : 0
        data[i] = (f1 + f2 + f3) * env * 0.45
      }
      return buf
    }

    case 'life_loss': {
      const duration = 0.15
      const buf = makeBuffer(ctx, duration)
      const data = buf.getChannelData(0)
      const sr = ctx.sampleRate
      for (let i = 0; i < data.length; i++) {
        const t = i / sr
        const env = Math.exp(-t * 24)
        const freq = 90 * Math.exp(-t * 25) + 36
        data[i] = Math.sin(2 * Math.PI * freq * t) * env * 0.6
      }
      return buf
    }

    case 'destroy': {
      const duration = 0.22
      const buf = makeBuffer(ctx, duration)
      const data = buf.getChannelData(0)
      const sr = ctx.sampleRate
      for (let i = 0; i < data.length; i++) {
        const t = i / sr
        const env = Math.exp(-t * 15)
        const noise = (Math.random() * 2 - 1) * 0.35
        const rumble = Math.sin(2 * Math.PI * 75 * t) * 0.3
        data[i] = (noise + rumble) * env * 0.5
      }
      return buf
    }

    case 'game_start': {
      const duration = 0.3
      const buf = makeBuffer(ctx, duration)
      const data = buf.getChannelData(0)
      const sr = ctx.sampleRate
      for (let i = 0; i < data.length; i++) {
        const t = i / sr
        const n1 = Math.sin(2 * Math.PI * 440 * t) * Math.exp(-t * 14) * (t < 0.12 ? 0.6 : 0.1)
        const n2 = t >= 0.1 ? Math.sin(2 * Math.PI * 659.25 * (t - 0.1)) * Math.exp(-(t - 0.1) * 10) * 0.7 : 0
        data[i] = (n1 + n2) * 0.45
      }
      return buf
    }

    case 'victory': {
      const duration = 0.7
      const buf = makeBuffer(ctx, duration)
      const data = buf.getChannelData(0)
      const sr = ctx.sampleRate
      for (let i = 0; i < data.length; i++) {
        const t = i / sr
        const env = Math.exp(-t * 3.5)
        const c4 = Math.sin(2 * Math.PI * 261.63 * t) * 0.4
        const g4 = t > 0.08 ? Math.sin(2 * Math.PI * 392 * (t - 0.08)) * 0.4 : 0
        const c5 = t > 0.16 ? Math.sin(2 * Math.PI * 523.25 * (t - 0.16)) * 0.5 : 0
        const e5 = t > 0.24 ? Math.sin(2 * Math.PI * 659.25 * (t - 0.24)) * 0.4 : 0
        data[i] = (c4 + g4 + c5 + e5) * env * 0.35
      }
      return buf
    }

    case 'defeat': {
      const duration = 0.7
      const buf = makeBuffer(ctx, duration)
      const data = buf.getChannelData(0)
      const sr = ctx.sampleRate
      for (let i = 0; i < data.length; i++) {
        const t = i / sr
        const env = Math.exp(-t * 3.2)
        const d4 = Math.sin(2 * Math.PI * 293.66 * t) * 0.4
        const f4 = Math.sin(2 * Math.PI * 349.23 * t) * 0.35
        const a3 = Math.sin(2 * Math.PI * 220 * t) * 0.4
        data[i] = (d4 + f4 + a3) * env * 0.35
      }
      return buf
    }

    case 'timer_tick': {
      const duration = 0.018
      const buf = makeBuffer(ctx, duration)
      const data = buf.getChannelData(0)
      const sr = ctx.sampleRate
      for (let i = 0; i < data.length; i++) {
        const t = i / sr
        const env = Math.exp(-t * 220)
        const freq = 950 * Math.exp(-t * 250) + 200
        data[i] = Math.sin(2 * Math.PI * freq * t) * env * 0.5
      }
      return buf
    }

    case 'ui_click': {
      const duration = 0.012
      const buf = makeBuffer(ctx, duration)
      const data = buf.getChannelData(0)
      const sr = ctx.sampleRate
      for (let i = 0; i < data.length; i++) {
        const t = i / sr
        const env = Math.exp(-t * 300)
        const freq = 1200 * Math.exp(-t * 350) + 300
        data[i] = Math.sin(2 * Math.PI * freq * t) * env * 0.5
      }
      return buf
    }

    case 'prompt_open': {
      const duration = 0.16
      const buf = makeBuffer(ctx, duration)
      const data = buf.getChannelData(0)
      const sr = ctx.sampleRate
      for (let i = 0; i < data.length; i++) {
        const t = i / sr
        const env = Math.exp(-t * 16)
        const f1 = Math.sin(2 * Math.PI * 659.25 * t) * (t < 0.07 ? 0.55 : 0.1)
        const f2 = t >= 0.06 ? Math.sin(2 * Math.PI * 987.77 * (t - 0.06)) * 0.65 : 0
        data[i] = (f1 + f2) * env * 0.5
      }
      return buf
    }

    case 'whisper': {
      const duration = 0.14
      const buf = makeBuffer(ctx, duration)
      const data = buf.getChannelData(0)
      const sr = ctx.sampleRate
      for (let i = 0; i < data.length; i++) {
        const t = i / sr
        const env = Math.exp(-t * 18)
        const f1 = Math.sin(2 * Math.PI * 740 * t) * (t < 0.06 ? 0.5 : 0.1)
        const f2 = t >= 0.05 ? Math.sin(2 * Math.PI * 987.77 * (t - 0.05)) * 0.6 : 0
        data[i] = (f1 + f2) * env * 0.45
      }
      return buf
    }
  }
}
