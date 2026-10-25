// @vitest-environment node
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, '')
}

interface Rule {
  prelude: string
  body: string
}

function parseRules(source: string): Rule[] {
  const text = stripComments(source)
  const rules: Rule[] = []
  let i = 0
  while (i < text.length) {
    const open = text.indexOf('{', i)
    if (open < 0) break
    const prelude = text.slice(i, open).split(/[;}]/).pop()!.replace(/\s+/g, ' ').trim()
    let depth = 1
    let j = open + 1
    while (j < text.length && depth > 0) {
      if (text[j] === '{') depth++
      else if (text[j] === '}') depth--
      j++
    }
    rules.push({ prelude, body: text.slice(open + 1, j - 1) })
    i = j
  }
  return rules
}

function declarations(body: string): Map<string, string> {
  const map = new Map<string, string>()
  for (const m of body.matchAll(/([\w-]+)\s*:\s*([^;]+);/g)) map.set(m[1], m[2].trim())
  return map
}

const sheet = parseRules(readFileSync(new URL('../ui/tokens.css', import.meta.url), 'utf8'))
const defaults = declarations(sheet.find((r) => r.prelude === ':root, .board-surface')!.body)
const moreDark = declarations(parseRules(sheet.find((r) => r.prelude === '@media (prefers-contrast: more)')!.body).find((r) => r.prelude === ':root, .board-surface')!.body)
const lightMedia = sheet.find((r) => r.prelude === '@media (prefers-color-scheme: light)')!
const light = declarations(parseRules(lightMedia.body).find((r) => r.prelude === ':root:not([data-appearance="dark"]), :root:not([data-appearance="dark"]) .chrome-surface')!.body)
const lightMore = declarations(parseRules(sheet.find((r) => r.prelude === '@media (prefers-color-scheme: light) and (prefers-contrast: more)')!.body).find((r) => r.prelude === ':root:not([data-appearance="dark"]), :root:not([data-appearance="dark"]) .chrome-surface')!.body)

type Appearance = 'dark' | 'light'

function effective(appearance: Appearance, more: boolean): Map<string, string> {
  const out = new Map<string, string>(defaults)
  if (more) for (const [k, v] of moreDark) out.set(k, v)
  if (appearance === 'light') {
    for (const [k, v] of light) out.set(k, v)
    if (more) for (const [k, v] of lightMore) out.set(k, v)
  }
  return out
}

interface RGBA {
  r: number
  g: number
  b: number
  a: number
}

function resolve(tokens: Map<string, string>, name: string): string {
  const value = tokens.get(name)
  if (value === undefined) throw new Error(`token not found: ${name}`)
  const ref = value.match(/^var\((--[\w-]+)\)$/)
  return ref ? resolve(tokens, ref[1]) : value
}

function parseColour(value: string): RGBA {
  const hex = value.match(/^#([0-9a-f]{6})$/i)
  if (hex) {
    const n = parseInt(hex[1], 16)
    return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255, a: 1 }
  }
  const fn = value.match(/^rgba?\((.*)\)$/)
  if (!fn) throw new Error(`unsupported colour: ${value}`)
  const parts = fn[1].split(/[\s,/]+/).filter(Boolean).map(Number)
  return { r: parts[0], g: parts[1], b: parts[2], a: parts[3] ?? 1 }
}

function colour(tokens: Map<string, string>, name: string): RGBA {
  return parseColour(resolve(tokens, name))
}

function opaque(c: RGBA, over: RGBA): RGBA {
  return { r: c.r * c.a + over.r * (1 - c.a), g: c.g * c.a + over.g * (1 - c.a), b: c.b * c.a + over.b * (1 - c.a), a: 1 }
}

function luminance(c: RGBA): number {
  const [r, g, b] = [c.r, c.g, c.b].map((v) => {
    const s = v / 255
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4
  })
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

function contrast(a: RGBA, b: RGBA): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x)
  return (hi + 0.05) / (lo + 0.05)
}

const SURFACES = ['--ink-0', '--ink-1', '--ink-2', '--ink-3', '--ink-4']
const TEXT = ['--fg-1', '--fg-2', '--fg-3', '--fg-hi', '--brand-fg', '--gold-300', '--purple-fg', '--ok', '--warn', '--err']
const BORDERS = ['--line-1', '--line-2', '--line-3']
const APPEARANCES: Appearance[] = ['dark', 'light']

describe('appearance: contrast from the token values', () => {
  it('APR-3: toggle track and knob reach 3:1 against their panel in both appearances', () => {
    for (const appearance of APPEARANCES) {
      const tokens = effective(appearance, false)
      for (const panel of ['--ink-3', '--ink-1']) {
        expect(contrast(colour(tokens, '--fg-3'), colour(tokens, panel)), `${appearance}: --fg-3 on ${panel}`).toBeGreaterThanOrEqual(3)
      }
    }
  })

  it("APR-3: the phase dial's past-step text reaches 4.5:1 on the dark chrome", () => {
    const tokens = effective('dark', false)
    expect(contrast(colour(tokens, '--dial-past'), colour(tokens, '--ink-1'))).toBeGreaterThanOrEqual(4.5)
  })

  for (const appearance of APPEARANCES) {
    it(`APR-3: ${appearance} text tokens reach 4.5:1 on every surface token`, () => {
      const tokens = effective(appearance, false)
      const failures: string[] = []
      for (const text of TEXT) {
        for (const surface of SURFACES) {
          const ratio = contrast(colour(tokens, text), colour(tokens, surface))
          if (ratio < 4.5) failures.push(`${text} on ${surface}: ${ratio.toFixed(2)}`)
        }
      }
      expect(failures).toEqual([])
    })

    it(`APR-3: ${appearance} large text reaches 3:1 on every surface token`, () => {
      const tokens = effective(appearance, false)
      for (const text of TEXT) {
        for (const surface of SURFACES) {
          expect(contrast(colour(tokens, text), colour(tokens, surface)), `${text} on ${surface}`).toBeGreaterThanOrEqual(3)
        }
      }
    })

    it(`APR-3: ${appearance} increased-contrast borders reach 3:1 when composited over --ink-2`, () => {
      const tokens = effective(appearance, true)
      const surface = colour(tokens, '--ink-2')
      for (const line of BORDERS) {
        const composite = opaque(colour(tokens, line), surface)
        expect(contrast(composite, surface), line).toBeGreaterThanOrEqual(3)
      }
    })

    it(`ACC-2: ${appearance} increased contrast raises the secondary text to 7:1 on --ink-2`, () => {
      const tokens = effective(appearance, true)
      const surface = colour(tokens, '--ink-2')
      for (const text of ['--fg-2', '--fg-3']) {
        expect(contrast(colour(tokens, text), surface), text).toBeGreaterThanOrEqual(7)
      }
    })

    it(`ACC-2: ${appearance} increased contrast raises the borders above the default`, () => {
      const more = effective(appearance, true)
      const base = effective(appearance, false)
      const surface = colour(base, '--ink-2')
      for (const line of BORDERS) {
        expect(contrast(opaque(colour(more, line), surface), surface), line).toBeGreaterThan(contrast(opaque(colour(base, line), surface), surface))
      }
    })
  }
})
