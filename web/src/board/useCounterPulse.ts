import { useEffect, useRef, useState } from 'react'
import { fxMotionAllowed, fxOpacityAllowed } from './fx'

export const COUNTER_TICK_MS = 300
export const COUNTER_PULSE_MS = 800

export interface CounterPulse {
  seq: number
  direction: 'up' | 'down'
  delta: number
  /** Whether the badge may scale and the ring and label may rise; false under reduced motion or with effects off. */
  scale: boolean
  /** Whether the floating change label may show; false with effects off. */
  label: boolean
  /** True for the first COUNTER_TICK_MS of the change, while the number ticks. */
  tick: boolean
}

export interface CounterSample {
  name: string
  count: number
}

let pulseSeq = 0

/** The classes a counter badge wears while its count changes. */
export function counterPulseClass(pulse: CounterPulse | undefined): string {
  if (!pulse) return ''
  return ` counter-badge-changed counter-badge-${pulse.direction}${pulse.scale ? ' counter-badge-pulse' : ''}`
}

/** Reports the counters whose count changed since the previous render of the same permanent,
 *  keyed by counter name. The first sample is the baseline and never pulses, so a counter that
 *  appears with a card (or a card that enters) keeps its mount animation only. With `fromZero`
 *  (a player's counters) a counter missing from the previous sample counts as 0, so the first
 *  poison counter pulses too. */
export function useCounterPulse(counters: ReadonlyArray<CounterSample>, fromZero = false): Record<string, CounterPulse> {
  const previous = useRef<Map<string, number> | null>(null)
  const tickTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const pulseTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [pulses, setPulses] = useState<Record<string, CounterPulse>>({})

  useEffect(() => {
    const before = previous.current
    const now = new Map(counters.map((c) => [c.name, c.count] as const))
    previous.current = now
    if (before === null) return

    const changes: Record<string, CounterPulse> = {}
    for (const [name, count] of now) {
      const prev = before.get(name) ?? (fromZero ? 0 : undefined)
      if (prev === undefined || prev === count) continue
      changes[name] = {
        seq: ++pulseSeq,
        direction: count > prev ? 'up' : 'down',
        delta: count - prev,
        scale: fxMotionAllowed(),
        label: fxOpacityAllowed(),
        tick: true,
      }
    }
    if (Object.keys(changes).length === 0) return

    setPulses((current) => ({ ...current, ...changes }))
    if (tickTimer.current) clearTimeout(tickTimer.current)
    if (pulseTimer.current) clearTimeout(pulseTimer.current)
    tickTimer.current = setTimeout(() => {
      tickTimer.current = null
      setPulses((current) => Object.fromEntries(Object.entries(current).map(([name, p]) => [name, { ...p, tick: false }])))
    }, COUNTER_TICK_MS)
    pulseTimer.current = setTimeout(() => {
      pulseTimer.current = null
      setPulses({})
    }, COUNTER_PULSE_MS)
  }, [counters, fromZero])

  useEffect(() => () => {
    if (tickTimer.current) clearTimeout(tickTimer.current)
    if (pulseTimer.current) clearTimeout(pulseTimer.current)
  }, [])

  return pulses
}
