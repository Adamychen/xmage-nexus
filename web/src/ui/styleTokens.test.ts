// @vitest-environment node
import { existsSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const SRC = fileURLToPath(new URL('..', import.meta.url))
const BASELINE = fileURLToPath(new URL('./styleBaseline.json', import.meta.url))
const TOKENS = 'ui/tokens.css'

interface Counts {
  colors: number
  radii: number
  fontSizes: number
}

function cssFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = join(dir, name)
    if (statSync(full).isDirectory()) return cssFiles(full)
    return name.endsWith('.css') ? [full] : []
  })
}

function count(source: string): Counts {
  const stripped = source.replace(/\/\*[\s\S]*?\*\//g, '')
  return {
    colors: (stripped.match(/#[0-9a-fA-F]{3,8}\b|rgba?\((?!\s*var\()/g) ?? []).length,
    radii: (stripped.match(/border-radius:\s*[0-9.]+px/g) ?? []).length,
    fontSizes: (stripped.match(/font-size:\s*[0-9.]+(?:px|rem)/g) ?? []).length,
  }
}

function measure(): Record<string, Counts> {
  const result: Record<string, Counts> = {}
  for (const file of cssFiles(SRC).sort()) {
    const rel = relative(SRC, file)
    if (rel === TOKENS) continue
    const c = count(readFileSync(file, 'utf8'))
    if (c.colors || c.radii || c.fontSizes) result[rel] = c
  }
  return result
}

describe('style tokens ratchet', () => {
  const current = measure()

  if (process.env.UPDATE_STYLE_BASELINE === '1') {
    it('writes the baseline', () => {
      writeFileSync(BASELINE, JSON.stringify(current, null, 2) + '\n')
    })
    return
  }

  const baseline: Record<string, Counts> = existsSync(BASELINE) ? JSON.parse(readFileSync(BASELINE, 'utf8')) : {}

  it('no stylesheet adds literal colors, radii or font sizes beyond its baseline', () => {
    const regressions: string[] = []
    for (const [file, c] of Object.entries(current)) {
      const allowed = baseline[file] ?? { colors: 0, radii: 0, fontSizes: 0 }
      for (const key of ['colors', 'radii', 'fontSizes'] as const) {
        if (c[key] > allowed[key]) regressions.push(`${file}: ${key} ${c[key]} > ${allowed[key]}`)
      }
    }
    expect(regressions, 'use tokens from ui/tokens.css instead of literals').toEqual([])
  })

  it('ui/tokens.css is the only place that may define the palette', () => {
    expect(existsSync(join(SRC, TOKENS))).toBe(true)
  })
})
