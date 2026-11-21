// @vitest-environment node
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const css = readFileSync(fileURLToPath(new URL('./StackZone.css', import.meta.url)), 'utf8')

/** Every declaration block whose selector list mentions a hovered or focused card on the stack. */
function hoverBlocks(): string[] {
  const blocks: string[] = []
  for (const m of css.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    const selector = m[1].trim()
    if (!/\.stack-card[^,{]*:(hover|focus-within|focus-visible)/.test(selector)) continue
    blocks.push(m[2])
  }
  return blocks
}

describe('the cascade under the pointer', () => {
  it('STK-5: the card under the pointer is not lifted, grown or turned', () => {
    const moving = /(^|[;\s])(transform|translate|scale|rotate|margin|inset|top|left|right|bottom|width|height|z-index)\s*:/
    const offenders = hoverBlocks().filter((body) => moving.test(body))
    expect(offenders).toEqual([])
  })

  it('STK-5: hovering is answered on the card itself, so its neighbours are not touched', () => {
    expect(hoverBlocks().length).toBeGreaterThan(0)
    const siblings = [...css.matchAll(/([^{}]+)\{[^{}]*\}/g)]
      .map((m) => m[1].trim())
      .filter((selector) => /\.stack-card:hover\s*[~+]/.test(selector))
    expect(siblings).toEqual([])
  })
})
