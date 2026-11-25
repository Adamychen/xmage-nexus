// @vitest-environment node
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const css = readFileSync(fileURLToPath(new URL('./ArenaBoard.css', import.meta.url)), 'utf8')
  .replace(/\/\*[\s\S]*?\*\//g, '')

/** Every declaration written for one selector, in source order. */
function blocks(selector: string): string[] {
  const out: string[] = []
  for (const m of css.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    if (m[1].split(',').some((part) => part.trim() === selector)) out.push(m[2])
  }
  return out
}

describe('the own pool in the bottom row', () => {
  it('MNA-12: the pool has a line of its own above everything else in the row', () => {
    const pool = blocks('.arena-own-row > .arena-own-pool').join('\n')
    expect(pool, 'the pool slot has rules of its own').not.toBe('')
    // A full-width item wraps the rest of the row onto the next line; a negative order keeps it first.
    expect(pool).toMatch(/flex:\s*0 0 100%/)
    expect(pool).toMatch(/order:\s*-1/)
    // Floating it over the row is what put the pips on the pile captions.
    expect(pool).not.toMatch(/position:\s*absolute/)
  })

  it('MNA-12: both lines hug the bottom of the row, so the free strip is the one above the pips', () => {
    const row = blocks('.arena-own-row').concat(blocks('.board-zone.arena-own > .arena-own-row')).join('\n')
    expect(row).toMatch(/flex-wrap:\s*wrap/)
    expect(row).toMatch(/align-content:\s*flex-end/)
    expect(row).toMatch(/align-items:\s*flex-end/)
  })
})

describe("an opponent's hand in the bottom row", () => {
  it('BRD-38: the fan is drawn whole wherever that row is, panel copy included', () => {
    const fan = blocks('.arena-own-row > .arena-opp-hand .hand-back-stack.is-fan').join('\n')
    expect(fan, 'the fan has a rule of its own').not.toBe('')
    expect(fan).toMatch(/height:\s*calc\(var\(--card-w[^)]*\)\s*\*\s*1\.4\)/)
    expect(fan).toMatch(/overflow:\s*visible/)
    // No selector may tuck it back: a copy in the panel is a miniature of the main area.
    expect(css).not.toMatch(/\.arena-opp-hand[^{]*\.is-fan[^{]*\{[^}]*overflow:\s*hidden/)
  })
})
