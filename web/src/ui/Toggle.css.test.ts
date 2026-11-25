// @vitest-environment node
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const SRC = fileURLToPath(new URL('..', import.meta.url))
const toggleCss = readFileSync(join(SRC, 'ui', 'Toggle.css'), 'utf8')

function cssFiles(dir: string): string[] {
  const out: string[] = []
  for (const name of readdirSync(dir)) {
    const path = join(dir, name)
    if (statSync(path).isDirectory()) out.push(...cssFiles(path))
    else if (name.endsWith('.css')) out.push(path)
  }
  return out
}

function bodiesFor(source: string, selectorPart: string): string[] {
  const stripped = source.replace(/\/\*[\s\S]*?\*\//g, '')
  return [...stripped.matchAll(/([^{}]+)\{([^{}]*)\}/g)]
    .filter((m) => m[1].split(',').some((s) => s.trim().endsWith(selectorPart)))
    .map((m) => m[2])
}

describe('the switch knob', () => {
  it('centres itself in the track instead of sitting at a fixed distance from its top', () => {
    const body = bodiesFor(toggleCss, '.ui-toggle-knob').join('\n')
    expect(body).toMatch(/top:\s*50%/)
    expect(body).toMatch(/translate:\s*0\s+-50%/)
    expect(body, 'a top in pixels only centres one track height').not.toMatch(/top:\s*-?[\d.]+px/)
  })

  it('is never pinned to a fixed top by a stylesheet that resizes it', () => {
    const offenders: string[] = []
    for (const file of cssFiles(SRC)) {
      for (const body of bodiesFor(readFileSync(file, 'utf8'), '.ui-toggle-knob')) {
        if (/top:\s*-?[\d.]+px/.test(body)) offenders.push(file)
      }
    }
    expect(offenders).toEqual([])
  })
})
