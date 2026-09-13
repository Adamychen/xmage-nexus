import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

function css(path: string): string {
  return readFileSync(new URL(path, import.meta.url), 'utf8')
}

function block(source: string, selector: string): string {
  const match = source.match(new RegExp(`${selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*\\{([^}]*)\\}`))
  if (!match) throw new Error(`selector not found: ${selector}`)
  return match[1]
}

function fontSizeRem(decls: string): number {
  const match = decls.match(/font-size:\s*([\d.]+)rem/)
  if (!match) throw new Error(`no font-size in: ${decls.slice(0, 80)}`)
  return Number(match[1])
}

describe('a11y contrast minimums (C.15, inspection-backed)', () => {
  const stack = css('./board/StackZone.css')
  const slot = css('./board/CardSlot.css')
  const feed = css('./game/ActionFeedCard.css')

  it('stack timeline small text is >= 0.687rem', () => {
    for (const sel of ['.stack-tl-pos', '.stack-controller-pill', '.stack-tl-type-badge', '.stack-tl-subtype', '.stack-tl-copy-badge']) {
      expect(fontSizeRem(block(stack, sel)), sel).toBeGreaterThanOrEqual(0.687)
    }
  })

  it('stack timeline greys meet 4.5:1 on dark backgrounds', () => {
    expect(block(stack, '.stack-tl-pos')).toContain('#9ca3af')
    expect(block(stack, '.stack-tl-pos')).not.toContain('#6b7280')
    expect(block(stack, '.stack-tl-subtype')).toContain('#cbd5e1')
    expect(block(stack, '.stack-tl-subtype')).not.toContain('#94a3b8')
  })

  it('card icon / keyword badges are >= 0.687rem', () => {
    expect(fontSizeRem(block(slot, '.card-icon'))).toBeGreaterThanOrEqual(0.687)
    expect(fontSizeRem(block(slot, '.keyword-badge'))).toBeGreaterThanOrEqual(0.687)
    expect(fontSizeRem(block(slot, '.facedown-type-badge'))).toBeGreaterThanOrEqual(0.687)
    expect(fontSizeRem(block(slot, '.designation-badge'))).toBeGreaterThanOrEqual(0.687)
  })

  it('feed description keeps contrast over card art', () => {
    const decls = block(feed, '.action-desc-text')
    expect(decls).toContain('#cbd5e1')
    expect(decls).not.toContain('#94a3b8')
    expect(decls).toContain('text-shadow')
    expect(decls).toContain('background')
  })

  it('playable cards show the glow on keyboard focus too', () => {
    expect(slot).toContain('.card-slot.playable:focus-visible')
  })
})
