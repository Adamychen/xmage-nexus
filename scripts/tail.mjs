#!/usr/bin/env node
// Colas filtradas de los logs del stack.
// Uso: node scripts/tail.mjs [server|proxy|vite|all] [líneas]
// Ej:  node scripts/tail.mjs proxy 40

import { logFileFor, sanitizeLineCount, tailFile } from './lib.mjs'

const target = process.argv[2] ?? 'all'
const rawLines = process.argv[3]
const lines = rawLines === undefined ? 25 : sanitizeLineCount(rawLines, 0)
const VALID = new Set(['server', 'proxy', 'vite', 'all'])
if (!VALID.has(target)) {
  console.error(`invalid target: ${target} (server|proxy|vite|all)`)
  process.exit(2)
}
if (!lines) {
  console.error(`invalid line count: ${rawLines} (positive integer)`)
  process.exit(2)
}
const wants = (t) => target === 'all' || target === t

for (const name of ['server', 'proxy', 'vite']) {
  if (!wants(name)) continue
  const files = logFileFor(name)
  if (!files.length) {
    console.log(`\n===== ${name} (no logs) =====`)
    continue
  }
  for (const file of files) {
    tailFile(`${name} (${pathLabel(file)})`, file, lines)
  }
}

function pathLabel(file) {
  return file.split(/[\\/]/).slice(-3).join('/')
}
