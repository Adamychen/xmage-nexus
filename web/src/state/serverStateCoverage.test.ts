import { describe, expect, it } from 'vitest'
// @ts-expect-error node specifiers
import { readFileSync, existsSync } from 'node:fs'
// @ts-expect-error node specifiers
import { fileURLToPath } from 'node:url'
// @ts-expect-error node specifiers
import { dirname, resolve } from 'node:path'
// @ts-expect-error no types for oracle generator
import { computeServerStateSchema } from '../../../scripts/server-state-schema.mjs'

const here = dirname(fileURLToPath(import.meta.url))
const SCHEMA_PATH = resolve(here, '../../fixtures/server-state-schema.json')
const CREATE_DIALOG_PATH = resolve(here, '../lobby/CreateTableDialog.tsx')
const FAKE_PATH = resolve(here, '../../fixtures/fake.ts')

function loadSchema() {
  if (!existsSync(SCHEMA_PATH)) throw new Error('server-state-schema.json not found — run node scripts/server-state-schema.mjs')
  return JSON.parse(readFileSync(SCHEMA_PATH, 'utf8'))
}

const schema = loadSchema()
const oracleGameNames = new Set(schema.gameTypes.map((g: { name: string }) => g.name))
const oracleDeckSet = new Set(schema.deckTypes as string[])

function extractDefaultGameTypes(): string[] {
  const src = readFileSync(CREATE_DIALOG_PATH, 'utf8')
  const blockMatch = src.match(/export const DEFAULT_GAME_TYPES[^=]*=\s*\[([\s\S]*?)\]/m)
  if (!blockMatch) return []
  const block = blockMatch[1]
  const names: string[] = []
  const re = /name:\s*'([^']+)'/g
  let m
  while ((m = re.exec(block))) names.push(m[1])
  // fallback double quotes
  const re2 = /name:\s*"([^"]+)"/g
  while ((m = re2.exec(block))) if (!names.includes(m[1])) names.push(m[1])
  return names
}

function extractDefaultDeckTypes(): string[] {
  const src = readFileSync(CREATE_DIALOG_PATH, 'utf8')
  const blockMatch = src.match(/export const DEFAULT_DECK_TYPES[^=]*=\s*\[([\s\S]*?)\]/m)
  if (!blockMatch) return []
  const block = blockMatch[1]
  const names: string[] = []
  const re = /'([^']+)'/g
  let m
  while ((m = re.exec(block))) names.push(m[1])
  return names
}

function extractFakeDeckTypes(): string[] {
  const src = readFileSync(FAKE_PATH, 'utf8')
  const m = src.match(/getDeckTypes:\s*\[([\s\S]*?)\]/)
  if (!m) return []
  const block = m[1]
  const names: string[] = []
  const re = /'([^']+)'/g
  let r
  while ((r = re.exec(block))) names.push(r[1])
  return names
}

function extractFakeGameTypes(): string[] {
  const src = readFileSync(FAKE_PATH, 'utf8')
  const m = src.match(/getGameTypes:\s*\[([\s\S]*?)\]/)
  if (!m) return []
  const block = m[1]
  const names: string[] = []
  const re = /name:\s*'([^']+)'/g
  let r
  while ((r = re.exec(block))) names.push(r[1])
  return names
}

describe('serverState coverage — drift guard for createTable formats', () => {
  it('server-state-schema.json is up to date with Mage.Server/config/config.xml', () => {
    const live = computeServerStateSchema()
    const persisted = { gameTypes: schema.gameTypes, deckTypes: schema.deckTypes, playerTypes: schema.playerTypes, tournamentTypes: schema.tournamentTypes, draftCubes: schema.draftCubes }
    expect(live).toEqual(persisted)
  })

  it('DEFAULT_GAME_TYPES contains only valid server gameTypes (no stale names)', () => {
    const defaults = extractDefaultGameTypes()
    const invalid = defaults.filter((n) => !oracleGameNames.has(n))
    expect(invalid, `DEFAULT_GAME_TYPES has stale/invalid entries not in server oracle: ${invalid.join(', ')} — run node scripts/server-state-schema.mjs and update CreateTableDialog.tsx`).toEqual([])
  })

  it('DEFAULT_DECK_TYPES contains only valid server deckTypes (no stale names)', () => {
    const defaults = extractDefaultDeckTypes()
    const invalid = defaults.filter((n) => !oracleDeckSet.has(n))
    expect(invalid, `DEFAULT_DECK_TYPES has stale/invalid entries not in server oracle: ${invalid.join(', ')} — run node scripts/server-state-schema.mjs and update CreateTableDialog.tsx`).toEqual([])
  })

  it('DEFAULT_GAME_TYPES covers all server gameTypes (exhaustive fallback for offline)', () => {
    const defaults = new Set(extractDefaultGameTypes())
    const missing = [...oracleGameNames].filter((n) => !defaults.has(n as string))
    expect(missing, `DEFAULT_GAME_TYPES missing ${missing.length} server gameTypes (offline fallback incomplete): ${missing.join(', ')} — add them to CreateTableDialog.tsx DEFAULT_GAME_TYPES from server-state-schema.json`).toEqual([])
  })

  it('DEFAULT_DECK_TYPES covers all server deckTypes (exhaustive fallback for offline)', () => {
    const defaults = new Set(extractDefaultDeckTypes())
    const missing = [...oracleDeckSet].filter((n) => !defaults.has(n as string))
    expect(missing, `DEFAULT_DECK_TYPES missing ${missing.length} server deckTypes (offline fallback incomplete): ${missing.join(', ')} — add them from server-state-schema.json`).toEqual([])
  })

  it('FakeServer DEFAULT_RESULTS.getGameTypes are valid server gameTypes', () => {
    const fake = extractFakeGameTypes()
    const invalid = fake.filter((n) => !oracleGameNames.has(n))
    expect(invalid, `FakeServer getGameTypes has invalid entries: ${invalid.join(', ')}`).toEqual([])
  })

  it('FakeServer DEFAULT_RESULTS.getDeckTypes are valid server deckTypes', () => {
    const fake = extractFakeDeckTypes()
    const invalid = fake.filter((n) => !oracleDeckSet.has(n))
    expect(invalid, `FakeServer getDeckTypes has invalid entries: ${invalid.join(', ')}`).toEqual([])
  })
})
