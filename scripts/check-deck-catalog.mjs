#!/usr/bin/env node
// Checks every printing in the deck catalogue against Scryfall and refreshes
// scripts/deck-catalog-printings.json, the table the offline guard compares to.
//
// XMage resolves a deck entry strictly by (set, number) and ignores the name
// (Mage.Proxy DeckValidation.checkCard), so a wrong collector number silently
// loads a different card: the player gets the deck issues dialog on every join
// and plays with cards the list never named.
//
//   node scripts/check-deck-catalog.mjs             # refresh the table
//   node scripts/check-deck-catalog.mjs --validate  # no network, no writes:
//                                                   # fail if an entry is unverified
import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const CATALOG = fileURLToPath(new URL('../web/src/decks/metaDeckCatalog.ts', import.meta.url))
const TABLE = fileURLToPath(new URL('./deck-catalog-printings.json', import.meta.url))
const API = 'https://api.scryfall.com/cards/collection'
const BATCH = 75

/** `{ cardName: 'x', setCode: 'y', cardNumber: 'z' }`, apostrophes escaped as in the source. */
const ENTRY = /cardName:\s*'((?:[^'\\]|\\.)*)'\s*,\s*setCode:\s*'([^']*)'\s*,\s*cardNumber:\s*'([^']*)'/g

export function printingKey(setCode, cardNumber) {
  return `${setCode.trim().toUpperCase()}#${cardNumber.trim()}`
}

/** Lower case, no diacritics, straight apostrophes: "Andúril" and "Anduril" are one name. */
export function foldName(name) {
  return (name ?? '')
    .normalize('NFD')
    .replace(/\p{M}+/gu, '')
    .replace(/[’']/g, "'")
    .trim()
    .toLowerCase()
}

/** True when a deck entry and the card the server loads are the same card. */
export function sameName(entry, loaded) {
  const a = foldName(entry)
  const b = foldName(loaded)
  if (a === b) return true
  // split and double faced cards: Scryfall answers "Front // Back"
  return b.split('//').some((face) => face.trim() === a)
}

export function catalogEntries(source) {
  const out = []
  for (const m of source.matchAll(ENTRY)) {
    out.push({ cardName: m[1].replace(/\\'/g, "'"), setCode: m[2], cardNumber: m[3] })
  }
  return out
}

/** Entries the table does not back: unknown printing, or a different card. */
export function unverified(entries, table) {
  const out = []
  for (const e of entries) {
    const key = printingKey(e.setCode, e.cardNumber)
    const loaded = table[key]
    if (loaded === undefined) out.push({ ...e, key, loaded: null })
    else if (!sameName(e.cardName, loaded)) out.push({ ...e, key, loaded })
  }
  return out
}

async function fetchTable(entries) {
  const keys = [...new Map(entries.map((e) => [printingKey(e.setCode, e.cardNumber), e])).values()]
  const table = {}
  const missing = []
  for (let i = 0; i < keys.length; i += BATCH) {
    const slice = keys.slice(i, i + BATCH)
    const res = await fetch(API, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        'User-Agent': 'xmage-nexus-deck-catalog-check/1.0',
      },
      body: JSON.stringify({
        identifiers: slice.map((e) => ({ set: e.setCode.toLowerCase(), collector_number: e.cardNumber })),
      }),
    })
    if (!res.ok) throw new Error(`Scryfall answered ${res.status} ${res.statusText}: ${await res.text()}`)
    const body = await res.json()
    for (const card of body.data ?? []) {
      table[printingKey(card.set, card.collector_number)] = card.name
    }
    for (const nf of body.not_found ?? []) {
      missing.push(printingKey(nf.set, nf.collector_number))
    }
    await new Promise((r) => setTimeout(r, 500)) // /cards/collection is limited to 2 per second (DCK-26)
  }
  return { table, missing }
}

function report(bad) {
  for (const e of bad) {
    console.error(`  ${e.setCode}#${e.cardNumber} says "${e.cardName}" but loads ${e.loaded ?? 'nothing (no such printing)'}`)
  }
}

async function main() {
  const entries = catalogEntries(readFileSync(CATALOG, 'utf8'))
  if (entries.length === 0) throw new Error('no card entries found in metaDeckCatalog.ts')

  if (process.argv.includes('--validate')) {
    const table = JSON.parse(readFileSync(TABLE, 'utf8'))
    const bad = unverified(entries, table)
    if (bad.length > 0) {
      console.error(`${bad.length} catalogue entr${bad.length === 1 ? 'y is' : 'ies are'} not verified:`)
      report(bad)
      console.error('\nRun `node scripts/check-deck-catalog.mjs` to refresh the table.')
      process.exit(1)
    }
    console.log(`deck catalogue: ${entries.length} entries verified`)
    return
  }

  const { table, missing } = await fetchTable(entries)
  for (const key of missing) table[key] = null
  const sorted = Object.fromEntries(Object.entries(table).sort(([a], [b]) => a.localeCompare(b)))
  writeFileSync(TABLE, `${JSON.stringify(sorted, null, 2)}\n`)
  const bad = unverified(entries, sorted)
  console.log(`deck catalogue: ${entries.length} entries, ${Object.keys(sorted).length} printings`)
  if (bad.length > 0) {
    console.error(`${bad.length} entries name a card the server would not load:`)
    report(bad)
    process.exit(1)
  }
  console.log('every entry names the card the server loads')
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main().catch((e) => {
    console.error(e.message)
    process.exit(1)
  })
}
