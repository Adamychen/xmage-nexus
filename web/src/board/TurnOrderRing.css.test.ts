// @vitest-environment node
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const css = readFileSync(fileURLToPath(new URL('./TurnOrderRing.css', import.meta.url)), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '')

/** The bodies of every block whose selector list contains exactly this selector. */
function rulesFor(selector: string): string[] {
  return [...css.matchAll(/([^{}]+)\{([^{}]*)\}/g)]
    .filter((m) => m[1].split(',').map((one) => one.trim()).includes(selector))
    .map((m) => m[2])
}

describe('the turn order ring of a pod', () => {
  it('BRD-37: a seat name has no cap it could be cut at, and a seat cannot be squeezed under it', () => {
    expect(rulesFor('.turn-order-ring .tor-seat-name').join('\n')).toMatch(/max-width:\s*none/)
    expect(rulesFor('.turn-order-ring .tor-seat').join('\n')).toMatch(/min-width:\s*max-content/)
  })

  it('BRD-37: the tightened rung is declared once for the row and for the ruler that measures it', () => {
    const tight = [...css.matchAll(/([^{}]+)\{([^{}]*)\}/g)].find((m) => /data-ring-fit='tight'\] \.tor-seats-flow \.tor-seat\b/.test(m[1]))
    expect(tight, 'the row has a tight rule').toBeTruthy()
    const selectors = tight![1].split(',').map((one) => one.trim())
    expect(selectors, 'the ruler is tightened by the same rule, or it measures another row').toContain('.turn-order-ring .tor-measure.is-tight .tor-seat')
    expect(selectors.some((one) => one.includes("data-ring-fit='dots'")), 'the last rung keeps the tightening').toBe(true)
  })

  it('BRD-37: the last rung drops the names of the seats that are not playing, and only in the row', () => {
    const dots = [...css.matchAll(/([^{}]+)\{([^{}]*)\}/g)].filter((m) => /\.tor-seat:not\(\.is-active\) \.tor-seat-name/.test(m[1]))
    expect(dots.length, 'the rung has a rule').toBeGreaterThan(0)
    const selectors = dots.flatMap((m) => m[1].split(',').map((one) => one.trim()))
    expect(selectors.every((one) => one.includes('.tor-seats-flow')), 'the ruler keeps its names').toBe(true)
    expect(dots.map((m) => m[2]).join('\n')).toMatch(/display:\s*none/)
  })
})
