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

describe('the text of the object in front', () => {
  it('STK-7: the rules plate is sized from the card and is not clamped to a line count', () => {
    const block = /\.stack-card\.is-top \.stack-tl-rules \{([^}]*)\}/.exec(css)?.[1] ?? ''
    expect(block, 'the front card has a plate of its own').not.toBe('')
    expect(block, 'its type follows the card width').toMatch(/font-size:\s*clamp\([^)]*var\(--card-w/)
    expect(block).not.toMatch(/line-clamp|-webkit-box/)
    expect(css, 'no clamp rule is left anywhere for it').not.toMatch(/stack-tl-rules[^{]*\{[^}]*line-clamp/)
  })
})
