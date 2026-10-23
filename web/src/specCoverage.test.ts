// @vitest-environment node
import { readdirSync, readFileSync } from 'node:fs'
import { join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const WEB = fileURLToPath(new URL('..', import.meta.url))
const SPECS = fileURLToPath(new URL('../../docs/specs/', import.meta.url))
const TEST_ROOTS = ['src', 'e2e', 'fixtures', 'scripts']
const TEST_FILE = /\.(test|spec)(\.tsx?|\.mjs)$/

interface Rule {
  id: string
  file: string
  guard: 'none' | string[]
}

const posix = (p: string) => p.split('\\').join('/')

function readSpecs(): { prefixes: Map<string, string>; rules: Rule[]; problems: string[] } {
  const prefixes = new Map<string, string>()
  const rules: Rule[] = []
  const problems: string[] = []
  const files = readdirSync(SPECS).filter((f) => f.endsWith('.md') && f !== 'README.md').sort()
  for (const file of files) {
    const text = readFileSync(join(SPECS, file), 'utf8')
    const prefix = /^Prefix: `([A-Z]{2,5})`$/m.exec(text)?.[1]
    if (!prefix) {
      problems.push(`${file}: no "Prefix: \`XXX\`" line`)
      continue
    }
    if (prefixes.has(prefix)) problems.push(`${file}: prefix ${prefix} already used by ${prefixes.get(prefix)}`)
    prefixes.set(prefix, file)
    const sections = text.split(/^(?=### )/m).filter((s) => s.startsWith('### '))
    for (const section of sections) {
      const head = /^### ([A-Z]{2,5}-\d+) · \S.*$/m.exec(section)
      if (!head) {
        problems.push(`${file}: heading "${section.split('\n')[0]}" is not "### ${prefix}-<n> · <title>"`)
        continue
      }
      const id = head[1]
      if (!id.startsWith(`${prefix}-`)) problems.push(`${file}: ${id} does not use the file prefix ${prefix}`)
      if (rules.some((r) => r.id === id)) problems.push(`${file}: ${id} is declared twice`)
      const guards = [...section.matchAll(/^- Guard: (.*)$/gm)].map((m) => m[1].trim())
      if (guards.length !== 1) {
        problems.push(`${file}: ${id} needs exactly one "- Guard:" line`)
        continue
      }
      if (guards[0].startsWith('none yet')) {
        rules.push({ id, file, guard: 'none' })
        continue
      }
      const paths = [...guards[0].matchAll(/`([^`]+)`/g)].map((m) => m[1])
      if (paths.length === 0) problems.push(`${file}: ${id} guard lists no \`path\` and is not "none yet"`)
      rules.push({ id, file, guard: paths })
    }
  }
  return { prefixes, rules, problems }
}

function taggedTests(prefixes: Set<string>): Map<string, Set<string>> {
  const byId = new Map<string, Set<string>>()
  const title = /\b(?:it|test)(?:\.(?:only|skip|fixme|fails|concurrent))*(?:\.each\s*\((?:[^()]|\((?:[^()]|\([^()]*\))*\))*\))?\(\s*(['"`])((?:[A-Z]{2,5}-\d+)(?:,\s*[A-Z]{2,5}-\d+)*):\s/g
  for (const root of TEST_ROOTS) {
    const base = root === 'scripts' ? resolve(WEB, '..', 'scripts') : join(WEB, root)
    const files = readdirSync(base, { recursive: true, encoding: 'utf8' })
      .filter((f) => TEST_FILE.test(f) && !f.includes('node_modules'))
    for (const f of files) {
      const abs = join(base, f)
      const rel = posix(relative(WEB, abs))
      const shown = rel.startsWith('../scripts/') ? rel.slice(3) : rel
      const text = readFileSync(abs, 'utf8')
      for (const m of text.matchAll(title)) {
        for (const id of m[2].split(/,\s*/)) {
          if (!prefixes.has(id.split('-')[0])) continue
          if (!byId.has(id)) byId.set(id, new Set())
          byId.get(id)!.add(shown)
        }
      }
    }
  }
  return byId
}

const { prefixes, rules, problems } = readSpecs()
const tagged = taggedTests(new Set(prefixes.keys()))

describe('behaviour specs (docs/specs) stay linked to their tests', () => {
  it('every spec file and rule is well formed', () => {
    expect(prefixes.size).toBeGreaterThan(0)
    expect(problems).toEqual([])
  })

  it('every test that names a rule names one that exists', () => {
    const known = new Set(rules.map((r) => r.id))
    const dangling = [...tagged.entries()]
      .filter(([id]) => !known.has(id))
      .map(([id, files]) => `${id} in ${[...files].join(', ')}`)
    expect(dangling).toEqual([])
  })

  it('every guarded rule lists exactly the files whose tests carry its id', () => {
    const drift: string[] = []
    for (const rule of rules) {
      if (rule.guard === 'none') continue
      const actual = [...(tagged.get(rule.id) ?? [])].sort()
      const listed = [...rule.guard].sort()
      if (actual.join() !== listed.join()) {
        drift.push(`${rule.id} (${rule.file}): Guard lists [${listed.join(', ')}], tests found in [${actual.join(', ')}]`)
      }
    }
    expect(drift).toEqual([])
  })

  it('a rule marked "none yet" has no test carrying its id', () => {
    const stale = rules
      .filter((r) => r.guard === 'none' && tagged.has(r.id))
      .map((r) => `${r.id} (${r.file}) is guarded by ${[...tagged.get(r.id)!].join(', ')}: list it`)
    expect(stale).toEqual([])
  })
})
