import { afterEach, describe, expect, it } from 'vitest'
import { isSpaceShortcutBlocked, isSpaceShortcutTargetIgnored, mouseFocusedGameControl } from './GameScreen'

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
  it('KEY-3: ignores native controls: button, select, input, textarea, links', () => {
    for (const tag of ['button', 'select', 'input', 'textarea', 'a']) {
      expect(isSpaceShortcutTargetIgnored(el(tag)), tag).toBe(true)
    }
  })

  it('KEY-3: ignores descendants of native controls (e.g. a span inside a button)', () => {
    const btn = el('button')
    const span = el('span', {}, btn)
    expect(isSpaceShortcutTargetIgnored(span)).toBe(true)
  })

  it('KEY-3: ignores ARIA interactive roles (button, menuitem, option) outside the game region', () => {
    for (const role of ['button', 'menuitem', 'option']) {
      expect(isSpaceShortcutTargetIgnored(el('div', { role })), role).toBe(true)
    }
  })

  it('KEY-2: lets Space through on ARIA buttons inside the game region (Space passes priority there)', () => {
    const region = el('div', { 'data-space-passes-priority': 'true' })
    for (const role of ['button', 'menuitem', 'option']) {
      expect(isSpaceShortcutTargetIgnored(el('div', { role }, region)), role).toBe(false)
    }
  })

  it('KEY-3: still ignores native controls inside the game region (no double action)', () => {
    const region = el('div', { 'data-space-passes-priority': 'true' })
    for (const tag of ['button', 'input', 'select', 'a']) {
      expect(isSpaceShortcutTargetIgnored(el(tag, {}, region)), tag).toBe(true)
    }
  })

  it('KEY-2: lets Space through on descendants of game-region ARIA controls (span inside a card)', () => {
    const region = el('div', { 'data-space-passes-priority': 'true' })
    const card = el('div', { role: 'button' }, region)
    const span = el('span', {}, card)
    expect(isSpaceShortcutTargetIgnored(span)).toBe(false)
  })

  it('KEY-1: allows Space on plain board surfaces (no double action there)', () => {
    expect(isSpaceShortcutTargetIgnored(el('div'))).toBe(false)
    expect(isSpaceShortcutTargetIgnored(document.body)).toBe(false)
    expect(isSpaceShortcutTargetIgnored(null)).toBe(false)
  })
})

describe('isSpaceShortcutBlocked (Space shortcut guard + open viewers)', () => {
  it('KEY-4: with no viewer open only the focus decides', () => {
    expect(isSpaceShortcutBlocked(document.body)).toBe(false)
    expect(isSpaceShortcutBlocked(el('div'))).toBe(false)
  })

  it('KEY-4: blocks Space while a viewer is open, even with focus on body or on a card in the region', () => {
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

describe('mouseFocusedGameControl (Space releases mouse-focused game controls)', () => {
  it('KEY-2: releases buttons and toggles inside the game screen (e.g. the log drawer toggle)', () => {
    const root = el('div')
    const toolbar = el('div', { role: 'toolbar' }, root)
    const logToggle = el('button', { 'aria-pressed': 'true' }, toolbar)
    const icon = el('span', {}, logToggle)
    expect(mouseFocusedGameControl(logToggle, root)).toBe(logToggle)
    expect(mouseFocusedGameControl(icon, root)).toBe(logToggle)
    const tab = el('div', { role: 'tab' }, root)
    expect(mouseFocusedGameControl(tab, root)).toBe(tab)
  })

  it('KEY-3: keeps text entry, dialogs and menus untouched', () => {
    const root = el('div')
    for (const tag of ['input', 'textarea', 'select']) {
      expect(mouseFocusedGameControl(el(tag, {}, root), root), tag).toBeNull()
    }
    const dialog = el('div', { role: 'dialog' }, root)
    expect(mouseFocusedGameControl(el('button', {}, dialog), root)).toBeNull()
    const menu = el('div', { role: 'menu' }, root)
    expect(mouseFocusedGameControl(el('button', {}, menu), root)).toBeNull()
  })

  it('KEY-2: ignores controls outside the game screen and plain surfaces', () => {
    const root = el('div')
    expect(mouseFocusedGameControl(el('button'), root)).toBeNull()
    expect(mouseFocusedGameControl(el('div', {}, root), root)).toBeNull()
    expect(mouseFocusedGameControl(document.body, root)).toBeNull()
    expect(mouseFocusedGameControl(el('button', {}, root), null)).toBeNull()
  })
})
