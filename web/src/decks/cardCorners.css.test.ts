// @vitest-environment node
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const read = (rel: string) => readFileSync(fileURLToPath(new URL(rel, import.meta.url)), 'utf8')

const tokens = read('../ui/tokens.css')

/** Every place in the deck screens that draws a whole card picture, by the block that shapes it. */
const CARD_SHAPED: { file: string; selector: string }[] = [
  { file: 'ArenaCardGrid.css', selector: '.arena-grid-card-img-wrapper' },
  { file: 'CardFocusPanel.css', selector: '.card-focus-image,\n.card-focus-placeholder' },
  { file: 'CardPrintingsModal.css', selector: '.printing-img-wrap' },
  { file: 'DeckHoverPreview.css', selector: '.arena-floating-preview .preview-face-card' },
  { file: 'SampleHandModal.css', selector: '.sample-hand-preview-dock' },
]

function block(file: string, selector: string): string {
  const css = read(`./${file}`)
  // Anchored at the start of a line, so a longer selector that ends in the same text is not taken
  // for this one: `.arena-grid-card:hover .arena-grid-card-img-wrapper` is not the wrapper's block.
  const at = css.indexOf(`\n${selector} {`)
  expect(at, `${file} has no block for ${selector}`).toBeGreaterThan(-1)
  const open = css.indexOf('{', at)
  const close = css.indexOf('}', open)
  return css.slice(open + 1, close)
}

describe('a card picture keeps the corner it was printed with', () => {
  it('DCK-33: the share the board rounds a card by is a token, not a number repeated by hand', () => {
    const value = /--r-card:\s*([^;]+);/.exec(tokens)?.[1].trim()
    expect(value, 'tokens.css defines --r-card').toBeDefined()
    expect(value, 'it is a share of the picture on both axes, not a length').toMatch(/^\d+(\.\d+)?%\s*\/\s*\d+(\.\d+)?%$/)
  })

  it.each(CARD_SHAPED)('DCK-33: $file rounds $selector by that share', ({ file, selector }) => {
    const body = block(file, selector)
    expect(body, 'it rounds the picture').toMatch(/border-radius:\s*var\(--r-card\)/)
    expect(body, 'and not by a length, which misses the printed corner at every size but one').not.toMatch(
      /border-radius:\s*(var\(--r-(2xs|xs|sm|base|md|mid|lg|xl)\)|\d)/,
    )
  })

  it('DCK-33: the picture is not inset by a border, which would clip the wrapper and not the card', () => {
    const body = block('ArenaCardGrid.css', '.arena-grid-card-img-wrapper')
    expect(body).toMatch(/border:\s*0/)
    expect(body, 'the ring is drawn over the picture').toMatch(/box-shadow:[^;]*inset 0 0 0 1px/)
  })
})
