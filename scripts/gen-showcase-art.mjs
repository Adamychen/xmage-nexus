#!/usr/bin/env node
// Generates the "showcase" art set: a small curated list of real card artworks
// committed under web/public/showcase/ and a JSON manifest (card name -> local
// path) imported by the visual helpers in web/src/cards/showcaseArt.ts.
//
// Why committed instead of fetched at runtime: e2e aborts every non-localhost
// request (web/e2e/gallery.spec.ts), and the settings/playmat pickers must paint
// identically in fake mode, dev and prod. Same rationale as tokenImages.generated.json.
//
// Usage:
//   node scripts/gen-showcase-art.mjs           # fetch + write files
//   node scripts/gen-showcase-art.mjs --validate # verify manifest vs files (CI)

import { mkdirSync, existsSync, readFileSync, writeFileSync, statSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = dirname(dirname(fileURLToPath(import.meta.url)))
const PUB_DIR = join(root, 'web', 'public', 'showcase')
const MANIFEST = join(root, 'web', 'src', 'data', 'showcaseArt.generated.json')

// Card names resolved against Scryfall's default printing. Keep this list small:
// it is decoration for pickers, not the game's art pipeline (that one stays on
// scryfallClient.ts with its cache/queue; this script runs once at dev time).
const CARDS = [
  'Island',
  'Mountain',
  'Forest',
  'Plains',
  'Swamp',
  'Lightning Bolt',
  'Counterspell',
  'Shivan Dragon',
  'Birds of Paradise',
  'Tarmogoyf',
  'Sentinel Spider',
  'Sol Ring',
  'Giant Growth',
]

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

function slug(name) {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
}

async function fetchJson(url) {
  const res = await fetch(url, { headers: { 'User-Agent': 'xmage-nexus-showcase/1.0 (dev-time generator)' } })
  if (!res.ok) throw new Error(`${res.status} ${res.statusText} for ${url}`)
  return res.json()
}

async function main() {
  const validate = process.argv.includes('--validate')
  if (validate) {
    if (!existsSync(MANIFEST)) {
      console.error('showcaseArt.generated.json missing — run: node scripts/gen-showcase-art.mjs')
      process.exit(1)
    }
    const manifest = JSON.parse(readFileSync(MANIFEST, 'utf8'))
    const missing = []
    let total = 0
    for (const [name, path] of Object.entries(manifest)) {
      const file = join(root, 'web', 'public', path)
      if (!existsSync(file)) missing.push(`${name} -> ${path}`)
      else total += statSync(file).size
    }
    if (missing.length) {
      console.error(`Missing showcase art (${missing.length}):\n  ${missing.join('\n  ')}`)
      process.exit(1)
    }
    console.log(`showcase art OK: ${Object.keys(manifest).length} entries, ${(total / 1024).toFixed(0)} KiB`)
    return
  }

  mkdirSync(PUB_DIR, { recursive: true })
  const manifest = {}
  for (const name of CARDS) {
    const json = await fetchJson(`https://api.scryfall.com/cards/named?exact=${encodeURIComponent(name)}`)
    const artUrl = json.image_uris?.art_crop ?? json.image_uris?.normal
    if (!artUrl) {
      console.error(`No art for ${name}`)
      process.exit(1)
    }
    const file = `${slug(name)}.jpg`
    const res = await fetch(artUrl, { headers: { 'User-Agent': 'xmage-nexus-showcase/1.0 (dev-time generator)' } })
    if (!res.ok) {
      console.error(`Art download ${res.status} for ${name}`)
      process.exit(1)
    }
    const buf = Buffer.from(await res.arrayBuffer())
    writeFileSync(join(PUB_DIR, file), buf)
    manifest[name] = `/showcase/${file}`
    console.log(`${name} -> /showcase/${file} (${(buf.length / 1024).toFixed(0)} KiB)`)
    await sleep(150) // be polite; the whole set is one shot, not a hot loop
  }
  writeFileSync(MANIFEST, JSON.stringify(manifest, null, 2) + '\n')
  console.log(`Wrote ${MANIFEST} (${Object.keys(manifest).length} cards)`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
