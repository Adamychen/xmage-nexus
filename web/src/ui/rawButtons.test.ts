// @vitest-environment node
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const SRC = fileURLToPath(new URL('..', import.meta.url))
const MAX_RAW_BUTTONS = 90

function tsxFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = join(dir, name)
    if (statSync(full).isDirectory()) return tsxFiles(full)
    return name.endsWith('.tsx') && !name.includes('.test.') ? [full] : []
  })
}

/** The JSX tag opening at `start`, up to the `>` that is not inside `{…}` or a
 *  string, so `onClick={() => x}` does not end it early. */
function openingTag(source: string, start: number): string {
  let depth = 0
  let quote: string | null = null
  for (let i = start; i < source.length; i++) {
    const ch = source[i]
    if (quote) {
      if (ch === '\\') i++
      else if (ch === quote) quote = null
    } else if (ch === '"' || ch === "'" || ch === '`') quote = ch
    else if (ch === '{') depth++
    else if (ch === '}') depth--
    else if (ch === '>' && depth === 0) return source.slice(start, i + 1)
  }
  return source.slice(start)
}

/** Top-level attribute names of an opening tag (`{...spread}` reported as `...`). */
function attributeNames(tag: string): string[] {
  const names: string[] = []
  let depth = 0
  let quote: string | null = null
  for (let i = 0; i < tag.length; i++) {
    const ch = tag[i]
    if (quote) {
      if (ch === '\\') i++
      else if (ch === quote) quote = null
      continue
    }
    if (ch === '"' || ch === "'" || ch === '`') quote = ch
    else if (ch === '{') {
      if (depth === 0 && tag.startsWith('{...', i)) names.push('...')
      depth++
    } else if (ch === '}') depth--
    else if (depth === 0 && /\s/.test(ch)) {
      const m = /^[A-Za-z_][\w-]*/.exec(tag.slice(i + 1))
      if (m) names.push(m[0])
    }
  }
  return names
}

/** Raw `<button>`s outside the primitives in `ui/` (bespoke controls: cards,
 *  piles, phase pills, mana orbs…) without an explicit `type`: inside a form
 *  the default `submit` would send it. */
function untypedButtons(): string[] {
  const found: string[] = []
  for (const file of tsxFiles(SRC)) {
    const rel = relative(SRC, file)
    if (rel.startsWith('ui/') || rel.startsWith('dev/')) continue
    const source = readFileSync(file, 'utf8')
    for (const m of source.matchAll(/<button(?=[\s>])/g)) {
      const names = attributeNames(openingTag(source, m.index))
      if (!names.includes('type') && !names.includes('...')) {
        found.push(`${rel}:${source.slice(0, m.index).split('\n').length}`)
      }
    }
  }
  return found
}

describe('raw <button> ratchet', () => {
  it('outside ui/, no new hand-rolled <button> appears (use Button, IconButton, CloseButton, ChipButton, MenuItem or Tabs)', () => {
    let count = 0
    for (const file of readdirSync(SRC, { recursive: true, encoding: 'utf8' }).map((rel) => join(SRC, rel))) {
      if (!file.endsWith('.tsx') || file.includes('.test.') || file.startsWith(join(SRC, 'ui'))) continue
      count += (readFileSync(file, 'utf8').match(/<button\b/g) ?? []).length
    }
    expect(count).toBeLessThanOrEqual(MAX_RAW_BUTTONS)
  })
})

describe('raw buttons', () => {
  it('reads attribute names past arrow functions, strings and spreads', () => {
    const src = `<button onClick={() => go('>')} title="a > b" {...rest} type="button">x</button>`
    expect(attributeNames(openingTag(src, 0))).toEqual(['onClick', 'title', '...', 'type'])
  })

  it('every <button> outside ui/ declares its type', () => {
    expect(untypedButtons(), 'add type="button" (or use a ui/ primitive)').toEqual([])
  })
})
