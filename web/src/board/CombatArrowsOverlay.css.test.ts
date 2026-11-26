// @vitest-environment node
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const read = (rel: string) => readFileSync(fileURLToPath(new URL(rel, import.meta.url)), 'utf8')

function layerOf(css: string, selector: string): number {
  const at = css.indexOf(`${selector} {`)
  expect(at, `no block for ${selector}`).toBeGreaterThan(-1)
  const body = css.slice(at, css.indexOf('}', at))
  const z = /z-index:\s*(\d+)/.exec(body)?.[1]
  expect(z, `${selector} declares a layer`).toBeDefined()
  return Number(z)
}

describe('TGT-10: where the arrow layer sits', () => {
  it('TGT-10: over the stack cascade, under the chat and log panel the player reads', () => {
    const arrows = layerOf(read('./CombatArrowsOverlay.css'), '.combat-arrows-overlay')
    const panel = layerOf(read('../game/ChatLogPanel.css'), '.chatlog-panel')
    const cascade = layerOf(read('./StackZone.css'), '.stack-zone')
    expect(arrows, 'an arrow is drawn over the stack it points at').toBeGreaterThan(cascade)
    expect(arrows, 'and under the chat the player is reading').toBeLessThan(panel)
  })
})
