// @ts-nocheck
/**
 * Engine→view oracle for the *second* drift dimension.
 *
 * `view-schema.mjs` enumerates what the server CAN emit (serializable fields of
 * the `mage.view.*` DTOs). But some gameplay-meaningful state lives only in the
 * engine objects (`mage.game.*`) and is NEVER copied into the view DTO, so no
 * remote DTO client (this web client, or even the remote Swing client) can ever
 * see it. Goad was the canonical example: `PermanentImpl.goadingPlayers` exists
 * but `PermanentView` has no field for it.
 *
 * This script computes, per (viewClass → engineClass) pair, the set of engine
 * instance fields that are NOT present in the corresponding view DTO — i.e. the
 * state the server cannot transmit. The baseline (`engine-view-gap.baseline.json`)
 * is committed; `web/src/state/engineViewCoverage.test.ts` fails when the gap
 * changes, forcing a human to triage any new engine-only state (is it a new
 * displayable mechanic we should surface, or just internal bookkeeping?).
 *
 * Reuses the Java-source field parser from `view-schema.mjs` (JsonUtil reflection
 * rules): an engine field counts only if it is a non-static, non-transient
 * instance field of the engine class or any superclass — the same shape the
 * server *would* serialize if it copied it into the view.
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createHash } from 'node:crypto'
import { forkCommit, forkDir, forkPath } from './lib.mjs'
import { fieldsFor, ROOTS } from './view-schema.mjs'

const here = dirname(fileURLToPath(import.meta.url))

// (view DTO class → engine source-of-truth class)
const PAIRS = [
  { view: 'PermanentView', engine: 'PermanentImpl' },
  { view: 'PlayerView', engine: 'PlayerImpl' },
  { view: 'GameView', engine: 'GameImpl' },
]

export function computeEngineViewGap() {
  const gap = {}
  for (const { view, engine } of PAIRS) {
    const serverFields = new Set(fieldsFor(view))
    const engineFields = fieldsFor(engine)
    const missing = engineFields.filter((f) => !serverFields.has(f)).sort()
    gap[view] = { engine, missing }
  }
  return gap
}

function canonicalJson(value) {
  return JSON.stringify(value, (_key, v) => {
    if (Array.isArray(v)) return v
    if (v && typeof v === 'object') {
      return Object.fromEntries(Object.entries(v).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)))
    }
    return v
  })
}

/** Stable sha256 of the engine→view gap (the script output), independent of key order. */
export function gapHash(gap) {
  return createHash('sha256').update(canonicalJson(gap)).digest('hex')
}

/** Version provenance of the current fork checkout — the commit that would produce a baseline. */
export function engineViewSource() {
  return { sourceCommit: forkCommit() }
}

function readBaseline(file) {
  try {
    return JSON.parse(readFileSync(file, 'utf8'))
  } catch {
    return null
  }
}

/**
 * Writes the baseline with version metadata. Refuses when the fork is still at the commit that
 * produced the current baseline yet the computed gap changed: a baseline change must accompany a
 * fork/proxy contract change (a reviewed decision), never a silent hand edit.
 */
export function updateBaseline(baselinePath, gap) {
  const hash = gapHash(gap)
  const sourceCommit = forkCommit()
  const previous = readBaseline(baselinePath)
  const previousMeta = previous?.meta ?? null
  const previousGap = previous ? { ...previous } : null
  if (previousGap) delete previousGap.meta
  const sourceUnchanged = previousMeta?.sourceCommit && sourceCommit && previousMeta.sourceCommit === sourceCommit
  if (sourceUnchanged && previousGap && gapHash(previousGap) !== hash) {
    throw new Error(
      `Refusing to update engine-view-gap.baseline.json: the fork is still at ${sourceCommit} — ` +
      'the commit that produced the current baseline — yet the computed gap changed. A baseline change ' +
      'must accompany a fork/proxy contract change; merge/pin a new fork commit first, or revert the local edit.',
    )
  }
  writeFileSync(
    baselinePath,
    JSON.stringify({ ...gap, meta: { gapHash: hash, sourceCommit, generatedAt: new Date().toISOString() } }, null, 2),
  )
  console.log('Updated engine-view-gap.baseline.json')
  console.log(`  meta.sourceCommit: ${sourceCommit ?? '(no git checkout)'}`)
  console.log(`  meta.gapHash: ${hash}`)
}

function main() {
  const gap = computeEngineViewGap()
  const dir = resolve(here, '../web/fixtures')
  mkdirSync(dir, { recursive: true })
  writeFileSync(resolve(dir, 'engine-view-gap.json'), JSON.stringify(gap, null, 2))
  if (process.argv.includes('--update-baseline')) {
    updateBaseline(resolve(dir, 'engine-view-gap.baseline.json'), gap)
  }
  console.log(`Wrote ${resolve(dir, 'engine-view-gap.json')}`)
  for (const v of Object.keys(gap)) {
    console.log(`  ${v} (engine ${gap[v].engine}): ${gap[v].missing.length} fields not in the view DTO`)
  }
  console.log(`  sources: ${ROOTS.map((r) => r.replace(resolve(here, '..') + '/', '')).join(', ')}`)
}

if (process.argv[1] === fileURLToPath(import.meta.url)) main()
