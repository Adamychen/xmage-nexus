#!/usr/bin/env node
import fs from 'node:fs'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { repoRoot } from './lib.mjs'

const dir = path.join(repoRoot, 'web/src/board/glyphs')
const groups = ['core', 'combat', 'counters-cards', 'graveyard', 'mana', 'mech-1', 'mech-2', 'mech-3', 'mech-4', 'mech-5']
const only = process.argv[2]

const owner = new Map()
const shapes = new Map()
const dupIds = []
const dupShapes = []
const sigla = new Map()
const dupSigla = []
for (const name of groups) {
  const { group } = await import(`${pathToFileURL(path.join(dir, `${name}.ts`)).href}?t=${Date.now()}`)
  for (const [id, nodes] of Object.entries(group.glyphs)) {
    if (owner.has(id)) dupIds.push(`${id}: ${owner.get(id)} and ${name}`)
    owner.set(id, name)
    const key = JSON.stringify(nodes)
    if (shapes.has(key)) dupShapes.push({ id, file: name, same: shapes.get(key) })
    else shapes.set(key, { id, file: name })
  }
  for (const id of Object.keys(group.abbreviations)) {
    if (owner.has(id)) dupIds.push(`${id}: ${owner.get(id)} and ${name}`)
    owner.set(id, name)
    const text = group.abbreviations[id].toLowerCase()
    if (sigla.has(text)) dupSigla.push({ id, file: name, same: sigla.get(text), text: group.abbreviations[id] })
    else sigla.set(text, { id, file: name })
  }
}

const shown = dupShapes.filter((d) => !only || d.file === only)
for (const d of dupIds) console.log(`DUPLICATE ID ${d}`)
for (const d of shown) console.log(`SAME SHAPE ${d.id} (${d.file}) == ${d.same.id} (${d.same.file})`)
const shownSigla = dupSigla.filter((d) => !only || d.file === only)
for (const d of shownSigla) console.log(`SAME SIGLA ${d.id} (${d.file}) == ${d.same.id} (${d.same.file}) as "${d.text}"`)
console.log(`${dupIds.length} duplicate ids, ${shown.length} entries sharing a shape, ${shownSigla.length} entries sharing an abbreviation${only ? ` in ${only}` : ''}`)
process.exit(dupIds.length || shown.length || shownSigla.length ? 1 : 0)
