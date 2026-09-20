import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

function css(path: string): string {
  return readFileSync(new URL(path, import.meta.url), 'utf8')
}

function block(source: string, selector: string): string {
  const match = source.match(new RegExp(`${selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*\\{([^}]*)\\}`))
  if (!match) throw new Error(`selector not found: ${selector}`)
  return match[1]
}

const tokens = css('./ui/tokens.css')

function fontSizeRem(decls: string): number {
  const literal = decls.match(/font-size:\s*([\d.]+)rem/)
  if (literal) return Number(literal[1])
  const token = decls.match(/font-size:\s*var\((--fs-[\w-]+)\)/)
  const resolved = token && tokens.match(new RegExp(`${token[1]}:\\s*([\\d.]+)rem`))
  if (!resolved) throw new Error(`no font-size in: ${decls.slice(0, 80)}`)
  return Number(resolved[1])
}


function tokenValue(name: string): string {
  const match = tokens.match(new RegExp(`${name}:\\s*([^;]+);`))
  if (!match) throw new Error(`token not found: ${name}`)
  const value = match[1].trim()
  const ref = value.match(/^var\((--[\w-]+)\)$/)
  return ref ? tokenValue(ref[1]) : value
}

function colorOf(decls: string): string {
  const match = decls.match(/(?:^|[;\s])color:\s*([^;]+);?/)
  if (!match) throw new Error(`no color in: ${decls.slice(0, 80)}`)
  const value = match[1].trim()
  const ref = value.match(/^var\((--[\w-]+)\)$/)
  return ref ? tokenValue(ref[1]) : value
}

function luminance(hex: string): number {
  const h = hex.replace('#', '')
  const [r, g, b] = [0, 2, 4].map((i) => {
    const c = parseInt(h.slice(i, i + 2), 16) / 255
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
  })
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x)
  return (hi + 0.05) / (lo + 0.05)
}

describe('a11y contrast minimums (C.15, inspection-backed)', () => {
  const stack = css('./board/StackZone.css')
  const slot = css('./board/CardSlot.css')
  const feed = css('./game/ActionFeedCard.css')

  it('stack timeline small text is >= 0.687rem', () => {
    for (const sel of ['.stack-tl-pos', '.stack-controller-pill', '.stack-tl-type-badge', '.stack-tl-subtype', '.stack-tl-copy-badge']) {
      expect(fontSizeRem(block(stack, sel)), sel).toBeGreaterThanOrEqual(0.687)
    }
  })

  it('stack timeline greys meet 4.5:1 on dark backgrounds', () => {
    const lightestSurface = tokenValue('--ink-4')
    for (const sel of ['.stack-tl-pos', '.stack-tl-subtype']) {
      expect(contrast(colorOf(block(stack, sel)), lightestSurface), sel).toBeGreaterThanOrEqual(4.5)
    }
  })

  it('card icon / keyword badges are >= 0.687rem', () => {
    expect(fontSizeRem(block(slot, '.card-icon'))).toBeGreaterThanOrEqual(0.687)
    expect(fontSizeRem(block(slot, '.keyword-badge'))).toBeGreaterThanOrEqual(0.687)
    expect(fontSizeRem(block(slot, '.facedown-type-badge'))).toBeGreaterThanOrEqual(0.687)
    expect(fontSizeRem(block(slot, '.designation-badge'))).toBeGreaterThanOrEqual(0.687)
  })

  it('feed description keeps contrast over card art', () => {
    const decls = block(feed, '.action-desc-text')
    expect(contrast(colorOf(decls), tokenValue('--ink-4'))).toBeGreaterThanOrEqual(4.5)
    expect(decls).toContain('text-shadow')
    expect(decls).toContain('background')
  })

  it('playable cards show the glow on keyboard focus too', () => {
    expect(slot).toContain('.card-slot.playable:focus-visible')
  })
})
