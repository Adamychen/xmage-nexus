import { getState } from '../state/state'
import { buildDiagnosticBundle, type DiagnosticBundle } from './diagnostics'
import { recentErrors, type ErrorRecord } from './errorLog'
import { recentFrames, type FrameRecord } from '../net/frameBuffer'

/**
 * What a report carries, and the sizes it has to fit in. The payload cap is the proxy's
 * (`Config.DEFAULT_REPORT_MAX_FILE_BYTES`): a `GAME_UPDATE` is 200-800 KB, so shipping the frame
 * buffer whole would mean every report is refused, which is the same as having no channel.
 */
export const REPORT_LIMITS = {
  MAX_PAYLOAD_BYTES: 96 * 1024,
  FRAME_BUDGET_BYTES: 32 * 1024,
  MAX_WHOLE_FRAMES: 12,
  MAX_LOG_LINES: 120,
  SHORT_LOG_LINES: 40,
} as const

export type ReportKind = 'bug' | 'feedback'

/**
 * The wire shape. Flat, because the proxy reads `bundle.game.turn` for its one-line summary and
 * keeps the body in a file: `bundle` is the same object the About dialog downloads, so a report
 * and a downloaded bundle are comparable by eye.
 */
export interface ReportWire {
  kind: ReportKind
  fingerprint: string
  text: string
  at: number
  viewport: { width: number; height: number; dpr: number }
  errors: ErrorRecord[]
  bundle: DiagnosticBundle
}

export interface DraftReport {
  kind: ReportKind
  text: string
  fingerprint: string
  wire: ReportWire
  bytes: number
}

function sizeOf(wire: ReportWire): number {
  try {
    return JSON.stringify(wire).length
  } catch {
    return Number.MAX_SAFE_INTEGER
  }
}

/**
 * Whole frames are worth having only for the last few, and only while they fit: the interesting
 * frames in a bug report are the prompts and the results, not the bulk state pushes. Walked
 * backwards, so what survives is the end of the story.
 */
export function trimFrames(frames: FrameRecord[], budget: number, maxWhole: number): FrameRecord[] {
  const keep = new Set<FrameRecord>()
  let used = 0
  let whole = 0
  for (let i = frames.length - 1; i >= 0; i--) {
    const frame = frames[i]
    if (frame.full === undefined || whole >= maxWhole) continue
    let size = 0
    try {
      size = JSON.stringify(frame.full).length
    } catch {
      continue
    }
    if (used + size > budget) continue
    keep.add(frame)
    used += size
    whole++
  }
  return frames.map((frame) =>
    keep.has(frame) ? frame : { at: frame.at, kind: frame.kind, bytes: frame.bytes, digest: frame.digest },
  )
}

/**
 * A grouping key, not an identity: two players hitting the same thing should land in one row of
 * the dashboard, which is why the game id and the player's own words are deliberately left out.
 * Digits are flattened, so "lost 4 life" and "lost 7 life" are one problem.
 */
export function fingerprintOf(kind: ReportKind): string {
  const state = getState()
  const game = state.game as { turn?: unknown; step?: unknown } | null | undefined
  const turn = typeof game?.turn === 'number' ? `turn${game.turn}` : state.phase
  const step = typeof game?.step === 'string' ? game.step : 'no-step'
  const errors = recentErrors()
  const last = errors.length > 0 ? errors[errors.length - 1].text : 'no-error'
  const key = last
    .toLowerCase()
    .replace(/[0-9]+/g, '#')
    .replace(/[^a-z0-9+#]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60)
  return `${kind}|${turn}|${step}|${key || 'empty'}`
}

/** The snapshot a report carries: the diagnostics bundle, shrunk to what a report can hold. */
export function buildReport(kind: ReportKind, text: string): DraftReport {
  const viewport =
    typeof window !== 'undefined'
      ? {
          width: window.innerWidth,
          height: window.innerHeight,
          dpr: Math.round(window.devicePixelRatio * 100) / 100,
        }
      : { width: 0, height: 0, dpr: 1 }
  const fingerprint = fingerprintOf(kind)
  const bundle = buildDiagnosticBundle()
  let wire: ReportWire = {
    kind,
    fingerprint,
    text,
    at: Date.now(),
    viewport,
    errors: recentErrors(),
    bundle: {
      ...bundle,
      log: bundle.log.slice(-REPORT_LIMITS.MAX_LOG_LINES),
      frames: trimFrames(recentFrames(), REPORT_LIMITS.FRAME_BUDGET_BYTES, REPORT_LIMITS.MAX_WHOLE_FRAMES),
    },
  }

  if (sizeOf(wire) > REPORT_LIMITS.MAX_PAYLOAD_BYTES) {
    wire = { ...wire, bundle: { ...wire.bundle, frames: wire.bundle.frames.map(dropFull) } }
  }
  if (sizeOf(wire) > REPORT_LIMITS.MAX_PAYLOAD_BYTES) {
    wire = {
      ...wire,
      bundle: {
        ...wire.bundle,
        log: wire.bundle.log.slice(-REPORT_LIMITS.SHORT_LOG_LINES).map((line) => ({
          ...line,
          text: line.text.slice(0, 200),
        })),
      },
    }
  }

  const bytes = sizeOf(wire)
  return { kind, text, fingerprint, wire, bytes }
}

function dropFull(frame: FrameRecord): FrameRecord {
  return { at: frame.at, kind: frame.kind, bytes: frame.bytes, digest: frame.digest }
}

/** Plain text, for the clipboard: what a player pastes when there is nothing to send to. */
export function reportToMarkdown(draft: DraftReport): string {
  const { bundle } = draft.wire
  const players = bundle.game?.players.map((p) => `${p.name} (${String(p.life)})`).join(', ') ?? 'no game'
  const turn = bundle.game ? `, turn ${String(bundle.game.turn)}, step ${String(bundle.game.step)}` : ''
  return [
    '**What happened**',
    '',
    draft.text || '(no description)',
    '',
    '**Environment**',
    '',
    `- Client: ${bundle.appVersion}`,
    `- Proxy: ${bundle.conn.wsUrl ?? 'none'}${bundle.conn.wsAlive ? '' : ' (not connected)'}`,
    `- Server: ${bundle.conn.serverHost ?? 'none'}:${String(bundle.conn.port ?? 0)}`,
    `- Game: ${players}${turn}`,
    `- Screen: ${draft.wire.viewport.width}x${draft.wire.viewport.height} at ${draft.wire.viewport.dpr}x`,
    `- Language: ${bundle.language}`,
    '',
    '**Errors**',
    '',
    draft.wire.errors.length > 0 ? draft.wire.errors.map((e) => `- ${e.text}`).join('\n') : '- none recorded',
    '',
    `_Fingerprint: \`${draft.fingerprint}\` - payload ${draft.bytes} bytes_`,
  ].join('\n')
}
