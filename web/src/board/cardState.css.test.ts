// @vitest-environment node
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const read = (rel: string) => readFileSync(fileURLToPath(new URL(rel, import.meta.url)), 'utf8').replace(/\r\n/g, '\n')

const slot = read('./CardSlot.css')
const auras = read('./KeywordAura.css')
const band = read('./BoardZone.css')
const zones = read('./targetZone.css')
const chip = read('../game/PlayerInfoBar.css')
const inspector = read('./CardInspector.css')

/** The declarations of one rule, found by the line its selector starts on. */
function block(css: string, selector: string): string {
  const at = css.indexOf(`\n${selector} {`)
  expect(at, `no block for ${selector}`).toBeGreaterThan(-1)
  const open = css.indexOf('{', at)
  return css.slice(open + 1, css.indexOf('}', open))
}

/** Every `box-shadow` a card in a state carries. */
function stateShadows(): string[] {
  return [...slot.matchAll(/\.card-slot\[data-state[^{]*\{([^}]*)\}/g)]
    .flatMap((m) => [...m[1].matchAll(/box-shadow:([^;]+);/g)].map((d) => d[1].trim()))
}

describe('BRD-70: the state of a card is marked outside it, and only outside', () => {
  it('BRD-70: the three states are three colours, one declared per state', () => {
    expect(block(slot, ".card-slot[data-state='playable']")).toContain('--slot-ring: var(--ok)')
    expect(block(slot, ".card-slot[data-state='target']")).toContain('--slot-ring: var(--gold-500)')
    expect(block(slot, ".card-slot[data-state='chosen']")).toContain('--slot-ring: var(--err)')
  })

  it('BRD-70: a state never paints inside the card, which is where the keyword auras live', () => {
    const shadows = stateShadows()
    expect(shadows.length).toBeGreaterThan(0)
    for (const shadow of shadows) expect(shadow, 'a state shadow must not be inset').not.toContain('inset')
    // The auras are the ones that paint inwards, and two of them use these very colours.
    expect(auras).toContain('inset 0 0 0 2px rgb(var(--ok-rgb)')
    expect(auras).toContain('inset 0 0 0 2px rgb(var(--gold-rgb)')
  })

  it('BRD-70: the glow stays inside the room the bands keep, so nothing cuts it', () => {
    expect(block(band, '.bz-band,\n.pz-band,\n.oz-band')).toContain('padding: var(--sp-1h)')
    for (const shadow of stateShadows()) {
      const blur = Number(/0 0 (\d+)px/.exec(shadow)?.[1] ?? 99)
      expect(blur, `a state glow of ${blur}px does not fit the band`).toBeLessThanOrEqual(12)
    }
  })

  it('BRD-70: a seat you can aim at is marked on its photo, not with a box', () => {
    const bar = block(chip, '.player-info-bar.targetable')
    expect(bar, 'the chip draws no frame of its own').not.toContain('border-color')
    expect(bar, 'and no box around the whole chip').not.toContain('box-shadow')
    expect(bar).toContain('cursor: pointer')
    expect(block(chip, '.player-info-bar.targetable .avatar-image')).toContain('var(--gold-500)')
    expect(chip, 'the three-beat pulse is gone').not.toContain('playerTargetPulse')
  })

  it('CRD-4: nothing of the flat slot is painted under the printed shield', () => {
    // The three backgrounds sit after the shield's own block in the file, so without the
    // `:not(.has-plate)` they win on source order and draw a square behind every shield.
    for (const sign of ['is-plus', 'is-zero', 'is-minus']) {
      const rule = inspector.indexOf(`.card-inspector-cost:not(.has-plate).${sign}`)
      expect(rule, `${sign} keeps the flat slot to itself`).toBeGreaterThan(-1)
      expect(inspector).not.toContain(`.card-inspector-cost.${sign} {`)
    }
  })

  it('BRD-70: the battlefield rows no longer paint themselves', () => {
    expect(zones).not.toContain('.bz-row.target-zone')
    // The zones you cannot see into keep their ring.
    expect(zones).toContain('.hand-zone.target-zone')
    expect(zones).toContain('.resource-stack.target-zone::after')
  })
})
