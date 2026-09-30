// @vitest-environment node
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const SRC = fileURLToPath(new URL('..', import.meta.url))

describe('close buttons', () => {
  it('the shared .ui-close centers its icon without depending on font metrics', () => {
    const css = readFileSync(join(SRC, 'ui/primitives.css'), 'utf8')
    const match = css.match(/\.ui-close\s*\{([^}]*)\}/)
    expect(match).not.toBeNull()
    expect(match![1]).toMatch(/display:\s*inline-flex/)
    expect(match![1]).toContain('align-items: center')
    expect(match![1]).toContain('justify-content: center')
  })

  it('no component hand-rolls a close (X) button instead of using CloseButton', () => {
    const offenders: string[] = []
    const files = readdirSync(SRC, { recursive: true, encoding: 'utf8' })
      .map((rel) => join(SRC, rel))
      .filter((f) => f.endsWith('.tsx') && !f.includes('.test.') && !f.endsWith('CloseButton.tsx'))
    for (const file of files) {
      const source = readFileSync(file, 'utf8')
      for (const m of source.matchAll(/<button\b[^>]*className=["'{`][^>]*close[^>]*>([\s\S]*?)<\/button>/gi)) {
        if (/<Icon name="x"/.test(m[1])) offenders.push(file.replace(SRC, ''))
      }
      if (/<button\b[^>]*>\s*[✕×]\s*<\/button>/.test(source)) offenders.push(file.replace(SRC, ''))
    }
    expect(offenders).toEqual([])
  })
})
