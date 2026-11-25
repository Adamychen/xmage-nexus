// @vitest-environment node
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const css = readFileSync(fileURLToPath(new URL('./CardSlot.css', import.meta.url)), 'utf8')
const auraCss = readFileSync(fileURLToPath(new URL('./KeywordAura.css', import.meta.url)), 'utf8')
const coinCss = readFileSync(fileURLToPath(new URL('./KeywordCoin.css', import.meta.url)), 'utf8')

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

describe('the commander coin on a permanent', () => {
  const mark = () => rulesFor(css, '.card-commander-mark').join('\n')

  it('BRD-59: it is a coin of a keyword badge’s size, on the row that column starts on', () => {
    expect(mark()).toMatch(/width:\s*var\(--badge-size\)/)
    expect(mark()).toMatch(/height:\s*var\(--badge-size\)/)
    const row = /top:\s*([^;]+);/.exec(rulesFor(css, '.keyword-badges').join('\n'))?.[1].trim()
    expect(row, 'the keyword column declares the row it starts on').toBeTruthy()
    expect(mark()).toContain(`max(${row},`)
  })

  it('BRD-59: the symbol fills the coin as a keyword’s art fills its own, in the gold of the ring', () => {
    const art = rulesFor(css, '.card-commander-mark .commander-mark').join('\n')
    const kwFill = /width:\s*([\d.]+%)/.exec(rulesFor(coinCss, '.kw-coin .kw-art').join('\n'))?.[1]
    expect(kwFill, 'a keyword coin declares how much of it its art fills').toBeTruthy()
    expect(art).toContain(`width: ${kwFill}`)
    expect(art).toContain(`height: ${kwFill}`)
    const gold = /fill:\s*(var\(--gold-\d+\))/.exec(art)?.[1]
    expect(gold, 'the symbol is painted in a gold of the palette').toBeTruthy()
    expect(mark()).toContain(`solid ${gold}`)
  })
})

describe('what a card slot animates', () => {
  const boardZoneCss = readFileSync(fileURLToPath(new URL('./BoardZone.css', import.meta.url)), 'utf8')

  const transitionsOf = (source: string): Array<{ selector: string; value: string }> => {
    const stripped = source.replace(/\/\*[\s\S]*?\*\//g, '')
    const out: Array<{ selector: string; value: string }> = []
    for (const rule of stripped.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
      const selectors = rule[1].split(',').map((s) => s.trim())
      if (!selectors.some((s) => /\.card-slot\b/.test(s))) continue
      for (const decl of rule[2].matchAll(/transition:\s*([^;]+);/g)) {
        out.push({ selector: selectors.join(', '), value: decl[1].replace(/\s+/g, ' ') })
      }
    }
    return out
  }

  it('BRD-66: no card slot animates its margins, so a card size change never draws the row at the old size', () => {
    const lists = [...transitionsOf(css), ...transitionsOf(boardZoneCss)]
    expect(lists.length, 'a card slot declares what it animates').toBeGreaterThan(0)
    for (const { selector, value } of lists) {
      expect(value, `${selector} animates margin`).not.toMatch(/(^|[\s,])margin\b/)
    }
  })

  it('BRD-66: a pile still animates `left`, which fans it open without moving its footprint', () => {
    const pile = transitionsOf(boardZoneCss).find((t) => t.selector.includes('.stack-group > .card-slot'))
    expect(pile, 'the pile declares its own transition').toBeTruthy()
    expect(pile!.value).toMatch(/(^|[\s,])left\b/)
  })
})
