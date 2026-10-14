import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync } from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const pages = ['index.html', ...readdirSync(path.join(root, 'public')).filter((f) => f.endsWith('.html')).map((f) => path.join('public', f))]

describe('pages are compatible with the proxy CSP (script-src \'self\')', () => {
  it('found the pages to check', () => {
    expect(pages.length).toBeGreaterThanOrEqual(2)
  })

  for (const page of pages) {
    const html = readFileSync(path.join(root, page), 'utf8')

    it(`${page} has no inline <script>`, () => {
      const inline = Array.from(html.matchAll(/<script\b([^>]*)>/gi)).filter((m) => !/\bsrc\s*=/.test(m[1]))
      expect(inline.map((m) => m[0])).toEqual([])
    })

    it(`${page} has no inline event handlers or javascript: URLs`, () => {
      expect(html.match(/\son[a-z]+\s*=/gi) ?? []).toEqual([])
      expect(html.match(/javascript:/gi) ?? []).toEqual([])
    })
  }
})
