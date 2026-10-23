// @ts-nocheck
/**
 * Coverage no-regression gate.
 *
 * The vitest thresholds (lines/functions/branches/statements) catch a drop below a fixed
 * floor, but not a drift from one level to another while still above it. This gate compares
 * each freshly generated `web/coverage/coverage-summary.json` against the previous run's
 * summary (`web/coverage-previous.json`) and fails when any metric drops more than
 * `tolerance` points, so a regression is caught even while it stays above the thresholds.
 *
 * The previous summary is re-recorded on every passing run (and on the first run, which only
 * records the baseline without failing), so the comparison is always against the last known
 * good run.
 */
import fs from 'node:fs'
import path from 'node:path'
import { repoRoot } from './lib.mjs'

export const METRICS = ['lines', 'functions', 'branches', 'statements']
export const DEFAULT_TOLERANCE = 1.0

const DEFAULT_SUMMARY = () => path.join(repoRoot, 'web', 'coverage', 'coverage-summary.json')
// Lives OUTSIDE web/coverage on purpose: vitest's coverage provider empties the coverage output
// directory on every run, so a previous summary stored there would be wiped before the gate reads it.
const DEFAULT_PREVIOUS = () => path.join(repoRoot, 'web', 'coverage-previous.json')

/** Extracts `{metric: pct}` from a vitest json-summary file; null when missing/unreadable. */
export function readCoveragePercentages(file) {
  try {
    const parsed = JSON.parse(fs.readFileSync(file, 'utf8'))
    if (!parsed || !parsed.total) return null
    const out = {}
    for (const m of METRICS) {
      if (parsed.total[m] && typeof parsed.total[m].pct === 'number') out[m] = parsed.total[m].pct
    }
    return Object.keys(out).length ? out : null
  } catch {
    return null
  }
}

function fmt(metrics) {
  return METRICS.map((m) => `${m}=${metrics[m]}%`).join(', ')
}

function recordPrevious(file, metrics) {
  fs.mkdirSync(path.dirname(file), { recursive: true })
  const total = {}
  for (const m of METRICS) total[m] = { pct: metrics[m] }
  fs.writeFileSync(file, JSON.stringify({ total, recordedAt: new Date().toISOString() }, null, 2) + '\n')
}

/**
 * Gate entry point. Returns `{ ok, message, drops, recordedBaseline }`; when `ok` is false the
 * caller must fail its layer. Paths are injectable for tests (default: the web coverage dir).
 */
export function enforceCoverageGate(opts = {}) {
  const summaryFile = opts.summaryFile ?? DEFAULT_SUMMARY()
  const previousFile = opts.previousFile ?? DEFAULT_PREVIOUS()
  const tolerance = opts.tolerance ?? DEFAULT_TOLERANCE

  const current = readCoveragePercentages(summaryFile)
  if (!current) {
    return {
      ok: false,
      message: `Coverage no-regression gate: no summary at ${summaryFile} (run vitest --coverage first)`,
    }
  }

  const previous = readCoveragePercentages(previousFile)
  if (!previous) {
    recordPrevious(previousFile, current)
    return {
      ok: true,
      recordedBaseline: true,
      drops: [],
      message: `Coverage no-regression gate: first run — recorded baseline ${fmt(current)} (no previous summary)`,
    }
  }

  const drops = []
  for (const m of METRICS) {
    if (typeof previous[m] !== 'number') continue
    const currentPct = typeof current[m] === 'number' ? current[m] : 0
    const drop = previous[m] - currentPct
    if (drop > tolerance) drops.push({ metric: m, previous: previous[m], current: currentPct, drop })
  }

  if (drops.length) {
    const detail = drops
      .map((d) => `  ${d.metric}: ${d.previous}% -> ${d.current}% (${d.drop.toFixed(2)} pts below the previous run; max allowed ${tolerance} pt)`)
      .join('\n')
    return {
      ok: false,
      drops,
      message:
        `Coverage no-regression gate: coverage dropped more than ${tolerance} point(s) vs the previous run:\n` +
        `${detail}\nFix the regression before proceeding (the previous summary ${previousFile} is not updated on a failing run).`,
    }
  }

  recordPrevious(previousFile, current)
  return { ok: true, drops: [], message: `Coverage no-regression gate: OK vs previous run ${fmt(previous)} -> ${fmt(current)}` }
}
