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

    case 'player_join': {
      const duration = 0.75
      const buf = makeBuffer(ctx, duration)
      const data = buf.getChannelData(0)
      const sr = ctx.sampleRate
      const notes = [
        { freq: 523.25, start: 0 },
        { freq: 659.25, start: 0.14 },
        { freq: 783.99, start: 0.28 },
        { freq: 1046.5, start: 0.42 },
      ]
      for (let i = 0; i < data.length; i++) {
        const t = i / sr
        let v = 0
        for (const n of notes) {
          if (t < n.start) continue
          const nt = t - n.start
          v += Math.sin(2 * Math.PI * n.freq * nt) * Math.min(1, nt / 0.008) * Math.exp(-nt * 6)
        }
        data[i] = Math.max(-1, Math.min(1, v * 0.4))
      }
      return buf
    }

    case 'player_leave': {
      const duration = 0.16
      const buf = makeBuffer(ctx, duration)
      const data = buf.getChannelData(0)
      const sr = ctx.sampleRate
      for (let i = 0; i < data.length; i++) {
        const t = i / sr
        const env = Math.exp(-t * 16)
        const f1 = Math.sin(2 * Math.PI * 783.99 * t) * (t < 0.07 ? 0.55 : 0.1)
        const f2 = t >= 0.06 ? Math.sin(2 * Math.PI * 523.25 * (t - 0.06)) * 0.65 : 0
        data[i] = (f1 + f2) * env * 0.5
      }
      return buf
    }
    case 'impact_heavy':
    case 'impact_epic': {
      const epic = key === 'impact_epic'
      const duration = epic ? 1.1 : 0.6
      const buf = makeBuffer(ctx, duration)
      const data = buf.getChannelData(0)
      const sr = ctx.sampleRate
      let lp = 0
      for (let i = 0; i < data.length; i++) {
        const t = i / sr
        const env = Math.exp(-t * (epic ? 3.2 : 5.5))
        const freq = (epic ? 62 : 78) * Math.exp(-t * 6) + (epic ? 28 : 34)
        const sub = Math.sin(2 * Math.PI * freq * t)
        const white = Math.random() * 2 - 1
        lp = lp * 0.96 + white * 0.04
        const crack = t < 0.03 ? white * (1 - t / 0.03) * 0.5 : 0
        const rumble = lp * 6 * Math.exp(-t * 4)
        const shimmer = epic ? Math.sin(2 * Math.PI * 523.25 * t) * Math.exp(-t * 2.4) * 0.12 * Math.min(1, t / 0.12) : 0
        data[i] = Math.tanh((sub * 0.95 + rumble * 0.35 + crack) * 1.6) * env * 0.8 + shimmer
      }
      return buf
    }

    case 'heartbeat': {
      const duration = 0.42
      const buf = makeBuffer(ctx, duration)
      const data = buf.getChannelData(0)
      const sr = ctx.sampleRate
      const beat = (t: number) => {
        if (t < 0) return 0
        const env = Math.exp(-t * 26) * Math.min(1, t / 0.006)
        const freq = 58 * Math.exp(-t * 9) + 36
        return Math.sin(2 * Math.PI * freq * t) * env
      }
      for (let i = 0; i < data.length; i++) {
        const t = i / sr
        data[i] = Math.tanh((beat(t) + beat(t - 0.17) * 0.7) * 1.8) * 0.7
      }
      return buf
    }

    case 'exile': {
      const duration = 0.7
      const buf = makeBuffer(ctx, duration)
      const data = buf.getChannelData(0)
      const sr = ctx.sampleRate
      let hp = 0
      let prev = 0
      for (let i = 0; i < data.length; i++) {
        const t = i / sr
        const attack = Math.min(1, t / 0.05)
        const env = attack * Math.exp(-t * 4.2)
        const rise = 660 + 900 * (t / duration)
        const tone = Math.sin(2 * Math.PI * rise * t) * 0.25 + Math.sin(2 * Math.PI * rise * 1.5 * t) * 0.12
        const white = Math.random() * 2 - 1
        hp = 0.9 * (hp + white - prev)
        prev = white
        data[i] = (tone + hp * 0.12) * env * 0.55
      }
      return buf
    }

    case 'projectile_launch': {
      const duration = 0.32
      const buf = makeBuffer(ctx, duration)
      const data = buf.getChannelData(0)
      const sr = ctx.sampleRate
      let low = 0
      for (let i = 0; i < data.length; i++) {
        const t = i / sr
        const env = Math.min(1, t / 0.03) * Math.exp(-t * 8)
        const cutoff = 350 + 700 * Math.sin((Math.PI * t) / duration)
        low += (1 - Math.exp((-2 * Math.PI * cutoff) / sr)) * (Math.random() * 2 - 1 - low)
        const body = Math.sin(2 * Math.PI * (170 + 60 * (t / duration)) * t) * 0.3
        data[i] = (low * 0.9 + body) * env * 0.35
      }
      return buf
    }

    case 'card_land': {
      const duration = 0.32
      const buf = makeBuffer(ctx, duration)
      const data = buf.getChannelData(0)
      const sr = ctx.sampleRate
      let lp = 0
      for (let i = 0; i < data.length; i++) {
        const t = i / sr
        const body = Math.sin(2 * Math.PI * (55 + 110 * Math.exp(-t * 28)) * t) * Math.exp(-t * 16)
        const wood = Math.sin(2 * Math.PI * 240 * t) * Math.exp(-t * 55) * 0.25
        const white = Math.random() * 2 - 1
        lp = lp * 0.7 + white * 0.3
        const tuff = lp * Math.exp(-t * 45) * 0.45
        data[i] = Math.tanh((body * 1.1 + wood + tuff) * 1.5) * 0.7
      }
      return buf
    }

    case 'projectile_impact': {
      const duration = 0.3
      const buf = makeBuffer(ctx, duration)
      const data = buf.getChannelData(0)
      const sr = ctx.sampleRate
      for (let i = 0; i < data.length; i++) {
        const t = i / sr
        const body = Math.sin(2 * Math.PI * (90 + 150 * Math.exp(-t * 30)) * t) * Math.exp(-t * 18) * 0.8
        const click = (Math.random() * 2 - 1) * Math.exp(-t * 400) * 0.5
        const shimmer = Math.sin(2 * Math.PI * 1320 * t) * Math.exp(-t * 30) * 0.15
        data[i] = Math.tanh((body + click + shimmer) * 1.4) * 0.6
      }
      return buf
    }

    case 'coin_flip': {
      const duration = 1.5
      const buf = makeBuffer(ctx, duration)
      const data = buf.getChannelData(0)
      const sr = ctx.sampleRate
      const clinks = [1.05, 1.17]
      for (let i = 0; i < data.length; i++) {
        const t = i / sr
        const wobble = 0.6 + 0.4 * Math.sin(2 * Math.PI * 28 * t)
        const ring = (Math.sin(2 * Math.PI * 2650 * t) + Math.sin(2 * Math.PI * 4100 * t) * 0.3) * Math.exp(-t * 4.5) * wobble * 0.35
        let clink = 0
        for (const at of clinks) {
          if (t < at) continue
          const dt = t - at
          clink += Math.sin(2 * Math.PI * 3520 * dt) * Math.exp(-dt * 60) * 0.5
          clink += (Math.random() * 2 - 1) * Math.exp(-dt * 900) * 0.4
        }
        data[i] = Math.tanh((ring + clink) * 1.2) * 0.8
      }
      return buf
    }

    case 'shuffle': {
      const duration = 0.62
      const buf = makeBuffer(ctx, duration)
      const data = buf.getChannelData(0)
      const sr = ctx.sampleRate
      const onePole = (hz: number) => 1 - Math.exp((-2 * Math.PI * hz) / sr)
      // Riffle: card edges slipping off the thumb, spacing shrinking from 28 ms to 11 ms.
      const flicks: Array<{ at: number; amp: number; decay: number }> = []
      for (let at = 0.03, n = 0; at < 0.4; n++) {
        flicks.push({ at, amp: 0.55 + Math.random() * 0.45, decay: 140 + Math.random() * 80 })
        at += 0.028 - 0.017 * Math.min(1, n / 18) + (Math.random() - 0.5) * 0.004
      }
      const settleAt = 0.44
      const lpFlick = onePole(2000)
      const hpFlick = onePole(450)
      const lpBed = onePole(900)
      const lpTap = onePole(420)
      let f1 = 0
      let f2 = 0
      let fLow = 0
      let fHigh = 0
      let bed1 = 0
      let bed = 0
      let tap1 = 0
      let tapNoise = 0
      let next = 0
      let current = -1
      let peak = 0
      for (let i = 0; i < data.length; i++) {
        const t = i / sr
        while (next < flicks.length && flicks[next].at <= t) current = next++
        const white = Math.random() * 2 - 1
        let flick = 0
        if (current >= 0) {
          const f = flicks[current]
          const dt = t - f.at
          const env = Math.min(1, dt / 0.0008) * Math.exp(-dt * f.decay)
          flick = white * env * f.amp
        }
        f1 += lpFlick * (flick - f1)
        f2 += lpFlick * (f1 - f2)
        fLow += lpFlick * (f2 - fLow)
        fHigh += hpFlick * (fLow - fHigh)
        const swell = t < 0.42 ? Math.sin(Math.PI * Math.min(1, t / 0.42)) ** 0.5 : 0
        bed1 += lpBed * (white - bed1)
        bed += lpBed * (bed1 - bed)
        let settle = 0
        if (t >= settleAt) {
          const dt = t - settleAt
          tap1 += lpTap * (white - tap1)
          tapNoise += lpTap * (tap1 - tapNoise)
          settle = tapNoise * Math.exp(-dt * 38) * 5 + Math.sin(2 * Math.PI * 105 * dt) * Math.exp(-dt * 28) * 0.22
        }
        const v = (fLow - fHigh) * swell * 6 + bed * swell * 0.25 + settle
        data[i] = v
        peak = Math.max(peak, Math.abs(v))
      }
      const fadeFrom = Math.floor(sr * (duration - 0.04))
      const gain = peak > 0 ? 0.5 / peak : 0
      for (let i = 0; i < data.length; i++) {
        const fade = i > fadeFrom ? Math.max(0, 1 - (i - fadeFrom) / (data.length - fadeFrom)) : 1
        data[i] *= gain * fade
      }
      return buf
    }

    case 'dice_roll': {
      const duration = 1.1
      const buf = makeBuffer(ctx, duration)
      const data = buf.getChannelData(0)
      const sr = ctx.sampleRate
      // Bounces on the table: each clack quieter and closer to the previous one, then a short rattle.
      const clacks: Array<{ at: number; amp: number; hz: number }> = []
      let at = 0.12
      let gap = 0.2
      let amp = 1
      while (at < 0.95 && amp > 0.08) {
        clacks.push({ at, amp, hz: 1700 + Math.random() * 900 })
        at += gap
        gap *= 0.62
        amp *= 0.72
      }
      const lp = 1 - Math.exp((-2 * Math.PI * 3200) / sr)
      let low = 0
      let peak = 0
      for (let i = 0; i < data.length; i++) {
        const t = i / sr
        let v = 0
        for (const c of clacks) {
          if (t < c.at) break
          const dt = t - c.at
          if (dt > 0.08) continue
          v += Math.sin(2 * Math.PI * c.hz * dt) * Math.exp(-dt * 90) * c.amp * 0.6
          v += Math.sin(2 * Math.PI * 180 * dt) * Math.exp(-dt * 60) * c.amp * 0.5
          v += (Math.random() * 2 - 1) * Math.exp(-dt * 700) * c.amp * 0.5
        }
        low += lp * (v - low)
        data[i] = low
        peak = Math.max(peak, Math.abs(low))
      }
      const gain = peak > 0 ? 0.55 / peak : 0
      for (let i = 0; i < data.length; i++) data[i] *= gain
      return buf
    }
  }
}
