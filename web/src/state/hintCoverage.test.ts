import { describe, expect, it } from 'vitest'

import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'
// @ts-expect-error no type declarations for the oracle script (plain node .mjs)
import { computeHintSchema } from '../../../scripts/hint-schema.mjs'
import { hintRegistry, type HintKind, type HintRegistryRow } from '../board/hintRegistry'

const here = dirname(fileURLToPath(import.meta.url))
const BASELINE = resolve(here, '../../fixtures/hint-schema.json')
const baseline = JSON.parse(readFileSync(BASELINE, 'utf8'))

// Engine hint sources extracted from the fork by scripts/hint-schema.mjs. Any
// add/remove in the engine (new *Hint class, addHint call, HINT_ICON_*, addInfo
// key or PermanentImpl.getRules text) changes this JSON and fails until the
// change is triaged in web/src/board/hintRegistry.ts (or the baseline is
// regenerated on purpose).
const computed = computeHintSchema()

interface SchemaKey {
  id: string
  kind: HintKind
}

function schemaKeys(schema: typeof baseline): SchemaKey[] {
  const keys: SchemaKey[] = []
  for (const t of schema.restrictRequirementTexts) keys.push({ id: `rules:${t.template}`, kind: 'rules' })
  for (const bucket of ['core', 'common', 'embedded'] as const) {
    for (const h of schema.hintClasses[bucket]) keys.push({ id: `hint:${h.name}`, kind: 'hint' })
  }
  for (const name of Object.keys(schema.hintIcons)) keys.push({ id: `icon:${name}`, kind: 'icon' })
  if (schema.hintStartMark) keys.push({ id: 'mark:hintstart', kind: 'rules' })
  for (const l of schema.infoKeys.literal) keys.push({ id: `info:${l.key}`, kind: 'info' })
  for (const c of schema.infoKeys.constants) keys.push({ id: `info:${c.key}`, kind: 'info' })
  for (const d of schema.infoKeys.dynamic) keys.push({ id: `info:${d}`, kind: 'info' })
  return keys
}

const keys = schemaKeys(computed)

describe('engine hint coverage (no untriaged hint source)', () => {
  it('engine hint schema matches the committed baseline', () => {
    expect(computed).toEqual(baseline)
  })

  it('every engine hint key has a row in hintRegistry', () => {
    const registered = new Set(hintRegistry.map((r) => r.id))
    const missing = keys.filter((k) => !registered.has(k.id))
    expect(
      missing.map((k) => k.id),
      `hint nuevo del motor: ${missing.map((k) => k.id).join(', ')} — añade una fila en web/src/board/hintRegistry.ts o regenera el baseline con: node scripts/hint-schema.mjs --update-baseline`,
    ).toEqual([])
  })

  it('every hintRegistry row maps to a live engine hint key', () => {
    const live = new Set(keys.map((k) => k.id))
    const stale = hintRegistry.filter((r) => !live.has(r.id))
    expect(
      stale.map((r) => r.id),
      `fila huérfana en hintRegistry.ts: ${stale.map((r) => r.id).join(', ')} — el motor ya no emite esa clave; elimínala o regenera el baseline`,
    ).toEqual([])
  })

  it('registry kinds match the schema kind of each key', () => {
    const kindById = new Map(keys.map((k) => [k.id, k.kind]))
    const mismatched = hintRegistry.filter((r) => kindById.get(r.id) !== r.kind)
    expect(
      mismatched.map((r) => `${r.id} (registry ${r.kind}, schema ${kindById.get(r.id)})`),
      'kind incorrecto en hintRegistry.ts para las claves listadas',
    ).toEqual([])
  })

  it('rendered rows carry a path:line ref and known-unrendered rows carry a causa', () => {
    const problems: string[] = []
    for (const row of hintRegistry as HintRegistryRow[]) {
      if (row.status === 'rendered' && !/^[\w./-]+:\d+$/.test(row.ref ?? '')) {
        problems.push(`${row.id}: rendered sin ref 'ruta:línea'`)
      }
      if (row.status === 'known-unrendered' && !(row.causa && row.causa.trim().length > 0)) {
        problems.push(`${row.id}: known-unrendered sin causa`)
      }
    }
    expect(problems, problems.join('; ')).toEqual([])
  })
})
