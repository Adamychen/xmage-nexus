// @vitest-environment node
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const css = readFileSync(fileURLToPath(new URL('./handCommander.css', import.meta.url)), 'utf8')
  .replace(/\/\*[\s\S]*?\*\//g, '')

/** The declaration block of one selector, as written. */
function block(selector: string): string {
  for (const m of css.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    if (m[1].trim() === selector) return m[2]
  }
  return ''
}

describe('the commander of a hand drawn as a zone', () => {
  it('BRD-34: a watched seat and a panel copy read it as the top half of a bigger card', () => {
    const slot = block('.hand-zone > .hand-zone-commander')
    expect(slot, 'the zone commander has a rule of its own').not.toBe('')
    expect(slot).toMatch(/--cmd-w:\s*calc\(var\(--card-w[^)]*\)[^)]*\)\s*\*\s*1\.[0-9]+\)/)
    expect(slot).toMatch(/height:\s*calc\(var\(--cmd-w\)\s*\*\s*88\s*\/\s*63\s*\*\s*0\.5\)/)
    expect(slot).toMatch(/width:\s*var\(--cmd-w\)/)
  })

  it('BRD-34: the card keeps its height in that box and is clipped at the waist', () => {
    const card = block('.hand-zone > .hand-zone-commander .hand-trailing-card')
    expect(card).toMatch(/height:\s*calc\(var\(--cmd-w\)\s*\*\s*88\s*\/\s*63\)/)
    expect(card).toMatch(/clip-path:\s*inset\(0 0 50% 0/)
    expect(card).toMatch(/inset:\s*0 0 auto 0/)
  })
})
