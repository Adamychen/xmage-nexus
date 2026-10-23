import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { enforceCoverageGate, readCoveragePercentages, METRICS, DEFAULT_TOLERANCE } from './coverage-gate.mjs'

function tmpDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'coverage-gate-'))
}

/** Builds a minimal vitest json-summary file with the given pct per metric. */
function writeSummary(dir, pcts, name = 'coverage-summary.json') {
  const total = {}
  for (const m of METRICS) {
    const pct = pcts[m] ?? 80
    total[m] = { total: 100_000, covered: Math.round(pct * 1000), skipped: 0, pct }
  }
  const file = path.join(dir, name)
  fs.writeFileSync(file, JSON.stringify({ total }, null, 2))
  return file
}

function readPrevious(previousFile) {
  return JSON.parse(fs.readFileSync(previousFile, 'utf8'))
}

test('the first run (no previous summary) records the baseline without failing', () => {
  const dir = tmpDir()
  const summary = writeSummary(dir, { lines: 83.5, functions: 77.7, branches: 72, statements: 80.8 })
  const previous = path.join(dir, 'coverage-previous.json')
  const gate = enforceCoverageGate({ summaryFile: summary, previousFile: previous })
  assert.equal(gate.ok, true)
  assert.equal(gate.recordedBaseline, true)
  assert.ok(fs.existsSync(previous))
  const recorded = readPrevious(previous).total.lines.pct
  assert.equal(recorded, 83.5)
  assert.equal(readPrevious(previous).total.branches.pct, 72)
})

test('an equal run passes and keeps the previous summary', () => {
  const dir = tmpDir()
  const summary = writeSummary(dir, { lines: 83.5, functions: 77.7, branches: 72, statements: 80.8 })
  const previous = path.join(dir, 'coverage-previous.json')
  enforceCoverageGate({ summaryFile: summary, previousFile: previous })
  const gate = enforceCoverageGate({ summaryFile: summary, previousFile: previous })
  assert.equal(gate.ok, true)
  assert.equal(gate.drops.length, 0)
  assert.equal(readPrevious(previous).total.lines.pct, 83.5)
})

test('TST-6: a drop of more than 1.0 point fails the gate and does not update the previous summary', () => {
  const dir = tmpDir()
  const summary = writeSummary(dir, { lines: 83.5, functions: 77.7, branches: 72, statements: 80.8 })
  const previous = path.join(dir, 'coverage-previous.json')
  enforceCoverageGate({ summaryFile: summary, previousFile: previous })
  const dropped = writeSummary(dir, { lines: 82.4, functions: 77.7, branches: 72, statements: 80.8 })
  const gate = enforceCoverageGate({ summaryFile: dropped, previousFile: previous })
  assert.equal(gate.ok, false)
  assert.equal(gate.drops.length, 1)
  assert.equal(gate.drops[0].metric, 'lines')
  assert.match(gate.message, /lines: 83\.5% -> 82\.4%/)
  assert.equal(readPrevious(previous).total.lines.pct, 83.5, 'previous summary must stay untouched on a failing run')
})

test('a drop within tolerance passes and re-records the previous summary', () => {
  const dir = tmpDir()
  const summary = writeSummary(dir, { lines: 83.5, functions: 77.7, branches: 72, statements: 80.8 })
  const previous = path.join(dir, 'coverage-previous.json')
  enforceCoverageGate({ summaryFile: summary, previousFile: previous })
  const slightlyLower = writeSummary(dir, { lines: 82.9, functions: 77.7, branches: 72, statements: 80.8 })
  const gate = enforceCoverageGate({ summaryFile: slightlyLower, previousFile: previous })
  assert.equal(gate.ok, true)
  assert.equal(readPrevious(previous).total.lines.pct, 82.9)
})

test('TST-6: a metric missing from the current summary counts as a drop to zero', () => {
  const dir = tmpDir()
  const summary = writeSummary(dir, { lines: 83.5, functions: 77.7, branches: 72, statements: 80.8 })
  const previous = path.join(dir, 'coverage-previous.json')
  enforceCoverageGate({ summaryFile: summary, previousFile: previous })
  const partial = writeSummary(dir, { lines: 83.5, branches: 72, statements: 80.8 })
  const partialObj = JSON.parse(fs.readFileSync(partial, 'utf8'))
  delete partialObj.total.functions
  fs.writeFileSync(partial, JSON.stringify(partialObj))
  const gate = enforceCoverageGate({ summaryFile: partial, previousFile: previous })
  assert.equal(gate.ok, false)
  assert.ok(gate.drops.some((d) => d.metric === 'functions' && d.current === 0))
})

test('TST-6: a missing summary fails the gate', () => {
  const gate = enforceCoverageGate({ summaryFile: path.join(tmpDir(), 'nope.json'), previousFile: path.join(tmpDir(), 'prev.json') })
  assert.equal(gate.ok, false)
  assert.match(gate.message, /no summary/)
})

test('the tolerance is configurable', () => {
  const dir = tmpDir()
  const summary = writeSummary(dir, { lines: 83.5, functions: 77.7, branches: 72, statements: 80.8 })
  const previous = path.join(dir, 'coverage-previous.json')
  enforceCoverageGate({ summaryFile: summary, previousFile: previous })
  const dropped = writeSummary(dir, { lines: 83.0, functions: 77.7, branches: 72, statements: 80.8 })
  const strict = enforceCoverageGate({ summaryFile: dropped, previousFile: previous, tolerance: 0.2 })
  const lax = enforceCoverageGate({ summaryFile: dropped, previousFile: previous, tolerance: 1.0 })
  assert.equal(strict.ok, false)
  assert.equal(lax.ok, true)
})

test('readCoveragePercentages returns null for garbage or shape-mismatched files', () => {
  const dir = tmpDir()
  const garbage = path.join(dir, 'garbage.json')
  fs.writeFileSync(garbage, 'not json')
  assert.equal(readCoveragePercentages(garbage), null)
  fs.writeFileSync(garbage, JSON.stringify({ foo: 1 }))
  assert.equal(readCoveragePercentages(garbage), null)
})

test('test.mjs wires the gate into the coverage layer only', () => {
  const src = fs.readFileSync(path.join(path.dirname(fileURLToPath(import.meta.url)), 'test.mjs'), 'utf8')
  assert.match(src, /import \{ enforceCoverageGate \} from '\.\/coverage-gate\.mjs'/)
  assert.match(src, /name === 'coverage' && res\.code === 0/)
  assert.match(src, /enforceCoverageGate\(\)/)
})

test('defaults are exported and sane', () => {
  assert.deepEqual(METRICS, ['lines', 'functions', 'branches', 'statements'])
  assert.equal(DEFAULT_TOLERANCE, 1.0)
})
