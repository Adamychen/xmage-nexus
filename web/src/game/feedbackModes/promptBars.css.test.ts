// @vitest-environment node
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const css = readFileSync(fileURLToPath(new URL('./promptBars.css', import.meta.url)), 'utf8').replace(/\r\n/g, '\n')

function body(selector: string): string {
  const at = css.indexOf(`\n${selector} {`)
  expect(at, `promptBars.css has no block for ${selector}`).toBeGreaterThan(-1)
  const open = css.indexOf('{', at)
  return css.slice(open + 1, css.indexOf('}', open))
}

describe('the two answers in the prompt corner', () => {
  it('PRM-19: a long label wraps inside its button instead of running out of it', () => {
    const decls = body('.action-prompt-actions button')
    expect(decls, 'the label wraps').toMatch(/white-space:\s*normal/)
    expect(decls, 'and a word longer than the button breaks rather than overflow').toMatch(/overflow-wrap:\s*anywhere/)
    expect(decls).not.toMatch(/white-space:\s*nowrap/)
  })
})
