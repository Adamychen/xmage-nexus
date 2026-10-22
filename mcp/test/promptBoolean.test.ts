import { describe, expect, it } from 'vitest'
import { normalizePrompt } from '../src/xmage/promptView.ts'

function confirmation(options: Record<string, unknown>, question = 'Choose one') {
  return normalizePrompt('GAME_ASK', { question, options }, 'g1')
}

describe('boolean confirmation values', () => {
  it('does not read "no" inside "Snow Covered Island" as a refusal', () => {
    const view = confirmation({ a: { label: 'Snow Covered Island' }, b: { label: 'Forest' } })
    expect(view?.mode).toBe('boolean')
    expect(view?.options.map((option) => option.value)).toEqual(['true', 'false'])
  })

  it('matches whole words only: Unknown, Nonbasic and Done are not substrings of no/cancel/yes', () => {
    const view = confirmation({
      a: { label: 'Unknown' },
      b: { label: 'Nonbasic' },
      c: { label: 'Cancel' },
      d: { label: 'Done' },
    })
    expect(view?.options.map((option) => option.value)).toEqual(['true', 'false', 'false', 'true'])
  })

  it('prefers the server-provided value over the label heuristic', () => {
    const view = confirmation({ a: { label: 'Cancel', value: 'true' }, b: { label: 'Yes', value: 'false' } })
    expect(view?.options.map((option) => option.value)).toEqual(['true', 'false'])
  })

  it('labels object items from label, name or text, and falls back to the key', () => {
    const view = confirmation({ k1: { text: 'Hello' }, k2: { name: 'Named' }, k3: { value: 'x' } })
    expect(view?.options.map((option) => option.label)).toEqual(['Hello', 'Named', 'k3'])
  })
})
