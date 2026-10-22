// @vitest-environment node
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { AURA_KEYWORDS, auraKeyframes } from './keywordAura'

const css = readFileSync(fileURLToPath(new URL('./KeywordAura.css', import.meta.url)), 'utf8')
const coinCss = readFileSync(fileURLToPath(new URL('./KeywordCoin.css', import.meta.url)), 'utf8')

const CSS_KEYWORDS = new Set([
  'none', 'infinite', 'alternate', 'alternate-reverse', 'linear', 'ease', 'ease-in', 'ease-out', 'ease-in-out',
  'normal', 'reverse', 'both', 'forwards', 'backwards', 'running', 'paused',
])

function ruleBlock(selector: string): string {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const match = css.match(new RegExp(`${escaped}\\s*\\{([^}]*)\\}`))
  if (!match) throw new Error(`selector not found: ${selector}`)
  return match[1]
}

function keyframesBlocks(source: string = css): Array<{ name: string; body: string }> {
  return [...source.matchAll(/@keyframes\s+([\w-]+)\s*\{((?:[^{}]|\{[^{}]*\})*)\}/g)].map((m) => ({
    name: m[1],
    body: m[2],
  }))
}

function animationNameReferences(): string[] {
  const names: string[] = []
  for (const decl of css.matchAll(/animation(?:-name)?\s*:\s*([^;]+);/g)) {
    const value = decl[1].replace(/\b(?:calc|var)\((?:[^()]|\([^()]*\))*\)/g, ' ')
    for (const token of value.split(/[\s,]+/)) {
      if (/^[A-Za-z_][\w-]*$/.test(token) && !CSS_KEYWORDS.has(token)) names.push(token)
    }
  }
  return names
}

function rgbVarAlphas(): string[] {
  const alphas: string[] = []
  const starts = [...css.matchAll(/rgb\(var\(--[\w-]+-rgb\)/g)].map((m) => m.index!)
  for (const start of starts) {
    let depth = 0
    let end = start
    for (let i = start; i < css.length; i++) {
      if (css[i] === '(') depth++
      else if (css[i] === ')') {
        depth--
        if (depth === 0) {
          end = i
          break
        }
      }
    }
    const inner = css.slice(start, end + 1)
    const slash = inner.indexOf('/')
    alphas.push(slash === -1 ? '' : inner.slice(slash + 1))
  }
  return alphas
}

describe('KeywordAura.css', () => {
  it.each(AURA_KEYWORDS.map((id) => [id]))('styles %s with its own keyframes on the span', (id) => {
    const keyframes = auraKeyframes(id)
    expect(ruleBlock(`.kw-aura--${id}`)).toContain(keyframes)
    expect(keyframesBlocks().map((k) => k.name)).toContain(keyframes)
  })

  it('defines every keyframes name referenced by an animation', () => {
    const defined = new Set(keyframesBlocks().map((k) => k.name))
    const referenced = animationNameReferences()
    expect(referenced.length).toBeGreaterThan(0)
    for (const name of referenced) {
      expect(defined.has(name), `animation references undefined @keyframes ${name}`).toBe(true)
    }
  })

  it.each([['KeywordAura.css', css], ['KeywordCoin.css', coinCss]])('FX-11: only animates transform and opacity inside %s keyframes', (_file, source) => {
    const allowed = new Set(['transform', 'opacity'])
    const blocks = keyframesBlocks(source)
    expect(blocks.length).toBeGreaterThan(0)
    for (const { name, body } of blocks) {
      for (const inner of body.matchAll(/\{([^{}]*)\}/g)) {
        for (const declaration of inner[1].split(';')) {
          const property = declaration.split(':')[0].trim()
          if (!property) continue
          expect(allowed.has(property), `@keyframes ${name} animates "${property}"`).toBe(true)
        }
      }
    }
  })

  it('FX-1, FX-2: turns decorative animation off under fx-off and reduced motion', () => {
    expect(css).toContain('html.fx-off .kw-aura')
    expect(css).toContain('prefers-reduced-motion')
  })

  it('scales every coloured rgb(var(--…-rgb)) alpha by --kw-aura-a', () => {
    const alphas = rgbVarAlphas()
    expect(alphas.length).toBeGreaterThan(0)
    for (const alpha of alphas) {
      expect(alpha, `alpha without var(--kw-aura-a): ${alpha}`).toContain('var(--kw-aura-a)')
    }
  })
})
