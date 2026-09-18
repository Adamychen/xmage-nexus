import { describe, expect, it } from 'vitest'

import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'
// @ts-expect-error no type declarations for the oracle script (plain node .mjs)
import { computeEngineViewGap } from '../../../scripts/engine-view-schema.mjs'
import { ENGINE_VIEW_REGISTRY, engineViewKey, type EngineViewRegistryRow } from './engineViewRegistry'

const here = dirname(fileURLToPath(import.meta.url))

// Baseline of the engine→view gap, committed on purpose. The web client is a
// remote DTO client: any engine state that is NOT copied into the `mage.view.*`
// DTO cannot be shown, no matter what we do client-side. This baseline locks in
// the current set so a future XMage change that adds (or removes) engine-only
// state is caught — forcing a human to triage it.
const BASELINE = resolve(here, '../../fixtures/engine-view-gap.baseline.json')
const baseline = JSON.parse(readFileSync(BASELINE, 'utf8'))

// Displayable state we KNOW lives in the engine but is not in the view DTO.
// These are accepted protocol limitations (only fixable by an upstream server
// change to `mage.view.*`), EXCEPT goad which, although field-missing, IS
// conveyed via `cardIcons` (OTHER_HAS_RESTRICTIONS) + `rules` text. If any of
// these disappears from the gap it means upstream started exposing it and the
// client should start modeling it.
const KNOWN_DISPLAYABLE_GAPS: Record<string, string[]> = {
  PermanentView: ['goadingPlayers', 'harnessed', 'monstrous', 'renowned'],
  PlayerView: ['abilities'],
}

const computed = computeEngineViewGap()

interface GapKey {
  id: string
  view: string
  field: string
}

function gapKeys(gap: typeof baseline): GapKey[] {
  const keys: GapKey[] = []
  for (const [view, entry] of Object.entries(gap) as [string, { missing?: string[] }][]) {
    for (const field of entry.missing ?? []) keys.push({ id: engineViewKey(view, field), view, field })
  }
  return keys
}

const keys = gapKeys(baseline)

describe('engine→view coverage (no unexposed engine state goes unnoticed)', () => {
  it('engine→view gap matches the committed baseline', () => {
    expect(computed).toEqual(baseline)
  })

  for (const [view, fields] of Object.entries(KNOWN_DISPLAYABLE_GAPS)) {
    it(`known displayable gap '${view}' is still present in the engine→view diff`, () => {
      const missing = (computed[view]?.missing ?? []) as string[]
      for (const f of fields) {
        expect(missing, `Engine state '${f}' on ${view} is no longer engine-only — upstream may now expose it; model it client-side.`).toContain(f)
      }
    })
  }

  it('every engine→view field has a triage row in engineViewRegistry', () => {
    const registered = new Set(ENGINE_VIEW_REGISTRY.map((r) => r.id))
    const missing = keys.filter((k) => !registered.has(k.id))
    expect(
      missing.map((k) => k.id),
      `campo engine→view sin triage: ${missing.map((k) => k.id).join(', ')} — añade fila en web/src/state/engineViewRegistry.ts o regenera el baseline (node scripts/engine-view-schema.mjs --update-baseline)`,
    ).toEqual([])
  })

  it('every engineViewRegistry row maps to a live engine→view gap field', () => {
    const live = new Set(keys.map((k) => k.id))
    const stale = ENGINE_VIEW_REGISTRY.filter((r) => !live.has(r.id))
    expect(
      stale.map((r) => r.id),
      `fila huérfana en engineViewRegistry.ts: ${stale.map((r) => r.id).join(', ')} — el campo ya no está en el gap; elimínala o regenera el baseline (node scripts/engine-view-schema.mjs --update-baseline)`,
    ).toEqual([])
  })

  it('registry rows are unique and keyed as view.field', () => {
    const seen = new Map<string, number>()
    const problems: string[] = []
    for (const row of ENGINE_VIEW_REGISTRY as EngineViewRegistryRow[]) {
      if (row.id !== engineViewKey(row.view, row.field)) {
        problems.push(`${row.id}: el id no coincide con ${row.view}.${row.field}`)
      }
      seen.set(row.id, (seen.get(row.id) ?? 0) + 1)
    }
    for (const [id, count] of seen) {
      if (count > 1) problems.push(`${id}: ${count} filas duplicadas`)
    }
    expect(problems, problems.join('; ')).toEqual([])
  })

  it('rendered rows carry a path:line ref and the rest carry a causa', () => {
    const problems: string[] = []
    for (const row of ENGINE_VIEW_REGISTRY as EngineViewRegistryRow[]) {
      if (row.decision === 'rendered' && !/^[\w./-]+:\d+$/.test(row.ref ?? '')) {
        problems.push(`${row.id}: rendered sin ref 'ruta:línea' (ver web/ENGINE_VIEW_TRIAGE.md)`)
      }
      if (row.decision !== 'rendered' && !(row.causa && row.causa.trim().length > 0)) {
        problems.push(`${row.id}: ${row.decision} sin causa (ver web/ENGINE_VIEW_TRIAGE.md)`)
      }
    }
    expect(problems, problems.join('; ')).toEqual([])
  })
})
