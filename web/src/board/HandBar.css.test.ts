// @vitest-environment node
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const css = readFileSync(fileURLToPath(new URL('./HandBar.css', import.meta.url)), 'utf8')
  .replace(/\/\*[\s\S]*?\*\//g, '')

/** The declaration block of one selector, as written. */
function block(selector: string): string {
  for (const m of css.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    if (m[1].trim() === selector) return m[2]
  }
  return ''
}

describe('the commander drawn with the fan', () => {
  it('BRD-34: the commander is a card wider than the hand\'s, on a box of half its height', () => {
    const slot = block('.hand-bar .hand-card-slot.hand-trailing')
    expect(slot, 'the trailing slot has a rule of its own').not.toBe('')
    // Wider than a hand card, and a box half the card's height: the piles' own shape (BRD-32).
    expect(slot).toMatch(/--cmd-w:\s*calc\(var\(--card-w[^)]*\)\s*\*\s*1\.[0-9]+\)/)
    expect(slot).toMatch(/height:\s*calc\(var\(--cmd-w\)\s*\*\s*88\s*\/\s*63\s*\*\s*0\.5\)/)
  })

  it('BRD-34: the card keeps its height inside that box and is clipped at the waist', () => {
    const card = block('.hand-bar .hand-card-slot.hand-trailing .hand-trailing-card')
    expect(card).toMatch(/height:\s*calc\(var\(--cmd-w\)\s*\*\s*88\s*\/\s*63\)/)
    expect(card).toMatch(/clip-path:\s*inset\(0 0 50% 0/)
    // Anchored to the top of the box, so what shows is the top half: the name and the art.
    expect(card).toMatch(/inset:\s*0 0 auto 0/)
  })
})
