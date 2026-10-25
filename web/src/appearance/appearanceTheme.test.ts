// @vitest-environment node
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

function read(path: string): string {
  return readFileSync(new URL(path, import.meta.url), 'utf8')
}

function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, '')
}

interface Rule {
  prelude: string
  body: string
}

function parseRules(source: string): Rule[] {
  const text = stripComments(source)
  const rules: Rule[] = []
  let i = 0
  while (i < text.length) {
    const open = text.indexOf('{', i)
    if (open < 0) break
    const prelude = text.slice(i, open).split(/[;}]/).pop()!.replace(/\s+/g, ' ').trim()
    let depth = 1
    let j = open + 1
    while (j < text.length && depth > 0) {
      if (text[j] === '{') depth++
      else if (text[j] === '}') depth--
      j++
    }
    rules.push({ prelude, body: text.slice(open + 1, j - 1) })
    i = j
  }
  return rules
}

function declarations(body: string): Map<string, string> {
  const map = new Map<string, string>()
  for (const m of body.matchAll(/([\w-]+)\s*:\s*([^;]+);/g)) map.set(m[1], m[2].trim())
  return map
}

function selectors(prelude: string): string[] {
  return prelude.split(',').map((s) => s.trim())
}

const tokens = parseRules(read('../ui/tokens.css'))
const defaults = tokens.find((r) => r.prelude === ':root, .board-surface')!
const lightMedia = tokens.find((r) => r.prelude === '@media (prefers-color-scheme: light)')!
const lightRoot = parseRules(lightMedia.body).find((r) => r.prelude === ':root:not([data-appearance="dark"]), :root:not([data-appearance="dark"]) .chrome-surface')!
const lightForced = tokens.find((r) => r.prelude === ':root[data-appearance="light"], :root[data-appearance="light"] .chrome-surface')!

const GAME_ELEMENT = /^--(mana-|seat-|dial-|ember-|ash-|blood-|toxic|ledger-line)/

function isLiteralColour(value: string): boolean {
  if (value.includes('var(')) return false
  return /^#|^rgba?\(|gradient|^\d+ \d+ \d+$/.test(value)
}

function luminance(hex: string): number {
  const h = hex.replace('#', '')
  const [r, g, b] = [0, 2, 4].map((i) => {
    const c = parseInt(h.slice(i, i + 2), 16) / 255
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
  })
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

describe('appearance: theme token sets', () => {
  it('APR-1: the dark colour set is the default declared on :root', () => {
    const decls = declarations(defaults.body)
    expect(selectors(defaults.prelude)).toContain(':root')
    expect(decls.get('--ink-0')).toBe('#060910')
    expect(decls.get('--fg-1')).toBe('#eef2fb')
    expect(decls.get('--brand')).toBe('#4c8dff')
  })

  it('APR-1: the light block redefines every literal colour token of the dark set', () => {
    const dark = declarations(defaults.body)
    const light = declarations(lightRoot.body)
    const missing = [...dark.entries()]
      .filter(([name, value]) => isLiteralColour(value) && !GAME_ELEMENT.test(name))
      .map(([name]) => name)
      .filter((name) => !light.has(name))
    expect(missing).toEqual([])
  })

  it('APR-1: the light block makes the surfaces light and the text dark', () => {
    const light = declarations(lightRoot.body)
    expect(luminance(light.get('--ink-0')!)).toBeGreaterThan(0.6)
    expect(luminance(light.get('--ink-4')!)).toBeGreaterThan(0.9)
    expect(luminance(light.get('--fg-1')!)).toBeLessThan(0.05)
    expect(light.get('--veil-3')).toContain('15 23 42')
    expect(light.get('--shade-3')).toContain('255 255 255')
  })

  it('APR-1: styles.css asks for both appearances and no longer forces dark', () => {
    const styles = parseRules(read('../styles.css'))
    const root = styles.find((r) => r.prelude === ':root')!
    expect(declarations(root.body).get('color-scheme')).toBe('light dark')
  })

  it('APR-2: the dark colour set is declared on .board-surface as well as on :root', () => {
    expect(selectors(defaults.prelude)).toContain('.board-surface')
    const boardTokens = declarations(defaults.body)
    expect(boardTokens.get('--ink-0')).toBe('#060910')
    expect(boardTokens.get('--line-2')).toBe('rgba(148, 170, 214, 0.18)')
  })

  it('APR-2: the light appearance block never selects .board-surface', () => {
    const selectorsInLight = parseRules(lightMedia.body).flatMap((r) => selectors(r.prelude))
    expect(selectorsInLight).not.toContain('.board-surface')
    expect(selectors(lightRoot.prelude)).toEqual([':root:not([data-appearance="dark"])', ':root:not([data-appearance="dark"]) .chrome-surface'])
  })

  it('APR-1: the light colour block applies to .chrome-surface', () => {
    expect(selectors(lightRoot.prelude).some((s) => s.endsWith('.chrome-surface'))).toBe(true)
  })

  it('APR-1: html[data-appearance="light"] forces the light set and the system block yields to a forced dark', () => {
    expect(selectors(lightForced.prelude)).toEqual([':root[data-appearance="light"]', ':root[data-appearance="light"] .chrome-surface'])
    expect(selectors(lightRoot.prelude)).toContain(':root:not([data-appearance="dark"])')
  })

  it('APR-1: the forced light block defines the same tokens as the system light block', () => {
    expect(declarations(lightForced.body)).toEqual(declarations(lightRoot.body))
  })

  it('APR-2: dialogs and panels inside the game tree carry chrome-surface', () => {
    const inGameTree = [
      'FeedbackDialog.tsx',
      'UserRequestDialog.tsx',
      'RollbackDialog.tsx',
      'RollbackVoteDialog.tsx',
      'LimitedDeckDialog.tsx',
      'SideboardScreen.tsx',
      'TournamentPanel.tsx',
      'SidePanel.tsx',
    ]
    const missing = inGameTree.filter((name) => !read(`../game/${name}`).includes('chrome-surface'))
    expect(missing).toEqual([])
  })

  it('APR-2: the board root carries the board-surface class and a dark native colour scheme', () => {
    const shell = read('../board/BoardShell.tsx')
    expect(shell).toMatch(/className=\{`board-shell board-surface /)
    expect(read('../game/GameScreen.tsx')).toMatch(/className=\{`game board-surface/)
    expect(read('../game/GameScreen.tsx')).toMatch(/className="game board-surface game--mobile-spectator"/)
    const css = parseRules(read('../board/BoardShell.css'))
    const surface = css.find((r) => r.prelude === '.board-surface')!
    expect(declarations(surface.body).get('color-scheme')).toBe('dark')
  })

  it('APR-2: the board stylesheets do not depend on :root', () => {
    const boardDir = fileURLToPath(new URL('../board', import.meta.url))
    const offenders = readdirSync(boardDir)
      .filter((name) => name.endsWith('.css') && statSync(join(boardDir, name)).isFile())
      .filter((name) => parseRules(readFileSync(join(boardDir, name), 'utf8')).some((r) => selectors(r.prelude).includes(':root')))
    expect(offenders).toEqual([])
  })

  it('APR-2: the colour aliases the board reads are repeated for .board-surface in styles.css', () => {
    const styles = parseRules(read('../styles.css'))
    const shared = styles.find((r) => r.prelude === ':root, .board-surface')!
    const decls = declarations(shared.body)
    for (const name of ['--bg', '--panel', '--panel-2', '--text', '--text-dim', '--border', '--dlg-bg', '--dlg-backdrop']) {
      expect(decls.has(name), name).toBe(true)
    }
  })
})
