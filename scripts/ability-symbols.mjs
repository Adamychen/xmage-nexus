#!/usr/bin/env node
// BRD-47: checks (and, with --write, fixes) how the keyword symbols in
// web/public/symbols/abilities sit inside their square: every one centred on
// the ink it actually paints, and all of them with the same visual weight, so
// no symbol looks bigger than the rest in a 14px badge.
//
//   node scripts/ability-symbols.mjs          # report
//   node scripts/ability-symbols.mjs --write  # recentre and rebalance
//
// The measurement is a real render: the browser rasterises each file the way
// the badge does (contain, centred in a square) and the ink is read from the
// alpha channel, because a path's bounding box counts geometry the fill rule
// leaves invisible.
import { readFileSync, writeFileSync, readdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createRequire } from 'node:module'

const HERE = dirname(fileURLToPath(import.meta.url))
const DIR = join(HERE, '..', 'web', 'public', 'symbols', 'abilities')
const require = createRequire(join(HERE, '..', 'web', 'package.json'))
const { chromium } = require('playwright')

const WRITE = process.argv.includes('--write')
/** Off-centre allowance, as a share of the square. */
const CENTRE_TOLERANCE = 0.02
/** How much the ink of the heaviest symbol may exceed the median. */
const WEIGHT_TOLERANCE = 1.3
/**
 * How far to go towards equal ink. At 1 every symbol carries the same amount of
 * ink, which makes a thin, spread-out shape (the wing of flying) span the whole
 * square while a compact one (the heart of lifelink) floats in the middle of
 * it; at 0 every symbol spans the square and the dense ones look heavy. Half
 * way keeps both readable.
 */
const BALANCE = 0.75
/** The most a symbol may be padded, as a share of its own frame. */
const MAX_PAD = 1.2

const files = readdirSync(DIR).filter((f) => f.endsWith('.svg')).sort()
if (files.length === 0) {
  console.error(`no symbols in ${DIR}`)
  process.exit(1)
}

const browser = await chromium.launch()
const page = await (await browser.newContext()).newPage()

/** The ink of one file: where it starts and ends, its weight and its centre. */
async function measure(file) {
  const svg = readFileSync(join(DIR, file), 'utf8')
  return page.evaluate(async (source) => {
    const url = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(source)}`
    const img = new Image()
    await new Promise((resolve) => {
      img.onload = resolve
      img.onerror = resolve
      img.src = url
    })
    const S = 256
    const canvas = document.createElement('canvas')
    canvas.width = S
    canvas.height = S
    const ctx = canvas.getContext('2d')
    const ratio = Math.min(S / (img.width || S), S / (img.height || S))
    const w = (img.width || S) * ratio
    const h = (img.height || S) * ratio
    ctx.drawImage(img, (S - w) / 2, (S - h) / 2, w, h)
    const data = ctx.getImageData(0, 0, S, S).data
    let ink = 0
    let sx = 0
    let sy = 0
    let weight = 0
    let x0 = S
    let x1 = -1
    let y0 = S
    let y1 = -1
    for (let y = 0; y < S; y++) {
      for (let x = 0; x < S; x++) {
        const a = data[(y * S + x) * 4 + 3]
        if (a <= 12) continue
        ink += a / 255
        sx += x * a
        sy += y * a
        weight += a
        if (x < x0) x0 = x
        if (x > x1) x1 = x
        if (y < y0) y0 = y
        if (y > y1) y1 = y
      }
    }
    if (!weight) return null
    // Everything as a share of the square the badge draws in, plus how much of
    // that square the file itself takes once it is fitted inside.
    return {
      cover: ink / (S * S),
      cx: sx / weight / S,
      cy: sy / weight / S,
      box: { x0: x0 / S, x1: (x1 + 1) / S, y0: y0 / S, y1: (y1 + 1) / S },
      fit: { w: w / S, h: h / S },
    }
  }, svg)
}

const rows = []
for (const file of files) {
  const m = await measure(file)
  if (m) rows.push({ file, ...m })
}

const median = (list) => [...list].sort((a, b) => a - b)[Math.floor(list.length / 2)]
const target = median(rows.map((r) => r.cover))

if (WRITE) {
  for (const row of rows) {
    const src = readFileSync(join(DIR, row.file), 'utf8')
    const box = /viewBox="([^"]+)"/.exec(src)
    if (!box) continue
    const [x, y, w, h] = box[1].split(/\s+/).map(Number)
    // The square the badge draws in, in this file's own units.
    const squareW = w / row.fit.w
    const squareH = h / row.fit.h
    const squareX = x - (squareW - w) / 2
    const squareY = y - (squareH - h) / 2
    // Frame on the ink itself, so every symbol spans its square the same way,
    // and then give the heavier ones some air, half way towards equal ink.
    const inkSide = Math.max((row.box.x1 - row.box.x0) * squareW, (row.box.y1 - row.box.y0) * squareH)
    const pad = Math.min(MAX_PAD, Math.max(1, (row.cover / target) ** (BALANCE / 2)))
    const nw = +(inkSide * pad).toFixed(3)
    const nh = nw
    const nx = +(squareX + row.cx * squareW - nw / 2).toFixed(3)
    const ny = +(squareY + row.cy * squareH - nh / 2).toFixed(3)
    writeFileSync(join(DIR, row.file), src.replace(/viewBox="[^"]+"/, `viewBox="${nx} ${ny} ${nw} ${nh}"`))
  }
  rows.length = 0
  for (const file of files) {
    const m = await measure(file)
    if (m) rows.push({ file, ...m })
  }
}

const after = median(rows.map((r) => r.cover))
const offCentre = rows.filter((r) => Math.abs(r.cx - 0.5) > CENTRE_TOLERANCE || Math.abs(r.cy - 0.5) > CENTRE_TOLERANCE)
const heavy = rows.filter((r) => r.cover > after * WEIGHT_TOLERANCE)

console.log(`${rows.length} symbols in ${DIR}`)
console.log(`ink: median ${(after * 100).toFixed(1)}%, range ${(Math.min(...rows.map((r) => r.cover)) * 100).toFixed(1)}% to ${(Math.max(...rows.map((r) => r.cover)) * 100).toFixed(1)}%`)
console.log(offCentre.length === 0
  ? `centred: every symbol within ${CENTRE_TOLERANCE * 100}% of the middle`
  : `off centre: ${offCentre.map((r) => `${r.file} (${((r.cx - 0.5) * 100).toFixed(1)}%, ${((r.cy - 0.5) * 100).toFixed(1)}%)`).join(', ')}`)
console.log(heavy.length === 0
  ? 'weight: no symbol stands out'
  : `too heavy: ${heavy.map((r) => `${r.file} ${(r.cover * 100).toFixed(1)}%`).join(', ')}`)

await browser.close()
process.exit(offCentre.length === 0 && heavy.length === 0 ? 0 : 1)
