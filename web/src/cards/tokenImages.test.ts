import { describe, expect, it } from 'vitest'
import tokenImages from '../data/tokenImages.generated.json'

const table = tokenImages as Record<string, string>

describe('tokenImages.generated.json', () => {
  it('covers the desktop XMage token table', () => {
    expect(Object.keys(table).length).toBeGreaterThan(2000)
  })

  it('maps SET/Name[/N][#back] to a Scryfall set/collector-number', () => {
    for (const [key, value] of Object.entries(table)) {
      expect(key, key).toMatch(/^[A-Z0-9_]+\/.+/)
      expect(value, key).toMatch(/^[a-z0-9_]+\/[^/\s]+$/)
    }
  })

  it('keeps the variants the engine numbers within one set', () => {
    expect(table['XLN/Treasure/1']).toBe('txln/7')
    expect(table['XLN/Treasure/4']).toBe('txln/10')
    expect(table['LCI/Treasure']).toBe('tlci/18')
    expect(table['LCI/Dinosaur/1']).toBe('tlci/10')
  })
})
