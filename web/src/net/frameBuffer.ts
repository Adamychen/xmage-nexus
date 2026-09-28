import type { ProxyMessage } from './types'

export interface FrameRecord {
  at: number
  kind: string
  bytes: number
  digest?: Record<string, string | number | boolean | null>
  full?: unknown
}

/**
 * `import.meta.env` only exists in a Vite-transformed context; this module is also imported
 * directly by Node-side test harnesses, where reading it at module scope throws.
 */
function isDevBuild(): boolean {
  try {
    return Boolean((import.meta as unknown as { env?: { DEV?: boolean } }).env?.DEV)
  } catch {
    return false
  }
}

/** Frames kept for the diagnostics bundle a player exports from About. */
export const FRAME_BUFFER_LIMITS = {
  MAX_FRAMES: 60,
  /**
   * A frame at or below this size is retained whole so the bundle can reproduce it; anything
   * larger keeps only its digest. A `GAME_UPDATE` is 200-800 KB, so retaining whole frames was
   * 60 x this many bytes per session. Development keeps the fat budget because reproducing a
   * real board state locally is the point; a shipped build keeps a small one, where the frames
   * worth having in a bug report are the prompts and results, not the bulk state pushes.
   */
  MAX_FULL_BYTES: isDevBuild() ? 64 * 1024 : 8 * 1024,
} as const

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

/** `rawLength` is the length of the frame as received: re-serializing a
 *  200–800 KB game frame only to measure it cost a stringify per frame on the
 *  main thread. */
export function recordFrame(msg: ProxyMessage, rawLength?: number): void {
  let bytes = 0
  let full: unknown
  if (typeof rawLength === 'number') {
    bytes = rawLength
  } else {
    try {
      bytes = JSON.stringify(msg).length
    } catch {
      bytes = -1
    }
  }
  if (bytes >= 0 && bytes <= FRAME_BUFFER_LIMITS.MAX_FULL_BYTES) full = msg
  // push + shift rather than a fresh array per frame: this runs on every inbound message
  frames.push({ at: Date.now(), kind: kindOf(msg), bytes, digest: digestOf(msg), full })
  if (frames.length > FRAME_BUFFER_LIMITS.MAX_FRAMES) frames.shift()
}

export function recentFrames(): FrameRecord[] {
  return [...frames]
}

export function clearFrames(): void {
  frames.length = 0
}
