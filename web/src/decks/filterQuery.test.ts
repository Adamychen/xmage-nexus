import { describe, expect, it } from 'vitest'
import { buildScryfallQuery, rawQueryHasColor, type ScryfallQueryOpts } from './filterQuery'

function base(over: Partial<ScryfallQueryOpts> = {}): ScryfallQueryOpts {
  return {
    rawQuery: '',
    formatKey: null,
    colorFilter: new Set<string>(),
    typeFilter: null,
    cmcFilter: null,
    rarityFilter: new Set(),
    keywordFilter: new Set<string>(),
    powerFilter: null,
    toughnessFilter: null,
    setFilter: null,
    ...over,
  }
}

describe('filterQuery (AUDIT)', () => {
  it('detecta filtro de color en el texto libre', () => {
    expect(rawQueryHasColor('c:red')).toBe(true)
    expect(rawQueryHasColor('t:dragon c<=g')).toBe(true)
    expect(rawQueryHasColor('color>=rw o:double')).toBe(true)
    expect(rawQueryHasColor('haste dragon')).toBe(false)
    expect(rawQueryHasColor('')).toBe(false)
  })

  it('no emite pow/tou con NaN (tecla e en el input numérico)', () => {
    const q = buildScryfallQuery(base({ powerFilter: { op: '>=', value: NaN }, toughnessFilter: { op: '=', value: NaN } }))
    expect(q).not.toContain('pow')
    expect(q).not.toContain('tou')
  })

  it('emite stats finitos con normalidad', () => {
    const q = buildScryfallQuery(base({ powerFilter: { op: '>', value: 3 } }))
    expect(q).toContain('pow>3')
  })
})
