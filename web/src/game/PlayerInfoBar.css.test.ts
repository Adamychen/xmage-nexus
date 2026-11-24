// @vitest-environment node
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const css = readFileSync(fileURLToPath(new URL('./PlayerInfoBar.css', import.meta.url)), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '')

/** The body of the block whose selector list is exactly this one. */
function block(selector: string): string {
  for (const m of css.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    const list = m[1]
      .split(',')
      .map((one) => one.trim())
      .filter(Boolean)
      .join(', ')
    if (list === selector) return m[2]
  }
  return ''
}

describe("a player's counters", () => {
  it('BRD-54: the counter reads at the small interface size, not the smallest one', () => {
    expect(block('.player-counter-badge')).toMatch(/font-size:\s*var\(--fs-xs\)/)
  })

  it('BRD-54: a counter that changes lights itself, it does not flash a box', () => {
    const changed = block('.player-counter-badge.counter-badge-changed, .player-badges .badge-speed.counter-badge-changed')
    expect(changed, 'the changed state has a rule').not.toBe('')
    expect(changed).not.toMatch(/box-shadow|background|border(?!-radius)/)
    expect(changed).toMatch(/drop-shadow/)
  })

  it('BRD-54: the wave it sends out is a round halo, with no border to draw a rectangle', () => {
    const ring = block('.player-counter-badge .counter-change-ring, .player-badges .badge-speed .counter-change-ring')
    expect(ring, 'the ring has a rule').not.toBe('')
    expect(ring).toMatch(/border-radius:\s*var\(--r-pill\)/)
    expect(ring).toMatch(/border:\s*0/)
    expect(ring).not.toMatch(/border:\s*\d+px solid/)
  })
})
