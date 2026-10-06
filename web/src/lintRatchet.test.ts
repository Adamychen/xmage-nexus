// @vitest-environment node
import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

/**
 * oxlint warnings may only go down. `npm run lint` already fails on errors (rules of hooks, the
 * correctness set, `any` in shipped code); the warnings below are the debt that existed when the
 * linter came in (missing effect dependencies), recorded per file and rule so a file can not add
 * more and fixing one never needs a config change. After fixing some, lower the
 * baseline with `UPDATE_LINT_BASELINE=1 npx vitest run src/lintRatchet.test.ts`.
 *
 * ESLint is not usable here: typescript-eslint needs the TypeScript compiler API, which
 * TypeScript 7 (the native port this project builds with) no longer ships.
 */

const WEB = fileURLToPath(new URL('..', import.meta.url))
const BASELINE = fileURLToPath(new URL('./lintBaseline.json', import.meta.url))

interface Diagnostic {
  code: string
  severity: 'error' | 'warning'
  filename: string
}

type Counts = Record<string, Record<string, number>>

function lint(): Diagnostic[] {
  const bin = join(dirname(createRequire(import.meta.url).resolve('oxlint/package.json')), 'bin', 'oxlint')
  let out: string
  try {
    out = execFileSync(process.execPath, [bin, '--format=json', 'src', 'e2e'], { cwd: WEB, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 })
  } catch (err) {
    // oxlint exits non-zero when it reports errors; its JSON is still on stdout
    out = (err as { stdout?: string }).stdout ?? ''
  }
  return (JSON.parse(out) as { diagnostics: Diagnostic[] }).diagnostics
}

function countWarnings(diagnostics: Diagnostic[]): Counts {
  const counts: Counts = {}
  for (const d of diagnostics) {
    if (d.severity !== 'warning') continue
    const file = (counts[d.filename] ??= {})
    file[d.code] = (file[d.code] ?? 0) + 1
  }
  return Object.fromEntries(Object.entries(counts).sort(([a], [b]) => a.localeCompare(b)))
}

describe('lint ratchet', () => {
  const diagnostics = lint()
  const current = countWarnings(diagnostics)

  if (process.env.UPDATE_LINT_BASELINE === '1') {
    it('writes the baseline', () => {
      writeFileSync(BASELINE, JSON.stringify(current, null, 2) + '\n')
    })
    return
  }

  const baseline: Counts = existsSync(BASELINE) ? JSON.parse(readFileSync(BASELINE, 'utf8')) : {}

  it('reports no lint errors', () => {
    const errors = diagnostics.filter((d) => d.severity === 'error').map((d) => `${d.filename}: ${d.code}`)
    expect(errors, 'run `npm run lint` for the details').toEqual([])
  })

  it('no file adds lint warnings beyond its baseline', () => {
    const regressions: string[] = []
    for (const [file, rules] of Object.entries(current)) {
      for (const [rule, n] of Object.entries(rules)) {
        const allowed = baseline[file]?.[rule] ?? 0
        if (n > allowed) regressions.push(`${file}: ${rule} ${n} > ${allowed}`)
      }
    }
    expect(regressions, 'run `npm run lint` for the details: declare the effect dependencies').toEqual([])
  })
})
