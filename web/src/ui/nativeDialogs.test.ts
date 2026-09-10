import { describe, expect, it } from 'vitest'

import { readFileSync, readdirSync, statSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve, extname } from 'node:path'

const here = dirname(fileURLToPath(import.meta.url))
const SRC = resolve(here, '..')

const OWN_FILES = new Set(['confirmDialog.ts', 'ConfirmModal.tsx', 'ConfirmHost.tsx'])

const NATIVE_RE = /(^|[^A-Za-z0-9_$.])(confirm|alert)\s*\(|window\s*\.\s*(confirm|alert|prompt)\s*\(/

function* walk(dir: string): Generator<string> {
  for (const entry of readdirSync(dir)) {
    const full = resolve(dir, entry)
    if (statSync(full).isDirectory()) {
      if (entry === 'node_modules' || entry === 'dist') continue
      yield* walk(full)
    } else if (extname(entry) === '.ts' || extname(entry) === '.tsx') {
      yield full
    }
  }
}

describe('native dialogs — prohibidos en src', () => {
  it('ningún fichero usa confirm()/alert()/prompt() nativos (no existen en el webview de Tauri/macOS)', () => {
    const hits: string[] = []
    for (const file of walk(SRC)) {
      const base = file.split('/').pop() ?? file
      if (OWN_FILES.has(base)) continue
      if (base.endsWith('.test.ts') || base.endsWith('.test.tsx')) continue
      const src = readFileSync(file, 'utf8')
      const lines = src.split('\n')
      lines.forEach((line, i) => {
        if (NATIVE_RE.test(line)) hits.push(`${file}:${i + 1}: ${line.trim()}`)
      })
    }
    expect(hits, `Diálogos nativos encontrados:\n${hits.join('\n')}`).toEqual([])
  })
})
