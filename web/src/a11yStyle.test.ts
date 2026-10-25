// @vitest-environment node
import { existsSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const SRC = fileURLToPath(new URL('.', import.meta.url))
const WEB = join(SRC, '..')
const SELF = fileURLToPath(import.meta.url)
const BASELINE = join(SRC, 'a11yStyleBaseline.json')
const TOKENS = join(SRC, 'ui/tokens.css')
const PRIMITIVES = join(SRC, 'ui/primitives.css')
const STYLES = join(SRC, 'styles.css')
const INDEX_HTML = join(WEB, 'index.html')
const PUBLIC = join(WEB, 'public')

interface Rule {
  selectors: string[]
  media: string[]
  decls: Map<string, string>
}

function files(dir: string, exts: string[]): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = join(dir, name)
    if (statSync(full).isDirectory()) return files(full, exts)
    return exts.some((ext) => name.endsWith(ext)) ? [full] : []
  })
}

function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, '')
}

function parseDecls(body: string): Map<string, string> {
  const decls = new Map<string, string>()
  for (const part of body.split(';')) {
    const idx = part.indexOf(':')
    if (idx < 0) continue
    const raw = part.slice(0, idx).trim()
    const prop = raw.startsWith('--') ? raw : raw.toLowerCase()
    const value = part
      .slice(idx + 1)
      .replace(/\s*!important\s*$/, '')
      .trim()
    if (prop) decls.set(prop, value)
  }
  return decls
}

function parseRules(css: string, media: string[] = [], out: Rule[] = []): Rule[] {
  let pos = 0
  while (pos < css.length) {
    const open = css.indexOf('{', pos)
    if (open === -1) break
    const prelude = css.slice(pos, open).split(';').pop()!.trim()
    let depth = 1
    let i = open + 1
    while (i < css.length && depth > 0) {
      if (css[i] === '{') depth++
      else if (css[i] === '}') depth--
      i++
    }
    const body = css.slice(open + 1, i - 1)
    pos = i
    if (prelude.startsWith('@layer')) {
      parseRules(body, media, out)
    } else if (/^@(media|supports|container)\b/.test(prelude)) {
      parseRules(body, [...media, prelude], out)
    } else if (!prelude.startsWith('@')) {
      out.push({ selectors: prelude.split(',').map((s) => s.trim()), media, decls: parseDecls(body) })
    }
  }
  return out
}

function isContrastMore(rule: Rule): boolean {
  return rule.media.some((m) => /prefers-contrast\s*:\s*more/i.test(m))
}

function isReducedTransparency(rule: Rule): boolean {
  return rule.media.some((m) => /prefers-reduced-transparency\s*:\s*reduce/i.test(m))
}

type Appearance = 'light' | 'dark' | 'base'

function appearanceOf(rule: Rule): Appearance {
  const text = [...rule.selectors, ...rule.media]
    .join(' ')
    .replace(/:not\(\s*\[data-theme\s*=\s*["']?(light|dark)["']?\s*\]\s*\)/gi, (_, word: string) =>
      word.toLowerCase() === 'light' ? ' dark ' : ' light ',
    )
    .toLowerCase()
  if (text.includes('light')) return 'light'
  if (text.includes('dark') || isContrastMore(rule)) return 'dark'
  return 'base'
}

function tokenLookup(rules: Rule[], appearance: 'light' | 'dark'): (name: string) => string | undefined {
  const ordered = [
    ...rules.filter((r) => !isContrastMore(r) && appearanceOf(r) === 'base'),
    ...rules.filter((r) => !isContrastMore(r) && appearanceOf(r) === appearance),
    ...rules.filter((r) => isContrastMore(r) && appearanceOf(r) === appearance),
  ]
  return (name) => {
    let value: string | undefined
    for (const rule of ordered) if (rule.decls.has(name)) value = rule.decls.get(name)
    return value
  }
}

function resolveValue(raw: string, lookup: (name: string) => string | undefined, depth = 0): string {
  if (depth > 20) throw new Error(`token cycle while resolving ${raw}`)
  return raw.replace(/var\(\s*(--[\w-]+)\s*(?:,\s*([^)]*))?\)/g, (_, name: string, fallback?: string) => {
    const value = lookup(name)
    if (value !== undefined) return resolveValue(value, lookup, depth + 1)
    if (fallback !== undefined) return resolveValue(fallback.trim(), lookup, depth + 1)
    throw new Error(`token ${name} is not defined for this appearance`)
  })
}

type Rgba = [number, number, number, number]

function parseColor(value: string): Rgba {
  const s = value.trim().toLowerCase()
  const hex = s.match(/^#([0-9a-f]{3,8})$/)
  if (hex) {
    let h = hex[1]
    if (h.length === 3 || h.length === 4) h = [...h].map((c) => c + c).join('')
    if (h.length !== 6 && h.length !== 8) throw new Error(`cannot parse colour ${value}`)
    const channels = [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16))
    const alpha = h.length === 8 ? parseInt(h.slice(6, 8), 16) / 255 : 1
    return [channels[0], channels[1], channels[2], alpha]
  }
  const fn = s.match(/^rgba?\((.+)\)$/)
  if (fn) {
    const parts = fn[1].replace('/', ' ').split(/[\s,]+/).filter(Boolean)
    if (parts.length < 3) throw new Error(`cannot parse colour ${value}`)
    const channel = (p: string) => (p.endsWith('%') ? (parseFloat(p) * 255) / 100 : parseFloat(p))
    const alpha = parts[3] === undefined ? 1 : parts[3].endsWith('%') ? parseFloat(parts[3]) / 100 : parseFloat(parts[3])
    return [channel(parts[0]), channel(parts[1]), channel(parts[2]), alpha]
  }
  throw new Error(`cannot parse colour ${value}`)
}

function composite(fg: Rgba, bg: Rgba): [number, number, number] {
  if (bg[3] < 1) throw new Error('the surface token must be opaque')
  return [0, 1, 2].map((i) => fg[i] * fg[3] + bg[i] * (1 - fg[3])) as [number, number, number]
}

function luminance(rgb: readonly number[]): number {
  const [r, g, b] = rgb.map((v) => {
    const c = v / 255
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
  })
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

function contrastRatio(a: readonly number[], b: readonly number[]): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x)
  return (hi + 0.05) / (lo + 0.05)
}

function toPx(value: string): number | undefined {
  const m = value.trim().match(/^(\d*\.?\d+)(px|rem|pt)\b/i)
  if (!m) return undefined
  const n = Number(m[1])
  const unit = m[2].toLowerCase()
  if (unit === 'px') return n
  if (unit === 'pt') return (n * 4) / 3
  return n * 16
}

function hitSize(rules: Rule[], selector: string): number {
  let best = 0
  for (const rule of rules) {
    if (!rule.media.some((m) => /\(\s*pointer:\s*coarse\s*\)/.test(m))) continue
    for (const s of rule.selectors) {
      if (s === `${selector}::before`) {
        const w = toPx(rule.decls.get('width') ?? '') ?? 0
        const h = toPx(rule.decls.get('height') ?? '') ?? 0
        best = Math.max(best, Math.min(w, h))
      }
      if (s === selector) {
        const w = toPx(rule.decls.get('min-width') ?? '') ?? 0
        const h = toPx(rule.decls.get('min-height') ?? '') ?? 0
        best = Math.max(best, Math.min(w, h))
      }
    }
  }
  return best
}

function attr(tag: string, name: string): string | undefined {
  return tag.match(new RegExp(`\\s${name}\\s*=\\s*"([^"]*)"`, 'i'))?.[1]
}

function pngSize(path: string): [number, number] {
  const buf = readFileSync(path)
  return [buf.readUInt32BE(16), buf.readUInt32BE(20)]
}

it('ACC-1: every stylesheet that sets backdrop-filter removes it under prefers-reduced-transparency', () => {
  const offenders: string[] = []
  for (const file of files(SRC, ['.css']).sort()) {
    const css = stripComments(readFileSync(file, 'utf8'))
    if (!css.includes('backdrop-filter')) continue
    const rel = relative(SRC, file)
    const rules = parseRules(css)
    const reduced = rules.filter(isReducedTransparency)
    if (!reduced.some((r) => r.decls.get('backdrop-filter') === 'none')) {
      offenders.push(`${rel}: no prefers-reduced-transparency block sets backdrop-filter: none`)
    }
    for (const r of reduced) {
      const value = r.decls.get('backdrop-filter')
      if (value !== undefined && value !== 'none') offenders.push(`${rel}: ${r.selectors.join(', ')} keeps backdrop-filter: ${value}`)
    }
  }
  expect(offenders, 'add @media (prefers-reduced-transparency: reduce) { ... backdrop-filter: none } to each file').toEqual([])
})

it('ACC-2: tokens.css has a prefers-contrast: more block for the light and for the dark appearance', () => {
  const rules = parseRules(stripComments(readFileSync(TOKENS, 'utf8')))
  const contrast = rules.filter(isContrastMore)
  for (const appearance of ['light', 'dark'] as const) {
    expect(
      contrast.some((r) => appearanceOf(r) === appearance),
      `missing @media (prefers-contrast: more) block for the ${appearance} appearance`,
    ).toBe(true)
  }
})

for (const appearance of ['light', 'dark'] as const) {
  it(`ACC-2: under prefers-contrast: more the ${appearance} appearance reaches 7:1 for secondary text and 3:1 for lines on --ink-2`, () => {
    const rules = parseRules(stripComments(readFileSync(TOKENS, 'utf8')))
    const lookup = tokenLookup(rules, appearance)
    const colour = (name: string) => {
      const raw = lookup(name)
      if (raw === undefined) throw new Error(`token ${name} is not defined for the ${appearance} appearance`)
      return parseColor(resolveValue(raw, lookup))
    }
    const surface = colour('--ink-2')
    const surfaceRgb = composite(surface, surface)
    for (const text of ['--fg-2', '--fg-3']) {
      const ratio = contrastRatio(composite(colour(text), surface), surfaceRgb)
      expect(ratio, `${appearance} ${text} on --ink-2`).toBeGreaterThanOrEqual(7)
    }
    for (const line of ['--line-1', '--line-2', '--line-3']) {
      const ratio = contrastRatio(composite(colour(line), surface), surfaceRgb)
      expect(ratio, `${appearance} ${line} over --ink-2`).toBeGreaterThanOrEqual(3)
    }
  })
}

it('ACC-3: no stylesheet sets a literal font-size below 10 px', () => {
  const offenders: string[] = []
  for (const file of files(SRC, ['.css']).sort()) {
    const css = stripComments(readFileSync(file, 'utf8'))
    for (const m of css.matchAll(/font-size\s*:\s*([^;{}]+)/g)) {
      const px = toPx(m[1])
      if (px !== undefined && px < 10) offenders.push(`${relative(SRC, file)}: font-size: ${m[1].trim()}`)
    }
  }
  expect(offenders, 'use --fs-3xs (10 px) or larger').toEqual([])
})

it('ACC-3: tokens.css defines no --fs-* token below 10 px', () => {
  const rules = parseRules(stripComments(readFileSync(TOKENS, 'utf8')))
  const offenders: string[] = []
  for (const rule of rules) {
    for (const [name, value] of rule.decls) {
      if (!name.startsWith('--fs-')) continue
      const px = toPx(value)
      if (px !== undefined && px < 10) offenders.push(`${name}: ${value}`)
    }
  }
  expect(offenders).toEqual([])
})

it('ACC-3: var(--fs-4xs) is retired and used nowhere under web/src', () => {
  const offenders = files(SRC, ['.css', '.ts', '.tsx'])
    .filter((file) => file !== SELF)
    .filter((file) => readFileSync(file, 'utf8').includes('var(--fs-4xs)'))
    .map((file) => relative(SRC, file))
  expect(offenders).toEqual([])
})

describe('ACC-4: font-size 3xs ratchet', () => {
  const current: Record<string, number> = {}
  for (const file of files(SRC, ['.css']).sort()) {
    const rel = relative(SRC, file)
    if (rel.startsWith('board/') || rel.startsWith('game/')) continue
    const n = (stripComments(readFileSync(file, 'utf8')).match(/var\(--fs-3xs\)/g) ?? []).length
    if (n > 0) current[rel] = n
  }

  if (process.env.UPDATE_ACC_BASELINE === '1') {
    it('ACC-4: writes the baseline', () => {
      writeFileSync(BASELINE, JSON.stringify(current, null, 2) + '\n')
    })
    return
  }

  it('ACC-4: stylesheets outside board/ and game/ do not add var(--fs-3xs) beyond the baseline', () => {
    const baseline: Record<string, number> = existsSync(BASELINE) ? JSON.parse(readFileSync(BASELINE, 'utf8')) : {}
    const regressions: string[] = []
    const stale: string[] = []
    for (const file of new Set([...Object.keys(current), ...Object.keys(baseline)])) {
      const now = current[file] ?? 0
      const allowed = baseline[file] ?? 0
      if (now > allowed) regressions.push(`${file}: ${now} > ${allowed}`)
      if (now < allowed) stale.push(`${file}: ${now} < ${allowed}`)
    }
    expect(regressions, 'use --fs-2xs (11 px) instead of --fs-3xs outside the battlefield').toEqual([])
    expect(stale, 'a count shrank: run UPDATE_ACC_BASELINE=1 to record it').toEqual([])
  })
})

it('ACC-5: primitives.css gives every .ui-icon-btn a 28 px hit area on a coarse pointer', () => {
  const rules = parseRules(stripComments(readFileSync(PRIMITIVES, 'utf8')))
  const coarse = rules.filter((r) => r.media.some((m) => /\(\s*pointer:\s*coarse\s*\)/.test(m)))
  expect(coarse.some((r) => r.selectors.some((s) => s.includes('.ui-icon-btn'))), 'no @media (pointer: coarse) rule targets .ui-icon-btn').toBe(true)
  expect(hitSize(rules, '.ui-icon-btn'), '.ui-icon-btn hit area on a coarse pointer').toBeGreaterThanOrEqual(28)
})

it('ACC-5: the primary icon button reaches a 44 px hit area on a coarse pointer', () => {
  const rules = parseRules(stripComments(readFileSync(PRIMITIVES, 'utf8')))
  expect(hitSize(rules, '.ui-icon-btn--primary'), '.ui-icon-btn--primary hit area on a coarse pointer').toBeGreaterThanOrEqual(44)
})

it('ACC-6: the .app-attribution footer offsets its bottom edge by the safe-area inset', () => {
  const rules = parseRules(stripComments(readFileSync(STYLES, 'utf8')))
  const footer = rules.filter((r) => r.selectors.includes('.app-attribution'))
  expect(
    footer.some((r) => (r.decls.get('bottom') ?? '').includes('env(safe-area-inset-bottom')),
    '.app-attribution bottom must include env(safe-area-inset-bottom',
  ).toBe(true)
})

it('ACC-8: index.html links an apple-touch-icon that is a 180 px PNG under web/public', () => {
  const html = readFileSync(INDEX_HTML, 'utf8')
  const link = (html.match(/<link\b[^>]*>/gi) ?? []).find((t) => attr(t, 'rel') === 'apple-touch-icon')
  expect(link, 'missing <link rel="apple-touch-icon">').toBeDefined()
  const href = attr(link!, 'href') ?? ''
  const path = join(PUBLIC, href)
  expect(existsSync(path), `apple-touch-icon file ${href} under web/public`).toBe(true)
  expect(pngSize(path)).toEqual([180, 180])
})

it('ACC-8: index.html declares a theme-color for the light and for the dark appearance', () => {
  const html = readFileSync(INDEX_HTML, 'utf8')
  const metas = (html.match(/<meta\b[^>]*>/gi) ?? []).filter((t) => attr(t, 'name') === 'theme-color')
  for (const scheme of ['light', 'dark']) {
    const meta = metas.find((t) => (attr(t, 'media') ?? '').includes(`prefers-color-scheme: ${scheme}`))
    expect(meta, `missing <meta name="theme-color" media="(prefers-color-scheme: ${scheme})">`).toBeDefined()
    expect(attr(meta!, 'content') ?? '').not.toBe('')
  }
})

it('ACC-8: index.html links a web app manifest with a name and icons', () => {
  const html = readFileSync(INDEX_HTML, 'utf8')
  const link = (html.match(/<link\b[^>]*>/gi) ?? []).find((t) => attr(t, 'rel') === 'manifest')
  expect(link, 'missing <link rel="manifest">').toBeDefined()
  const href = attr(link!, 'href') ?? ''
  const path = join(PUBLIC, href)
  expect(existsSync(path), `manifest file ${href} under web/public`).toBe(true)
  const manifest = JSON.parse(readFileSync(path, 'utf8'))
  expect(typeof manifest.name === 'string' && manifest.name.length > 0).toBe(true)
  expect(Array.isArray(manifest.icons)).toBe(true)
  for (const icon of manifest.icons as { src: string }[]) {
    expect(existsSync(join(PUBLIC, icon.src)), `manifest icon ${icon.src}`).toBe(true)
  }
})
