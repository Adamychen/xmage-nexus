// @ts-nocheck
/**
 * Oracle generator for ServerState drift (gameTypes/deckTypes).
 *
 * The proxy exposes ServerState.gameTypes / deckTypes via getGameTypes/getDeckTypes
 * (SessionImpl → ServerState → GameFactory / DeckValidatorFactory) which are
 * populated at server startup from Mage.Server/config/config.xml. The web client's
 * CreateTableDialog has hardcoded DEFAULT_* fallbacks that must not drift from
 * that config. FakeServer also has DEFAULT_RESULTS.
 *
 * This script parses config.xml (canonical source for the release) and emits
 * web/fixtures/server-state-schema.json — exhaustive lists for the current fork
 * version. The detector (web/src/state/serverStateCoverage.test.ts) diffs those
 * against DEFAULT_GAME_TYPES / DEFAULT_DECK_TYPES, failing if the client
 * hardcodes a stale set.
 *
 * No Java/server needed: purely file-based, deterministic.
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync, statSync } from 'node:fs'
import { dirname, resolve, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const CONFIG_PATHS = [
  resolve(here, '../Mage.Server/config/config.xml'),
  resolve(here, '../Mage.Server/release/config/config.xml'),
]
const PLUGINS_ROOT = resolve(here, '../Mage.Server.Plugins')

function pickConfig() {
  for (const p of CONFIG_PATHS) if (existsSync(p)) return p
  throw new Error(`config.xml not found in ${CONFIG_PATHS.join(', ')}`)
}

function extractAttr(tag, attr) {
  const re = new RegExp(`${attr}\\s*=\\s*"([^"]+)"`, 'i')
  const m = tag.match(re)
  return m ? m[1] : null
}

function walk(dir, cb) {
  if (!existsSync(dir)) return
  for (const e of readdirSync(dir)) {
    const full = join(dir, e)
    const st = statSync(full)
    if (st.isDirectory()) walk(full, cb)
    else if (e.endsWith('.java')) cb(full)
  }
}

let typeFileCache = null
function buildTypeFileCache() {
  if (typeFileCache) return typeFileCache
  typeFileCache = new Map()
  walk(PLUGINS_ROOT, (f) => {
    const base = f.split('/').pop().replace('.java', '')
    if (!typeFileCache.has(base)) typeFileCache.set(base, f)
  })
  walk(resolve(here, '../Mage/src/main/java'), (f) => {
    const base = f.split('/').pop().replace('.java', '')
    if (!typeFileCache.has(base)) typeFileCache.set(base, f)
  })
  return typeFileCache
}

function parseMatchTypeLimits(typeName) {
  const simple = typeName.split('.').pop()
  const cache = buildTypeFileCache()
  const file = cache.get(simple)
  if (!file) return null
  const src = readFileSync(file, 'utf8')
  const maxM = src.match(/this\.maxPlayers\s*=\s*(\d+)/)
  const minM = src.match(/this\.minPlayers\s*=\s*(\d+)/)
  if (maxM && minM) return { minPlayers: parseInt(minM[1], 10), maxPlayers: parseInt(maxM[1], 10) }
  return null
}

function parseConfig() {
  const configPath = pickConfig()
  const xml = readFileSync(configPath, 'utf8')

  const gameTypes = []
  const gameTypeRe = /<gameType\b[^>]*>/gi
  let m
  while ((m = gameTypeRe.exec(xml))) {
    const tag = m[0]
    if (tag.includes('<!--')) continue
    const name = extractAttr(tag, 'name')
    const typeName = extractAttr(tag, 'typeName')
    if (!name) continue
    // skip commented-out entries: ensure not inside <!-- ... -->
    const before = xml.slice(Math.max(0, m.index - 200), m.index)
    const lastOpen = before.lastIndexOf('<!--')
    const lastClose = before.lastIndexOf('-->')
    if (lastOpen > lastClose) continue
    const limits = typeName ? parseMatchTypeLimits(typeName) : null
    gameTypes.push({
      name,
      minPlayers: limits ? limits.minPlayers : (name.includes('Free For All') ? 3 : 2),
      maxPlayers: limits ? limits.maxPlayers : (name.includes('Free For All') ? 10 : 2),
      typeName: typeName || undefined,
    })
  }

  const deckTypes = []
  const deckTypeRe = /<deckType\b[^>]*\sname="([^"]+)"[^>]*>/gi
  while ((m = deckTypeRe.exec(xml))) {
    const tag = m[0]
    const before = xml.slice(Math.max(0, m.index - 200), m.index)
    const lastOpen = before.lastIndexOf('<!--')
    const lastClose = before.lastIndexOf('-->')
    if (lastOpen > lastClose) continue
    const name = m[1]
    // deduplicate (config has no dups, but release vs dev may overlap)
    if (!deckTypes.includes(name)) deckTypes.push(name)
  }

  const playerTypes = []
  const playerTypeRe = /<playerType\b[^>]*\sname="([^"]+)"[^>]*>/gi
  while ((m = playerTypeRe.exec(xml))) {
    const tag = m[0]
    const before = xml.slice(Math.max(0, m.index - 200), m.index)
    const lastOpen = before.lastIndexOf('<!--')
    const lastClose = before.lastIndexOf('-->')
    if (lastOpen > lastClose) continue
    playerTypes.push(m[1])
  }

  const tournamentTypes = []
  const tourRe = /<tournamentType\b[^>]*\sname="([^"]+)"[^>]*>/gi
  while ((m = tourRe.exec(xml))) {
    const tag = m[0]
    const before = xml.slice(Math.max(0, m.index - 200), m.index)
    const lastOpen = before.lastIndexOf('<!--')
    const lastClose = before.lastIndexOf('-->')
    if (lastOpen > lastClose) continue
    tournamentTypes.push(m[1])
  }

  const draftCubes = []
  const cubeRe = /<draftCube\b[^>]*\sname="([^"]+)"[^>]*>/gi
  while ((m = cubeRe.exec(xml))) {
    const tag = m[0]
    const before = xml.slice(Math.max(0, m.index - 200), m.index)
    const lastOpen = before.lastIndexOf('<!--')
    const lastClose = before.lastIndexOf('-->')
    if (lastOpen > lastClose) continue
    draftCubes.push(m[1])
  }

  return { gameTypes, deckTypes, playerTypes, tournamentTypes, draftCubes, configPath }
}

export function computeServerStateSchema() {
  const { gameTypes, deckTypes, playerTypes, tournamentTypes, draftCubes } = parseConfig()
  return { gameTypes, deckTypes, playerTypes, tournamentTypes, draftCubes }
}

function main() {
  const validate = process.argv.includes('--validate')
  const { gameTypes, deckTypes, playerTypes, tournamentTypes, draftCubes, configPath } = parseConfig()
  const out = {
    meta: {
      generatedAt: new Date().toISOString(),
      note: 'Exhaustive ServerState enumerations for the current fork version. Derived from Mage.Server/config/config.xml (canonical for this release) + MatchType Java limits. Oracle for serverStateCoverage.test.ts.',
      configPath: configPath.replace(resolve(here, '..') + '/', ''),
      version: '1.4.61-V1',
    },
    gameTypes,
    deckTypes,
    playerTypes,
    tournamentTypes,
    draftCubes,
  }

  const outPath = resolve(here, '../web/fixtures/server-state-schema.json')
  if (validate) {
    if (!existsSync(outPath)) {
      console.error(`server-state-schema.json not found — run: node scripts/server-state-schema.mjs`)
      process.exit(1)
    }
    const existing = JSON.parse(readFileSync(outPath, 'utf8'))
    // compare without meta.generatedAt
    const strip = (o) => ({ ...o, meta: { ...o.meta, generatedAt: 'x' } })
    if (JSON.stringify(strip(existing)) !== JSON.stringify(strip(out))) {
      console.error('server-state-schema.json is out of date — run: node scripts/server-state-schema.mjs')
      console.error(`  gameTypes: ${gameTypes.length}, deckTypes: ${deckTypes.length}, playerTypes: ${playerTypes.length}`)
      process.exit(1)
    }
    console.log('server-state-schema.json is up to date')
    console.log(`  gameTypes: ${gameTypes.length}, deckTypes: ${deckTypes.length}, playerTypes: ${playerTypes.length}, tournamentTypes: ${tournamentTypes.length}, draftCubes: ${draftCubes.length}`)
    return
  }

  mkdirSync(dirname(outPath), { recursive: true })
  writeFileSync(outPath, JSON.stringify(out, null, 2))
  console.log(`Wrote ${outPath}`)
  console.log(`  source: ${out.meta.configPath} (${out.meta.version})`)
  console.log(`  gameTypes: ${gameTypes.length}`)
  console.log(`  deckTypes: ${deckTypes.length}`)
  console.log(`  playerTypes: ${playerTypes.length}`)
  console.log(`  tournamentTypes: ${tournamentTypes.length}`)
  console.log(`  draftCubes: ${draftCubes.length}`)
}

if (process.argv[1] === fileURLToPath(import.meta.url)) main()
