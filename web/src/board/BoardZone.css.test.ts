// @vitest-environment node
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const strip = (css: string) => css.replace(/\/\*[\s\S]*?\*\//g, '')
const zone = strip(readFileSync(fileURLToPath(new URL('./BoardZone.css', import.meta.url)), 'utf8'))
const arena = strip(readFileSync(fileURLToPath(new URL('./ArenaBoard.css', import.meta.url)), 'utf8'))

/** Every declaration block whose selector list mentions a band of the board. */
function bandBlocks(css: string): Array<{ selector: string; body: string }> {
  const blocks: Array<{ selector: string; body: string }> = []
  for (const m of css.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    const selector = m[1].trim()
    if (!/\.(bz|oz|pz)-band|\.(bz|oz|pz)-marquee/.test(selector)) continue
    blocks.push({ selector, body: m[2] })
  }
  return blocks
}

function declarations(body: string): Array<[string, string]> {
  return body
    .split(';')
    .map((line) => line.split(':'))
    .filter((parts) => parts.length >= 2)
    .map((parts) => [parts[0].trim(), parts.slice(1).join(':').trim()] as [string, string])
}

/** A declaration that puts ink on the band itself: a fill, a visible edge or a shadow. */
function paints([prop, value]: [string, string]): boolean {
  const paintable = /^(background|background-color|background-image|box-shadow|border|border-(top|right|bottom|left)(-[a-z]+)?)$/
  if (!paintable.test(prop)) return false
  if (/^(none|0|transparent)$/.test(value)) return false
  return !value.includes('transparent')
}

describe('the bands a board lays its cards in', () => {
  it('BRD-60: no band paints a box, a tint or a halo of its own', () => {
    const offenders = bandBlocks(zone)
      .filter(({ body }) => declarations(body).some(paints))
      .map(({ selector }) => selector)
    expect(offenders).toEqual([])
  })

  it('BRD-60: an empty band draws nothing at all', () => {
    const empty = [...zone.matchAll(/([^{}]*:empty[^{}]*)\{([^{}]*)\}/g)]
      .filter(([, selector]) => /-band/.test(selector))
      .filter(([, , body]) => declarations(body).some(paints))
      .map(([, selector]) => selector.trim())
    expect(empty).toEqual([])
  })
})

describe('the planeswalker zone of the own Arena board', () => {
  it('BRD-33: a zone of a single line stands in the middle of the height it was given', () => {
    const block = /\.bz-marquee-band:not\(\[data-band-lines\]\) \{([^}]*)\}/.exec(arena)?.[1] ?? ''
    expect(block, 'a one-line marquee band has a rule of its own').not.toBe('')
    expect(block).toMatch(/align-content:\s*center/)
    expect(block).toMatch(/align-items:\s*center/)
  })

  it('BRD-33: two lines or more still hang from the top', () => {
    const block = /\.board-zone\.arena-own \.bz-band\.bz-marquee-band \{([^}]*)\}/.exec(arena)?.[1] ?? ''
    expect(block).toMatch(/align-content:\s*flex-start/)
  })
})
