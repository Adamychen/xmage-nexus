// @vitest-environment node
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const css = readFileSync(fileURLToPath(new URL('./CardSlot.css', import.meta.url)), 'utf8')
const auraCss = readFileSync(fileURLToPath(new URL('./KeywordAura.css', import.meta.url)), 'utf8')

function rulesFor(source: string, selector: string): string[] {
  const stripped = source.replace(/\/\*[\s\S]*?\*\//g, '')
  return [...stripped.matchAll(/([^{}]+)\{([^{}]*)\}/g)]
    .filter((m) => m[1].split(',').map((s) => s.trim()).includes(selector))
    .map((m) => m[2])
}

function zIndexOf(source: string, selector: string): number {
  const values = rulesFor(source, selector)
    .map((body) => /z-index:\s*(-?\d+)/.exec(body)?.[1])
    .filter((v): v is string => v !== undefined)
    .map(Number)
  if (values.length === 0) throw new Error(`no z-index for ${selector}`)
  return values[values.length - 1]
}

describe('CardSlot.css stacking', () => {
  it('isolates each card so its aura and badges cannot paint over the next stacked card', () => {
    expect(rulesFor(css, '.card-slot').some((body) => /isolation:\s*isolate/.test(body))).toBe(true)
  })

  it('keeps the hovered card rising above its neighbours on the card itself', () => {
    expect(rulesFor(css, '.card-slot.clickable:hover').some((body) => /z-index:\s*20/.test(body))).toBe(true)
  })

  it('draws the P/T, loyalty and defense badges above the keyword aura and its flare', () => {
    const aura = zIndexOf(auraCss, '.kw-aura')
    const flare = zIndexOf(auraCss, '.kw-aura-flare')
    for (const badge of ['.pt-badge', '.loyalty-badge', '.defense-badge']) {
      expect(zIndexOf(css, badge), badge).toBeGreaterThan(Math.max(aura, flare))
    }
  })
})
