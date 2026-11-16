#!/usr/bin/env node
// BRD-47: checks (and, with --write, fixes) how the keyword symbols in
// web/public/symbols/abilities sit inside their square: every one centred on
// the ink it actually paints, and all of them with the same visual weight, so
// no symbol looks bigger than the rest in a 14px badge.
//
//   node scripts/ability-symbols.mjs                   # report on the keywords
//   node scripts/ability-symbols.mjs --write           # recentre and rebalance them
//   node scripts/ability-symbols.mjs counters --write  # the same for another folder
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
// The folder of symbols to measure: the keyword badges by default, any other
// set of symbols (the player counters, say) when one is named.
const FOLDER = process.argv.find((a) => !a.startsWith('-') && a !== process.argv[0] && a !== process.argv[1]) ?? 'abilities'
const DIR = join(HERE, '..', 'web', 'public', 'symbols', FOLDER)
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
/**
 * A sliver of air around every symbol. Framed exactly on its ink, a sharp point (the tip of the
 * experience crest, a wing) sits on the edge of the frame and the renderer eats its last row of
 * pixels, which reads as a cut.
 */
const MARGIN = 1.03

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

/**
 * The box a file's drawing really takes, in its own units. The ink pass below reads a render,
 * which can only show what the file's viewBox lets through, so a symbol whose art pokes outside it
 * (the tip of the experience crest, the blades of the radiation trefoil) would be measured, and
 * framed, on the part that happened to fit. This reads the geometry itself.
 */
async function geometry(file) {
  const svg = readFileSync(join(DIR, file), 'utf8')
  await page.setContent(`<body style="margin:0;padding:200px">${svg}</body>`)
  return page.evaluate(() => {
    const svg = document.querySelector('svg')
    if (!svg || !svg.viewBox?.baseVal?.width) return null
    svg.style.overflow = 'visible'
    const root = svg.getScreenCTM()?.inverse()
    if (!root) return null
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity
    for (const el of svg.querySelectorAll('path, circle, rect, polygon, ellipse, use')) {
      const bb = el.getBBox()
      if (!bb.width && !bb.height) continue
      const m = root.multiply(el.getScreenCTM())
      for (const [cx, cy] of [[bb.x, bb.y], [bb.x + bb.width, bb.y], [bb.x, bb.y + bb.height], [bb.x + bb.width, bb.y + bb.height]]) {
        const p = svg.createSVGPoint()
        p.x = cx
        p.y = cy
        const q = p.matrixTransform(m)
        x0 = Math.min(x0, q.x)
        y0 = Math.min(y0, q.y)
        x1 = Math.max(x1, q.x)
        y1 = Math.max(y1, q.y)
      }
    }
    return Number.isFinite(x0) ? { x0, y0, x1, y1 } : null
  })
}

if (WRITE) {
  // Give every file a viewBox that holds its whole drawing, so the ink pass sees all of it.
  for (const file of files) {
    const g = await geometry(file)
    if (!g) continue
    const src = readFileSync(join(DIR, file), 'utf8')
    const w = g.x1 - g.x0
    const h = g.y1 - g.y0
    const side = Math.max(w, h) * 1.08
    const nx = +(g.x0 + w / 2 - side / 2).toFixed(3)
    const ny = +(g.y0 + h / 2 - side / 2).toFixed(3)
    writeFileSync(join(DIR, file), src.replace(/viewBox="[^"]+"/, `viewBox="${nx} ${ny} ${side.toFixed(3)} ${side.toFixed(3)}"`))
  }
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
    const nw = +(inkSide * pad * MARGIN).toFixed(3)
    const nh = nw
    // Centred on the ink itself, not on its centre of mass: a shape with its weight to one side
    // (the crest of experience, the head of a droplet) would otherwise be framed off its own
    // outline and lose the far end of it.
    const inkX = squareX + ((row.box.x0 + row.box.x1) / 2) * squareW
    const inkY = squareY + ((row.box.y0 + row.box.y1) / 2) * squareH
    const nx = +(inkX - nw / 2).toFixed(3)
    const ny = +(inkY - nh / 2).toFixed(3)
    writeFileSync(join(DIR, row.file), src.replace(/viewBox="[^"]+"/, `viewBox="${nx} ${ny} ${nw} ${nh}"`))
  }
  rows.length = 0
  for (const file of files) {
    const m = await measure(file)
    if (m) rows.push({ file, ...m })
  }
}

const after = median(rows.map((r) => r.cover))
// Measured on the ink's own box, which is what the frame is built on: the centre of mass of a
// lopsided symbol sits elsewhere and would report every one of them as off centre.
const middle = (r) => ({ x: (r.box.x0 + r.box.x1) / 2, y: (r.box.y0 + r.box.y1) / 2 })
const offCentre = rows.filter((r) => Math.abs(middle(r).x - 0.5) > CENTRE_TOLERANCE || Math.abs(middle(r).y - 0.5) > CENTRE_TOLERANCE)
const heavy = rows.filter((r) => r.cover > after * WEIGHT_TOLERANCE)

console.log(`${rows.length} symbols in ${DIR}`)
console.log(`ink: median ${(after * 100).toFixed(1)}%, range ${(Math.min(...rows.map((r) => r.cover)) * 100).toFixed(1)}% to ${(Math.max(...rows.map((r) => r.cover)) * 100).toFixed(1)}%`)
console.log(offCentre.length === 0
  ? `centred: every symbol within ${CENTRE_TOLERANCE * 100}% of the middle`
  : `off centre: ${offCentre.map((r) => `${r.file} (${((middle(r).x - 0.5) * 100).toFixed(1)}%, ${((middle(r).y - 0.5) * 100).toFixed(1)}%)`).join(', ')}`)
console.log(heavy.length === 0
  ? 'weight: no symbol stands out'
  : `too heavy: ${heavy.map((r) => `${r.file} ${(r.cover * 100).toFixed(1)}%`).join(', ')}`)

await browser.close()
process.exit(offCentre.length === 0 && heavy.length === 0 ? 0 : 1)
