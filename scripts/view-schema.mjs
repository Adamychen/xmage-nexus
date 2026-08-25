// @ts-nocheck
/**
 * Oracle generator for the mechanics reverse-drift detector.
 *
 * The Mage.Proxy serializes XMage view objects with a reflection serializer
 * (JsonUtil) that writes every non-static, non-transient instance field of each
 * class in the hierarchy (skipping loggers/Class/Throwable/reflection types).
 * So the set of fields the server CAN emit is exactly the set of serializable
 * instance fields of the `mage.view.*` classes and their superclasses — a finite,
 * statically-derivable set (NOT dependent on which games we record).
 *
 * This script parses those Java classes and emits web/fixtures/server-view-schema.json
 * with the exhaustive field sets per view type. The detector
 * (web/src/state/mechanicsCoverage.test.ts) diffs these against the fields the
 * web client actually models, surfacing any server state the client ignores.
 */
import { readFileSync, writeFileSync, readdirSync, statSync, existsSync, mkdirSync } from 'node:fs'
import { dirname, resolve, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const ROOTS = [
  resolve(here, '../Mage.Common/src/main/java'),
  resolve(here, '../Mage/src/main/java'),
]

// Fields the serializer itself ignores (JsonUtil.isWritableField).
const SKIP_NAMES = new Set(['serialVersionUID', '$assertionsDisabled', 'logger', 'log', 'LOGGER'])
const SKIP_TYPE_END = new Set(['Class', 'Thread', 'Logger', 'StackTraceElement', 'Throwable'])
function skipType(typeBase) {
  if (SKIP_TYPE_END.has(typeBase)) return true
  if (typeBase.startsWith('java.lang.reflect.') || typeBase.startsWith('sun.reflect.') ||
      typeBase.startsWith('java.util.concurrent.') || typeBase === 'java.lang.Class') return true
  return false
}

const classCache = new Map() // name -> { fields: string[], superclass: string|null }

function walk(dir, cb) {
  if (!existsSync(dir)) return
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry)
    const st = statSync(full)
    if (st.isDirectory()) walk(full, cb)
    else if (entry.endsWith('.java')) cb(full)
  }
}

function findClassFile(name) {
  for (const root of ROOTS) {
    let found = null
    walk(root, (f) => { if (!found && f.endsWith('/' + name + '.java')) found = f })
    if (found) return found
  }
  return null
}

const FIELD_RE = /^\s*(?:@\w+(?:\([^)]*\))?\s*)*?(private|protected|public)\s+(?!static|transient)(?:final\s+)?([A-Za-z_][\w.]*)(?:<[^>]*>)?(?:\[\])?\s+([A-Za-z_]\w*)\s*(?:=[^;]+)?;/gm

function parseClassFile(path) {
  const src = readFileSync(path, 'utf8')
  const classMatch = src.match(/class\s+(\w+)/)
  const name = classMatch ? classMatch[1] : null
  let superclass = null
  const ext = src.match(/class\s+\w+\s+extends\s+([A-Za-z_][\w.<>, ]*?)(?:\s+implements|\s*\{)/)
  if (ext) superclass = ext[1].split(/[<,.\s]/)[0]
  const fields = []
  let m
  FIELD_RE.lastIndex = 0
  while ((m = FIELD_RE.exec(src))) {
    const type = m[2].split('.').pop()
    const fname = m[3]
    if (SKIP_NAMES.has(fname)) continue
    if (skipType(type)) continue
    fields.push(fname)
  }
  const parsed = { fields, superclass }
  if (name) classCache.set(name, parsed)
  return parsed
}

const STOP = new Set(['Object', 'Serializable', 'Cloneable', 'Comparable', null, undefined, ''])

function collectFields(name, accumulator, seen = new Set()) {
  if (STOP.has(name) || seen.has(name)) return
  seen.add(name)
  let parsed = classCache.get(name)
  if (!parsed) {
    const file = findClassFile(name)
    if (!file) return
    parsed = parseClassFile(file)
  }
  for (const f of parsed.fields) accumulator.add(f)
  if (parsed.superclass) collectFields(parsed.superclass, accumulator, seen)
}

function fieldsFor(className) {
  const set = new Set()
  collectFields(className, set)
  return [...set].sort()
}

const cardFields = fieldsFor('PermanentView')      // permanents are cards; includes the CardView chain
const playerFields = fieldsFor('PlayerView')
const gameViewFields = fieldsFor('GameView')

const out = {
  meta: {
    generatedAt: new Date().toISOString(),
    note: 'Exhaustive serializable instance fields of the XMage view classes (oracle for mechanics reverse-drift). Derived from JsonUtil reflection rules.',
    sources: ROOTS.map((r) => r.replace(resolve(here, '..') + '/', '')),
  },
  cardFields,
  playerFields,
  gameViewFields,
}

const outPath = resolve(here, '../web/fixtures/server-view-schema.json')
mkdirSync(dirname(outPath), { recursive: true })
writeFileSync(outPath, JSON.stringify(out, null, 2))
console.log(`Wrote ${outPath}`)
console.log(`  card/permanent fields : ${cardFields.length}`)
console.log(`  player fields        : ${playerFields.length}`)
console.log(`  gameView fields      : ${gameViewFields.length}`)
