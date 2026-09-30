// @vitest-environment node
import { readdirSync, readFileSync } from 'node:fs'
import { join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const SRC = fileURLToPath(new URL('..', import.meta.url))

function walk(exts: string[]): string[] {
  return readdirSync(SRC, { recursive: true, encoding: 'utf8' })
    .map((rel) => join(SRC, rel))
    .filter((name) => exts.some((e) => name.endsWith(e)))
}

const cssFiles = walk(['.css'])
const strip = (css: string) =>
  css.replace(/\/\*[\s\S]*?\*\//g, '').replace(/url\((['"])data:[\s\S]*?\1\)/g, 'url()')

describe('css integrity', () => {
  it('every declaration has balanced parentheses', () => {
    const broken: string[] = []
    for (const file of cssFiles) {
      const css = strip(readFileSync(file, 'utf8'))
      for (const m of css.matchAll(/([\w-]+)\s*:([^{};]*)(?=[;}])/g)) {
        if (m[2].split('(').length !== m[2].split(')').length) {
          broken.push(`${relative(SRC, file)}: ${m[0].trim().slice(0, 100)}`)
        }
      }
    }
    expect(broken).toEqual([])
  })

  it('no rule has an empty body or a dangling selector comma', () => {
    const broken: string[] = []
    for (const file of cssFiles) {
      const css = readFileSync(file, 'utf8')
      for (const m of css.matchAll(/[^{};]*(?:\{\s*\}|,\s*\})/g)) {
        broken.push(`${relative(SRC, file)}: ${m[0].trim().slice(0, 100)}`)
      }
    }
    expect(broken).toEqual([])
  })

  it('every var() without fallback points to a defined custom property', () => {
    const sources = walk(['.css', '.ts', '.tsx']).map((f) => readFileSync(f, 'utf8')).join('\n')
    const defined = new Set([
      ...[...sources.matchAll(/(--[\w-]+)\s*:/g)].map((m) => m[1]),
      ...[...sources.matchAll(/['"](--[\w-]+)['"]/g)].map((m) => m[1]),
    ])
    const missing: string[] = []
    for (const file of cssFiles) {
      for (const m of strip(readFileSync(file, 'utf8')).matchAll(/var\(\s*(--[\w-]+)\s*([,)])/g)) {
        if (m[2] === ')' && !defined.has(m[1])) missing.push(`${relative(SRC, file)}: ${m[1]}`)
      }
    }
    expect(missing).toEqual([])
  })
})
