// @vitest-environment node
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const BOARD = fileURLToPath(new URL('.', import.meta.url))

const ALLOWED: Record<string, string> = {
  'CardInspector.css': 'modal scrim behind the card inspector, chrome over the board',
  'FloatingCardPreview.css': 'floating card preview and its flip badge, controls that float over the board',
  'PileOverlay.css': 'modal scrim behind the pile dialog, chrome over the board',
}

function cssFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = join(dir, name)
    if (statSync(full).isDirectory()) return cssFiles(full)
    return name.endsWith('.css') ? [full] : []
  })
}

function blurFiles(): string[] {
  return cssFiles(BOARD)
    .map((file) => relative(BOARD, file).split('\\').join('/'))
    .filter((rel) => readFileSync(join(BOARD, rel), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').includes('backdrop-filter'))
    .sort()
}

describe('board blur guard', () => {
  it('ACC-10: blur never sits on battlefield content, only on the allowed floating controls and scrims', () => {
    const unexpected = blurFiles().filter((rel) => !(rel in ALLOWED))
    expect(unexpected, 'battlefield layers must not use backdrop-filter; add a floating control or scrim to ALLOWED on purpose').toEqual([])
  })

  it('ACC-10: every allowlisted file still sets backdrop-filter, so the list stays exact', () => {
    const stale = Object.keys(ALLOWED).filter((rel) => !blurFiles().includes(rel))
    expect(stale, 'remove files from ALLOWED once their blur is gone').toEqual([])
  })
})
