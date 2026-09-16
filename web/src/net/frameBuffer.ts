import type { ProxyMessage } from './types'

export interface FrameRecord {
  at: number
  kind: string
  bytes: number
  digest?: Record<string, string | number | boolean | null>
  full?: unknown
}

const MAX_FRAMES = 60
const MAX_FULL_BYTES = 64 * 1024

let frames: FrameRecord[] = []

function digestOf(msg: ProxyMessage): Record<string, string | number | boolean | null> | undefined {
  if (msg.type !== 'event') return undefined
  const data = msg.data
  if (typeof data !== 'object' || data === null) return { method: msg.method }
  const d = data as Record<string, unknown>
  const pick = (k: string): string | number | boolean | null => {
    const v = d[k]
    return typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean' ? v : v == null ? null : '[obj]'
  }
  return {
    method: msg.method,
    gameId: pick('gameId'),
    turn: pick('turn'),
    phase: pick('phase'),
    step: pick('step'),
  }
}

function kindOf(msg: ProxyMessage): string {
  if (msg.type === 'event') return `event:${msg.method}`
  if (msg.type === 'result') return `result:${msg.action}:${msg.ok ? 'ok' : 'err'}`
  if (msg.type === 'lobby') return `lobby:${msg.tables?.length ?? 0}`
  return msg.type
}

export function recordFrame(msg: ProxyMessage): void {
  let bytes = 0
  let full: unknown
  try {
    bytes = JSON.stringify(msg).length
    if (bytes <= MAX_FULL_BYTES) full = msg
  } catch {
    bytes = -1
  }
  frames = [...frames.slice(-(MAX_FRAMES - 1)), { at: Date.now(), kind: kindOf(msg), bytes, digest: digestOf(msg), full }]
}

export function recentFrames(): FrameRecord[] {
  return [...frames]
}

export function clearFrames(): void {
  frames = []
}

export const FRAME_BUFFER_LIMITS = { MAX_FRAMES, MAX_FULL_BYTES }
