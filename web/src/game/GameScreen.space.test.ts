import { describe, expect, it } from 'vitest'
import { isSpaceShortcutTargetIgnored } from './GameScreen'

function el(tag: string, attrs: Record<string, string> = {}, parent?: HTMLElement): HTMLElement {
  const node = document.createElement(tag)
  for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, v)
  ;(parent ?? document.body).appendChild(node)
  return node
}

describe('isSpaceShortcutTargetIgnored (Space shortcut guard)', () => {
  it('ignores native controls: button, select, input, textarea, links', () => {
    for (const tag of ['button', 'select', 'input', 'textarea', 'a']) {
      expect(isSpaceShortcutTargetIgnored(el(tag)), tag).toBe(true)
    }
  })

  it('ignores descendants of native controls (e.g. a span inside a button)', () => {
    const btn = el('button')
    const span = el('span', {}, btn)
    expect(isSpaceShortcutTargetIgnored(span)).toBe(true)
  })

  it('ignores ARIA interactive roles (button, menuitem, option)', () => {
    for (const role of ['button', 'menuitem', 'option']) {
      expect(isSpaceShortcutTargetIgnored(el('div', { role })), role).toBe(true)
    }
  })

  it('allows Space on plain board surfaces (no double action there)', () => {
    expect(isSpaceShortcutTargetIgnored(el('div'))).toBe(false)
    expect(isSpaceShortcutTargetIgnored(document.body)).toBe(false)
    expect(isSpaceShortcutTargetIgnored(null)).toBe(false)
  })
})
