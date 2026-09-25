import { describe, expect, it } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'

const SRC = join(__dirname, '..')
const TAURI_CONF = join(SRC, '..', '..', 'launcher', 'src-tauri', 'tauri.conf.json')

function sourceFiles(dir: string): string[] {
  const out: string[] = []
  for (const name of readdirSync(dir)) {
    const full = join(dir, name)
    if (statSync(full).isDirectory()) out.push(...sourceFiles(full))
    else if (/\.(ts|tsx)$/.test(name) && !/\.test\.(ts|tsx)$/.test(name)) out.push(full)
  }
  return out
}

function connectSrc(): string[] {
  const conf = JSON.parse(readFileSync(TAURI_CONF, 'utf8')) as { app?: { security?: { csp?: string } } }
  const csp = conf.app?.security?.csp ?? ''
  const directive = csp.split(';').map((d) => d.trim()).find((d) => d.startsWith('connect-src')) ?? ''
  return directive.split(/\s+/).slice(1)
}

describe('desktop CSP (launcher tauri.conf.json)', () => {
  it('allows every external API host the web fetches from', () => {
    const allowed = connectSrc()
    const missing: string[] = []
    for (const file of sourceFiles(SRC)) {
      const text = readFileSync(file, 'utf8')
      if (!/\bfetch\(/.test(text)) continue
      for (const m of text.matchAll(/https:\/\/((?:api|json)\.[a-z0-9.-]+)/g)) {
        const origin = `https://${m[1]}`
        if (!allowed.includes(origin)) missing.push(`${relative(SRC, file)}: ${origin}`)
      }
    }
    expect([...new Set(missing)], 'add these origins to connect-src or the desktop app blocks them').toEqual([])
  })
})
