/**
 * The errors a player never has to describe. Kept separate from `state.log` because that one is
 * the visible play log (capped, and it moves on): this is a last-resort record of what the page
 * actually threw, and it is only ever read when a report is built.
 */
export interface ErrorRecord {
  at: number
  source: 'window' | 'rejection' | 'boundary' | 'app'
  text: string
}

const MAX_ERRORS = 50
const MAX_TEXT = 300

let errors: ErrorRecord[] = []
let installed = false

export function recordError(source: ErrorRecord['source'], text: string, at = Date.now()): void {
  const clean = text.replace(/\s+/g, ' ').trim().slice(0, MAX_TEXT)
  if (!clean) return
  if (errors.length >= MAX_ERRORS) errors.shift()
  errors.push({ at, source, text: clean })
}

export function recentErrors(): ErrorRecord[] {
  return [...errors]
}

export function clearErrors(): void {
  errors = []
}

/**
 * Idempotent, and safe where there is no window (Node harnesses): a reload is what clears the
 * buffer, so without these two listeners the most reportable kind of failure — the one that
 * killed the page — is exactly the one a report cannot carry.
 */
export function installErrorCapture(): void {
  if (installed || typeof window === 'undefined') return
  installed = true
  window.addEventListener('error', (event) => {
    const where = event.filename ? ` at ${event.filename}:${event.lineno ?? 0}` : ''
    recordError('window', `${event.message ?? 'error'}${where}`)
  })
  window.addEventListener('unhandledrejection', (event) => {
    recordError('rejection', String(event.reason ?? 'unhandled rejection'))
  })
}
