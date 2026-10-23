#!/usr/bin/env node
// TST-3: fuzz anomaly triage. Reads the fuzz reports under .run/ and groups every
// anomaly by a canonical signature. A signature that is not in the allowlist
// (scripts/fuzz-known-signatures.json) is new: the run fails, and the failure is
// the queue for the next triage. Known patterns join the allowlist with a reason.

import fs from 'node:fs'
import path from 'node:path'
import { repoRoot } from './lib.mjs'

const ALLOWLIST_PATH = path.join(repoRoot, 'scripts', 'fuzz-known-signatures.json')
const DEFAULT_CONFIG = { livelockUpdates: 1000, livelockPrompts: 500 }

export function reportSignature(anomaly, config = DEFAULT_CONFIG) {
  if (!anomaly || typeof anomaly !== 'object') return 'unknown'
  const a = anomaly
  if (a.kind === 'livelock') {
    const loop = (a.sameStateUpdates ?? 0) >= (config.livelockUpdates ?? 1000)
    const storm = (a.promptsSinceUpdate ?? 0) >= (config.livelockPrompts ?? 500)
    if (loop) return 'livelock:state-loop'
    if (storm) return 'livelock:prompt-storm'
    return 'livelock:other'
  }
  const step = typeof a.step === 'string' && a.step ? `:${a.step}` : ''
  return `${a.kind ?? 'unknown'}${step}`
}

export function signaturesOfReports(reports) {
  const out = {}
  for (const report of reports) {
    const config = report?.config ?? DEFAULT_CONFIG
    for (const a of report?.results ?? []) {
      for (const anomaly of a?.anomalies ?? []) {
        const sig = reportSignature(anomaly, config)
        out[sig] = (out[sig] ?? 0) + 1
      }
    }
  }
  return out
}

export function loadAllowlist() {
  if (!fs.existsSync(ALLOWLIST_PATH)) return {}
  return JSON.parse(fs.readFileSync(ALLOWLIST_PATH, 'utf8'))
}

export function triage(allSignatures, allowlist) {
  const newSignatures = {}
  for (const [sig, count] of Object.entries(allSignatures)) {
    if (!(sig in allowlist)) newSignatures[sig] = count
  }
  return newSignatures
}

export function readReports(dir) {
  if (!fs.existsSync(dir)) return []
  const files = fs.readdirSync(dir).filter((f) => f.startsWith('fuzz-report-') && f.endsWith('.json'))
  return files.map((f) => JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8')))
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const reports = readReports(path.join(repoRoot, '.run'))
  const signatures = signaturesOfReports(reports)
  const fresh = triage(signatures, loadAllowlist())
  const total = Object.values(signatures).reduce((s, n) => s + n, 0)
  console.log(`[fuzz-triage] ${total} anomalies in ${reports.length} reports`)
  for (const [sig, n] of Object.entries(signatures).sort()) {
    const mark = sig in fresh ? ' NEW' : ''
    console.log(`  ${String(n).padStart(3)}x ${sig}${mark}`)
  }
  const freshTotal = Object.values(fresh).reduce((s, n) => s + n, 0)
  if (freshTotal > 0) {
    console.error(`[fuzz-triage] ${freshTotal} new signature anomal(ies) — triage pending (TST-3)`)
    process.exit(1)
  }
}
