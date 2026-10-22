import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { repoRoot } from '../src/lib.ts'

const script = path.join(repoRoot, 'scripts', 'gen-keywords-i18n.mjs')
const roots: string[] = []

afterEach(() => {
  for (const root of roots.splice(0)) fs.rmSync(root, { recursive: true, force: true })
})

function run(root: string, args: string[]) {
  return spawnSync(process.execPath, [path.join(root, 'scripts', 'gen-keywords-i18n.mjs'), ...args], { encoding: 'utf8' })
}

function makeTree(): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'kw-check-'))
  roots.push(root)
  fs.mkdirSync(path.join(root, 'scripts'), { recursive: true })
  fs.mkdirSync(path.join(root, 'web', 'src', 'data'), { recursive: true })
  fs.mkdirSync(path.join(root, 'web', 'src', 'i18n'), { recursive: true })
  fs.copyFileSync(script, path.join(root, 'scripts', 'gen-keywords-i18n.mjs'))
  fs.cpSync(path.join(repoRoot, 'scripts', 'keywords-i18n'), path.join(root, 'scripts', 'keywords-i18n'), { recursive: true })
  fs.copyFileSync(path.join(repoRoot, 'web', 'src', 'data', 'mtgKeywords.ts'), path.join(root, 'web', 'src', 'data', 'mtgKeywords.ts'))
  fs.cpSync(path.join(repoRoot, 'web', 'src', 'i18n', 'locales'), path.join(root, 'web', 'src', 'i18n', 'locales'), { recursive: true })
  return root
}

const localeOf = (root: string, lang: string) => path.join(root, 'web', 'src', 'i18n', 'locales', `${lang}.ts`)

describe('gen-keywords-i18n --check', () => {
  it('exits 0 on the committed tree', () => {
    const res = spawnSync(process.execPath, [script, '--check'], { encoding: 'utf8' })
    expect(res.stdout + res.stderr).toMatch(/keywords: 267 ids/)
    expect(res.status).toBe(0)
  })

  it('exits 1 and names the file when a generated locale has drifted', () => {
    const root = makeTree()
    expect(run(root, []).status).toBe(0)
    expect(run(root, ['--check']).status).toBe(0)

    const enFile = localeOf(root, 'en')
    const original = fs.readFileSync(enFile, 'utf8')
    const drifted = original.replace("affinity_for_artifacts_name: '", "affinity_for_artifacts_name: 'DRIFT ")
    expect(drifted).not.toBe(original)
    fs.writeFileSync(enFile, drifted)

    const res = run(root, ['--check'])
    expect(res.status).toBe(1)
    expect(res.stdout + res.stderr).toMatch(/en\.ts/)
    expect(fs.readFileSync(enFile, 'utf8')).toBe(drifted)
  }, 60_000)

  it('write mode refuses to drop a locale value whose id has no table entry, listing the ids', () => {
    const root = makeTree()
    const table = path.join(root, 'scripts', 'keywords-i18n', 'de.mjs')
    fs.writeFileSync(table, fs.readFileSync(table, 'utf8').split('\n').filter((line) => !line.startsWith('  adapt: ')).join('\n'))
    const before = fs.readFileSync(localeOf(root, 'de'), 'utf8')

    const res = run(root, [])
    expect(res.status).toBe(1)
    expect(res.stdout + res.stderr).toMatch(/adapt/)
    expect(fs.readFileSync(localeOf(root, 'de'), 'utf8')).toBe(before)
  }, 60_000)

  it('write mode with --force overwrites the dropped value', () => {
    const root = makeTree()
    const table = path.join(root, 'scripts', 'keywords-i18n', 'de.mjs')
    fs.writeFileSync(table, fs.readFileSync(table, 'utf8').split('\n').filter((line) => !line.startsWith('  adapt: ')).join('\n'))
    const before = fs.readFileSync(localeOf(root, 'de'), 'utf8')

    expect(run(root, ['--force']).status).toBe(0)
    expect(fs.readFileSync(localeOf(root, 'de'), 'utf8')).not.toBe(before)
  }, 60_000)

  it('falls back to the English mtgKeywords summary, never to the Spanish name', () => {
    const root = makeTree()
    const table = path.join(root, 'scripts', 'keywords-i18n', 'en.mjs')
    fs.writeFileSync(table, fs.readFileSync(table, 'utf8').split('\n').filter((line) => !line.startsWith('  aftermath: ')).join('\n'))

    expect(run(root, ['--force']).status).toBe(0)
    const en = fs.readFileSync(localeOf(root, 'en'), 'utf8')
    expect(en).toContain("aftermath_summary: 'Aftermath (Cast this spell only from your graveyard. Then exile it.)'")
    expect(en).not.toContain('(Mecánica)')
  }, 60_000)
})
