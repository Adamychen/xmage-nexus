#!/usr/bin/env node
import fs from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'
import { pathToFileURL } from 'node:url'
import { repoRoot } from './lib.mjs'

const glyphDir = path.join(repoRoot, 'web/src/board/glyphs')
const outDir = path.join(repoRoot, '.run/glyph-sheets')
const names = process.argv.slice(2)
if (names.length === 0) {
  console.error('usage: node scripts/glyph-sheet.mjs <group|all> [group...]')
  process.exit(2)
}

const groupNames = names.includes('all')
  ? fs.readdirSync(glyphDir).filter((f) => f.endsWith('.ts') && !['types.ts', 'index.ts'].includes(f) && !f.endsWith('.test.ts')).map((f) => f.slice(0, -3))
  : names

const attrs = (a) => Object.entries(a).map(([k, v]) => `${k}="${String(v).replace(/"/g, '&quot;')}"`).join(' ')
const svg = (glyph) =>
  `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${glyph.map(([tag, a]) => `<${tag} ${attrs(a)}/>`).join('')}</svg>`

const cells = []
const problems = []
for (const name of groupNames) {
  const mod = await import(`${pathToFileURL(path.join(glyphDir, `${name}.ts`)).href}?t=${Date.now()}`)
  const { glyphs, abbreviations } = mod.group
  for (const [id, glyph] of Object.entries(glyphs)) {
    if (!Array.isArray(glyph) || glyph.length === 0) problems.push(`${name}/${id}: empty glyph`)
    cells.push({ id, group: name, html: svg(glyph) })
  }
  for (const [id, text] of Object.entries(abbreviations)) {
    if (!/^[A-Za-z]{2}$/.test(text)) problems.push(`${name}/${id}: abbreviation "${text}" is not 2 letters`)
    cells.push({ id, group: name, html: `<b>${text}</b>` })
  }
}

const html = `<!doctype html><meta charset="utf-8"><style>
body{margin:0;padding:12px;background:#0d1224;color:#dfe5f5;font:12px system-ui,sans-serif}
.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(210px,1fr));gap:8px}
.cell{display:flex;align-items:center;gap:8px;padding:6px 8px;border:1px solid #2a3350;border-radius:6px}
.coin{display:inline-flex;align-items:center;justify-content:center;border-radius:50%;background:#2a8fe0;color:#0d1224;flex:none}
.coin svg{width:72%;height:72%}.coin b{font:800 .5em system-ui}
.s14{width:14px;height:14px;font-size:14px}.s20{width:20px;height:20px;font-size:20px}.s48{width:48px;height:48px;font-size:48px}
.id{flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
</style><div class="grid">${cells
  .map((c) => `<div class="cell"><span class="coin s48">${c.html}</span><span class="coin s20">${c.html}</span><span class="coin s14">${c.html}</span><span class="id">${c.id}</span></div>`)
  .join('')}</div>`

fs.mkdirSync(outDir, { recursive: true })
const label = names.join('+')
const htmlPath = path.join(outDir, `${label}.html`)
const pngPath = path.join(outDir, `${label}.png`)
fs.writeFileSync(htmlPath, html)

const require = createRequire(path.join(repoRoot, 'web/package.json'))
const { chromium } = require('playwright')
const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1300, height: 800 } })
await page.goto(pathToFileURL(htmlPath).href)
await page.screenshot({ path: pngPath, fullPage: true })
await browser.close()

console.log(`${cells.length} entries (${cells.filter((c) => c.html.startsWith('<b>')).length} abbreviations)`)
for (const p of problems) console.log(`PROBLEM ${p}`)
console.log(pngPath)
