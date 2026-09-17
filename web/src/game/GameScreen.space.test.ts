import { afterEach, describe, expect, it } from 'vitest'
import { isSpaceShortcutBlocked, isSpaceShortcutTargetIgnored } from './GameScreen'

function el(tag: string, attrs: Record<string, string> = {}, parent?: HTMLElement): HTMLElement {
  const node = document.createElement(tag)
  for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, v)
  ;(parent ?? document.body).appendChild(node)
  return node
}

afterEach(() => {
  document.body.innerHTML = ''
})

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

  it('ignores ARIA interactive roles (button, menuitem, option) outside the game region', () => {
    for (const role of ['button', 'menuitem', 'option']) {
      expect(isSpaceShortcutTargetIgnored(el('div', { role })), role).toBe(true)
    }
  })

  it('lets Space through on ARIA buttons inside the game region (Space passes priority there)', () => {
    const region = el('div', { 'data-space-passes-priority': 'true' })
    for (const role of ['button', 'menuitem', 'option']) {
      expect(isSpaceShortcutTargetIgnored(el('div', { role }, region)), role).toBe(false)
    }
  })

  it('still ignores native controls inside the game region (no double action)', () => {
    const region = el('div', { 'data-space-passes-priority': 'true' })
    for (const tag of ['button', 'input', 'select', 'a']) {
      expect(isSpaceShortcutTargetIgnored(el(tag, {}, region)), tag).toBe(true)
    }
  })

  it('ignores descendants of game-region ARIA controls (span inside a card)', () => {
    const region = el('div', { 'data-space-passes-priority': 'true' })
    const card = el('div', { role: 'button' }, region)
    const span = el('span', {}, card)
    expect(isSpaceShortcutTargetIgnored(span)).toBe(false)
  })

  it('allows Space on plain board surfaces (no double action there)', () => {
    expect(isSpaceShortcutTargetIgnored(el('div'))).toBe(false)
    expect(isSpaceShortcutTargetIgnored(document.body)).toBe(false)
    expect(isSpaceShortcutTargetIgnored(null)).toBe(false)
  })
})

describe('isSpaceShortcutBlocked (Space shortcut guard + visores abiertos)', () => {
  it('sin overlays abiertos solo decide el foco', () => {
    expect(isSpaceShortcutBlocked(document.body)).toBe(false)
    expect(isSpaceShortcutBlocked(el('div'))).toBe(false)
  })

  it('bloquea Space con un visor abierto aunque el foco esté en body o en una carta de la región', () => {
    const region = el('div', { 'data-space-passes-priority': 'true' })
    const overlay = el('div', { 'data-space-shortcut-off': 'true' }, region)
    const card = el('div', { role: 'button' }, overlay)
    expect(isSpaceShortcutBlocked(document.body)).toBe(true)
    expect(isSpaceShortcutBlocked(el('div', {}, region))).toBe(true)
    expect(isSpaceShortcutBlocked(card)).toBe(true)
    overlay.remove()
    expect(isSpaceShortcutBlocked(document.body)).toBe(false)
  })
})
