// @vitest-environment node
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const raw = readFileSync(fileURLToPath(new URL('./CardSlot.css', import.meta.url)), 'utf8')
const css = raw.replace(/\/\*[\s\S]*?\*\//g, '')

function rule(selector: string): string {
  // Ancla a un selector que no venga tras una coma: así el `.sickness-veil`
  // del bloque `@media (prefers-reduced-motion)` no ensucia la regla principal.
  const m = css.match(new RegExp(`(^|[};])\\s*\\.${selector}\\s*\\{([^}]*)\\}`))
  return m ? m[2] : ''
}

describe('sickness veil', () => {
  // jsdom no aplica el CSS que importa el componente, así que el contrato de
  // "no robar el click a la carta" se fija sobre el texto de la hoja.
  it('never intercepts pointer events', () => {
    expect(rule('sickness-veil')).toContain('pointer-events: none')
  })

  it('fills the card box', () => {
    expect(rule('sickness-veil')).toContain('inset: 0')
  })

  it('carries no pointer affordance of its own', () => {
    expect(rule('sickness-veil')).not.toContain('cursor')
  })
})