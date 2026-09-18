/**
 * Sonda de latencia percibida (plan4 §5.4).
 *
 * SOLO DEV: `window.__magePerf` se publica únicamente con `import.meta.env.DEV`
 * (mismo patrón que sceneBridge) para que los E2E midan acuse visual y eco del
 * servidor sin depender del bridge de escena (que publica cada 500 ms).
 *
 * `mono` (performance.now) sirve para duraciones; `wall` (Date.now) para
 * correlacionar con los frames WS, que el harness sella con `__t`.
 */

export type PerfMarkKind = 'click' | 'ack' | 'event'

export interface PerfEntry {
  kind: PerfMarkKind
  name: string
  mono: number
  wall: number
  extra?: Record<string, unknown>
}

const CAPACITY = 200
let ring: PerfEntry[] = []
let ringNext = 0

export function perfMark(
  kind: PerfMarkKind,
  name: string,
  at?: number,
  extra?: Record<string, unknown>,
): void {
  if (!import.meta.env.DEV || typeof performance === 'undefined') return
  const entry: PerfEntry = {
    kind,
    name,
    mono: typeof at === 'number' ? at : performance.now(),
    wall: Date.now(),
  }
  if (extra) entry.extra = extra
  if (ring.length < CAPACITY) ring.push(entry)
  else ring[ringNext % CAPACITY] = entry
  ringNext++
}

/** Buffer circular en orden cronológico (los últimos CAPACITY). */
export function perfEntries(): PerfEntry[] {
  if (ring.length < CAPACITY) return ring.slice()
  const start = ringNext % CAPACITY
  return [...ring.slice(start), ...ring.slice(0, start)]
}

export function perfClear(): void {
  ring = []
  ringNext = 0
}

declare global {
  interface Window {
    __magePerf?: {
      mark: typeof perfMark
      entries: typeof perfEntries
      clear: typeof perfClear
    }
  }
}

if (import.meta.env.DEV && typeof window !== 'undefined') {
  window.__magePerf = { mark: perfMark, entries: perfEntries, clear: perfClear }
}
