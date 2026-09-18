// @ts-nocheck
/**
 * Static oracle for the engine's *textual* hint sources (Family B).
 *
 * Extracts, from the XMage fork sources only (no Java runtime):
 *  - `restrictRequirementTexts`: the literals `PermanentImpl.getRules` prepends
 *    to card rules for restriction/requirement effects (ICON_RESTRICT/REQUIRE);
 *  - `hintClasses`: every `*Hint` class/enum declared under `Mage/**` and
 *    `Mage.Common/**`, split into core (abilities/hint), common
 *    (abilities/hint/common) and embedded (declared inside another file);
 *  - `registered`: real `addHint(...)` call sites (declarations excluded);
 *  - `hintIcons`: `HINT_ICON_*` constants from `HintUtils`;
 *  - `infoKeys`: keys passed to `addInfo(...)`/`addInfoToObject(...)`, classified
 *    into literals, resolvable String constants and dynamic expressions.
 *
 * Output is deterministic (no line numbers/dates, fork-relative paths, sorted
 * arrays) and committed as `web/fixtures/hint-schema.json`; the guard
 * `web/src/state/hintCoverage.test.ts` fails when a hint source is added or
 * removed, forcing a triage in `web/src/board/hintRegistry.ts`.
 *
 * Scope v1: `Mage/**` + `Mage.Common/**`. `Mage.Sets` (2383 `addHint`, 50 hint
 * classes, 60 `addInfo`, i.e. per-card corpus) is deliberately excluded and
 * declared in `meta.scope`.
 */
import { readFileSync, writeFileSync, mkdirSync, readdirSync } from 'node:fs'
import { dirname, resolve, join, relative, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import { forkDir, XMAGE_VERSION } from './lib.mjs'

const here = dirname(fileURLToPath(import.meta.url))
const FORK = forkDir()

const MODULES = ['Mage', 'Mage.Common']
const JAVA_ROOTS = MODULES.map((m) => `${m}/src/main/java`)
const PERMANENT_IMPL = 'Mage/src/main/java/mage/game/permanent/PermanentImpl.java'
const HINT_UTILS = 'Mage/src/main/java/mage/abilities/hint/HintUtils.java'
const CORE_PREFIX = 'Mage/src/main/java/mage/abilities/hint/'
const COMMON_PREFIX = `${CORE_PREFIX}common/`

function abs(rel) {
  return join(FORK, rel)
}

function toRel(p) {
  return relative(FORK, p).split(sep).join('/')
}

function walkJava(relRoot) {
  const out = []
  const visit = (dir) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const child = join(dir, entry.name)
      if (entry.isDirectory()) visit(child)
      else if (entry.name.endsWith('.java')) out.push(toRel(child))
    }
  }
  visit(abs(relRoot))
  return out.sort()
}

function readJava(rel) {
  return readFileSync(abs(rel), 'utf8')
}

function stripComments(src) {
  let out = ''
  let i = 0
  while (i < src.length) {
    const c = src[i]
    const n = src[i + 1]
    if (c === '/' && n === '/') {
      while (i < src.length && src[i] !== '\n') i++
      continue
    }
    if (c === '/' && n === '*') {
      i += 2
      while (i < src.length && !(src[i] === '*' && src[i + 1] === '/')) i++
      i += 2
      continue
    }
    if (c === '"' || c === "'") {
      const end = skipString(src, i)
      out += src.slice(i, end + 1)
      i = end + 1
      continue
    }
    out += c
    i++
  }
  return out
}

function skipString(src, i) {
  const quote = src[i]
  i++
  while (i < src.length) {
    if (src[i] === '\\') {
      i += 2
      continue
    }
    if (src[i] === quote) return i
    i++
  }
  return src.length - 1
}

function matchDelimiter(src, openIndex, open, close) {
  let depth = 0
  for (let i = openIndex; i < src.length; i++) {
    const c = src[i]
    if (c === '"' || c === "'") {
      i = skipString(src, i)
      continue
    }
    if (c === open) depth++
    else if (c === close) {
      depth--
      if (depth === 0) return i
    }
  }
  return -1
}

function splitTopLevel(src, separator) {
  const parts = []
  let depth = 0
  let start = 0
  for (let i = 0; i < src.length; i++) {
    const c = src[i]
    if (c === '"' || c === "'") {
      i = skipString(src, i)
      continue
    }
    if (c === '(' || c === '[' || c === '{') depth++
    else if (c === ')' || c === ']' || c === '}') depth--
    else if (c === separator && depth === 0) {
      parts.push(src.slice(start, i))
      start = i + 1
    }
  }
  parts.push(src.slice(start))
  return parts
}

function normalizeWs(src) {
  return src.replace(/\s+/g, ' ').trim()
}

function cmp(a, b) {
  return a < b ? -1 : a > b ? 1 : 0
}

function isStringLiteral(src) {
  return /^"(?:[^"\\]|\\.)*"$/.test(src)
}

function unescapeJava(src) {
  const body = src.slice(1, -1)
  return body.replace(/\\(.)/g, (_, ch) => {
    if (ch === 'n') return '\n'
    if (ch === 't') return '\t'
    if (ch === 'r') return '\r'
    return ch
  })
}

function findCalls(src, callee) {
  const re = new RegExp(`(?<![\\w$])${callee.replace(/\./g, '\\.')}\\s*\\(`, 'g')
  const out = []
  let match
  while ((match = re.exec(src)) !== null) {
    const open = src.indexOf('(', match.index)
    const close = matchDelimiter(src, open, '(', ')')
    if (close < 0) continue
    out.push({
      index: match.index,
      end: close,
      args: splitTopLevel(src.slice(open + 1, close), ','),
    })
    re.lastIndex = close + 1
  }
  return out
}

function renderTemplate(expr) {
  return splitTopLevel(expr, '+')
    .map((raw) => {
      const part = normalizeWs(raw)
      if (isStringLiteral(part)) return unescapeJava(part)
      return `{${part}}`
    })
    .join('')
}

function computeRestrictRequirementTexts() {
  const src = stripComments(readJava(PERMANENT_IMPL))
  const entries = []
  for (const call of findCalls(src, 'prepareText')) {
    const text = call.args[0] ?? ''
    const iconArg = normalizeWs(call.args[2] ?? '')
    const iconMatch = iconArg.match(/HINT_ICON_\w+/)
    if (!iconMatch) continue
    entries.push({ template: renderTemplate(text), icon: iconMatch[0], path: PERMANENT_IMPL })
  }
  return entries.sort((a, b) => cmp(a.template, b.template))
}

function computeHintClasses() {
  const roots = JAVA_ROOTS.flatMap((root) => walkJava(root))
  const declarations = []
  for (const path of roots) {
    const src = stripComments(readJava(path))
    const re = /\b(class|enum|interface)\s+(\w+Hint)\b/g
    let match
    while ((match = re.exec(src)) !== null) {
      declarations.push({ name: match[2], path, kind: match[1] })
    }
  }
  const core = []
  const common = []
  const embedded = []
  for (const decl of declarations) {
    if (decl.path.startsWith(COMMON_PREFIX)) common.push({ name: decl.name, path: decl.path })
    else if (decl.path.startsWith(CORE_PREFIX)) core.push({ name: decl.name, path: decl.path })
    else embedded.push({ name: decl.name, path: decl.path })
  }
  const byName = (a, b) => cmp(a.name, b.name) || cmp(a.path, b.path)
  core.sort(byName)
  common.sort(byName)
  embedded.sort(byName)
  return { core, common, embedded }
}

function isAddHintDeclaration(call, src) {
  return call.args.length === 1
    && /^Hint\s+\w+$/.test(normalizeWs(call.args[0]))
    && /^\s*[{;]/.test(src.slice(call.end + 1))
}

function resolveHintClass(expr, src) {
  const tokens = [...expr.matchAll(/(?<![\w.])([A-Z]\w*Hint)\b/g)].map((m) => m[1])
  if (tokens.length > 0) return tokens[tokens.length - 1]
  const bare = expr.match(/^([A-Za-z_$][\w$]*)$/)
  if (!bare) return null
  const decl = new RegExp(`\\b(\\w*Hint)\\s+${bare[1]}\\b[^;=(){}]*?=`).exec(src)
  if (!decl) return null
  if (decl[1] !== 'Hint') return decl[1]
  const statement = src.slice(decl.index, src.indexOf(';', decl.index) + 1)
  const created = statement.match(/new\s+(\w+Hint)\s*\(/)
  return created ? created[1] : null
}

function computeRegistered(files) {
  const out = []
  for (const path of files) {
    const src = stripComments(readJava(path))
    for (const call of findCalls(src, 'addHint')) {
      if (isAddHintDeclaration(call, src)) continue
      const expression = normalizeWs(call.args.join(','))
      out.push({ path, expression, class: resolveHintClass(expression, src) })
    }
  }
  return out.sort((a, b) => cmp(a.path, b.path) || cmp(a.expression, b.expression))
}

function computeHintIcons() {
  const src = stripComments(readJava(HINT_UTILS))
  const icons = {}
  const re = /\b(?:public\s+)?static\s+final\s+String\s+(HINT_ICON_\w+)\s*=\s*"((?:[^"\\]|\\.)*)"/g
  for (const match of src.matchAll(re)) {
    icons[match[1]] = unescapeJava(`"${match[2]}"`)
  }
  const mark = src.match(/\b(?:public\s+)?static\s+final\s+String\s+HINT_START_MARK\s*=\s*"((?:[^"\\]|\\.)*)"/)
  const sorted = {}
  for (const key of Object.keys(icons).sort()) sorted[key] = icons[key]
  return { hintIcons: sorted, hintStartMark: mark ? unescapeJava(`"${mark[1]}"`) : null }
}

function collectStringConstants(files) {
  const local = new Map()
  const global = new Map()
  const localRe = /\bString\s+(\w+)\s*=\s*"((?:[^"\\]|\\.)*)"\s*;/g
  const globalRe = /\bpublic\s+static\s+final\s+String\s+(\w+)\s*=\s*"((?:[^"\\]|\\.)*)"\s*;/g
  for (const path of files) {
    const src = stripComments(readJava(path))
    for (const match of src.matchAll(localRe)) {
      local.set(`${path}|${match[1]}`, unescapeJava(`"${match[2]}"`))
    }
    for (const match of src.matchAll(globalRe)) {
      if (!global.has(match[1])) global.set(match[1], { value: unescapeJava(`"${match[2]}"`), path })
    }
  }
  return { local, global }
}

function isMethodParameter(src, name) {
  return new RegExp(`\\w+\\s*\\([^)]*\\bString\\s+${name}\\b[^)]*\\)`).test(src)
}

function isInfoDeclaration(call, keyArg) {
  return new RegExp(`^String\\s+\\w+$`).test(normalizeWs(call.args[keyArg] ?? ''))
}

function computeInfoKeys(files) {
  const constants = collectStringConstants(files)
  const literal = new Map()
  const constant = new Map()
  const dynamic = new Set()

  const register = (path, src, expr) => {
    const text = normalizeWs(expr)
    if (isStringLiteral(text)) {
      const key = unescapeJava(text)
      if (!literal.has(key)) literal.set(key, new Set())
      literal.get(key).add(path)
      return
    }
    const name = text.match(/^[A-Za-z_$][\w$]*(?:\.[A-Za-z_$][\w$]*)*$/) ? text.split('.').pop() : null
    if (name) {
      const localValue = constants.local.get(`${path}|${name}`)
      const resolved = localValue !== undefined
        ? { value: localValue, path }
        : text.includes('.') ? constants.global.get(name) : undefined
      if (resolved) {
        constant.set(`${resolved.value}|${name}|${resolved.path}`, { key: resolved.value, constant: name, declaredAt: resolved.path })
      } else if (text.includes('.') || !isMethodParameter(src, text)) {
        dynamic.add(text)
      }
      return
    }
    dynamic.add(text)
  }

  for (const path of files) {
    const src = stripComments(readJava(path))
    for (const call of findCalls(src, 'addInfo')) {
      if (isInfoDeclaration(call, 0)) continue
      register(path, src, call.args[0] ?? '')
    }
    for (const call of findCalls(src, 'addInfoToObject')) {
      if (isInfoDeclaration(call, 1)) continue
      register(path, src, call.args[1] ?? '')
    }
  }

  return {
    literal: [...literal.entries()]
      .map(([key, paths]) => ({ key, paths: [...paths].sort() }))
      .sort((a, b) => cmp(a.key, b.key)),
    constants: [...constant.values()].sort((a, b) => cmp(a.key, b.key) || cmp(a.constant, b.constant) || cmp(a.declaredAt, b.declaredAt)),
    dynamic: [...dynamic].sort(),
  }
}

export function computeHintSchema() {
  const files = JAVA_ROOTS.flatMap((root) => walkJava(root))
  const { core, common, embedded } = computeHintClasses()
  const { hintIcons, hintStartMark } = computeHintIcons()
  return {
    meta: {
      scope: {
        modules: MODULES,
        excluded: ['Mage.Sets'],
        note: 'v1 cubre solo la API de hints del motor; Mage.Sets (corpus por carta: 2383 addHint, 50 hints, 60 addInfo) queda fuera.',
      },
      sources: {
        restrictRequirementTexts: [PERMANENT_IMPL],
        hintClasses: JAVA_ROOTS,
        registeredHints: JAVA_ROOTS,
        hintIcons: [HINT_UTILS],
        infoKeys: JAVA_ROOTS,
      },
      forkVersion: XMAGE_VERSION,
    },
    restrictRequirementTexts: computeRestrictRequirementTexts(),
    hintClasses: { core, common, embedded, registered: computeRegistered(files) },
    hintIcons,
    hintStartMark,
    infoKeys: computeInfoKeys(files),
  }
}

function main() {
  const schema = computeHintSchema()
  const dir = resolve(here, '../web/fixtures')
  mkdirSync(dir, { recursive: true })
  const outPath = resolve(dir, 'hint-schema.json')
  writeFileSync(outPath, JSON.stringify(schema, null, 2) + '\n')
  if (process.argv.includes('--update-baseline')) console.log('Updated hint-schema.json (baseline)')
  console.log(`Wrote ${outPath}`)
  console.log(`  restrictRequirementTexts: ${schema.restrictRequirementTexts.length}`)
  console.log(`  hintClasses: ${schema.hintClasses.core.length} core + ${schema.hintClasses.common.length} common + ${schema.hintClasses.embedded.length} embedded`)
  console.log(`  registered addHint calls: ${schema.hintClasses.registered.length}`)
  console.log(`  hintIcons: ${Object.keys(schema.hintIcons).length}`)
  console.log(`  infoKeys: ${schema.infoKeys.literal.length} literal + ${schema.infoKeys.constants.length} constant + ${schema.infoKeys.dynamic.length} dynamic`)
}

if (process.argv[1] === fileURLToPath(import.meta.url)) main()
