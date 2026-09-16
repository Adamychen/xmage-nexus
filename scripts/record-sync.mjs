#!/usr/bin/env node
import * as fs from 'node:fs'
import * as path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const DRIVERS_DIR = path.join(__dirname, 'drivers')
const RECORDED_DIR = path.join(__dirname, '..', 'web', 'fixtures', 'recorded')
const MANIFEST = path.join(RECORDED_DIR, 'manifest.json')

const manifest = JSON.parse(fs.readFileSync(MANIFEST, 'utf8'))
const byFile = new Map(manifest.map((e, i) => [e.file, i]))
const testSrc = fs.readFileSync(path.join(__dirname, '..', 'web', 'fixtures', 'recorded.test.ts'), 'utf8')

let added = 0
const missingAssert = []
for (const f of fs.readdirSync(DRIVERS_DIR).sort()) {
  if (!f.endsWith('.mjs')) continue
  const mod = await import(pathToFileURL(path.join(DRIVERS_DIR, f)).href)
  const meta = mod.meta
  if (!meta?.mechanic) continue
  const file = meta.file ?? `${meta.mechanic}.json`
  if (!fs.existsSync(path.join(RECORDED_DIR, file))) continue
  const entry = { file, mechanic: meta.mechanic, kind: meta.kind ?? 'game', assert: meta.assert, note: meta.note }
  if (byFile.has(file)) manifest[byFile.get(file)] = entry
  else {
    byFile.set(file, manifest.length)
    manifest.push(entry)
    added += 1
  }
  if (meta.assert && !testSrc.includes(`'${meta.assert}'`)) missingAssert.push(`${file}: ${meta.assert}`)
}
fs.writeFileSync(MANIFEST, JSON.stringify(manifest, null, 2) + '\n')
console.log(`manifest: ${manifest.length} entradas (${added} nuevas)`)
if (missingAssert.length) console.log(`assert pendientes en recorded.test.ts:\n  ${missingAssert.join('\n  ')}`)
