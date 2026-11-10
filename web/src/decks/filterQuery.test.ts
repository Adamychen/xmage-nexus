import { describe, expect, it } from 'vitest'
import { buildScryfallQuery, hasSearchCriteria, oracleTerms, rawQueryHasColor, type ScryfallQueryOpts } from './filterQuery'

function base(over: Partial<ScryfallQueryOpts> = {}): ScryfallQueryOpts {
  return {
    rawQuery: '',
    formatKey: null,
    colorFilter: new Set<string>(),
    typeFilter: new Set<string>(),
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

  it('DCK-18: picked colours keep coloured cards and only the lands that make those colours', () => {
    expect(buildScryfallQuery(base({ colorFilter: new Set(['R']) }))).toBe('game:paper -t:basic (c<=r -c:c OR (t:land id<=r -id:c))')
    expect(buildScryfallQuery(base({ colorFilter: new Set(['R', 'G']) }))).toContain('(c<=rg -c:c OR (t:land id<=rg -id:c))')
  })

  it('DCK-18: the colourless chip asks for colourless cards and only the lands of colourless identity', () => {
    expect(buildScryfallQuery(base({ colorFilter: new Set(['C']) }))).toBe('game:paper -t:basic (c:c -t:land OR (t:land id:c))')
  })
})

describe('hasSearchCriteria', () => {
  it('DCK-21: the format and an empty or blank search are not something to search for', () => {
    expect(hasSearchCriteria(base())).toBe(false)
    expect(hasSearchCriteria(base({ formatKey: 'commander', rawQuery: '   ', setFilter: ' ' }))).toBe(false)
  })

  it('DCK-21: a name or any one filter is', () => {
    expect(hasSearchCriteria(base({ rawQuery: 'bolt' }))).toBe(true)
    expect(hasSearchCriteria(base({ colorFilter: new Set(['R']) }))).toBe(true)
    expect(hasSearchCriteria(base({ typeFilter: new Set(['Creature']) }))).toBe(true)
    expect(hasSearchCriteria(base({ cmcFilter: 0 }))).toBe(true)
    expect(hasSearchCriteria(base({ rarityFilter: new Set(['mythic']) }))).toBe(true)
    expect(hasSearchCriteria(base({ keywordFilter: new Set(['Flying']) }))).toBe(true)
    expect(hasSearchCriteria(base({ powerFilter: { op: '>=', value: 3 } }))).toBe(true)
    expect(hasSearchCriteria(base({ toughnessFilter: { op: '<', value: 2 } }))).toBe(true)
    expect(hasSearchCriteria(base({ setFilter: 'mh3' }))).toBe(true)
  })
})

describe('type filter', () => {
  it('DCK-22: several types are searched as one OR group', () => {
    expect(buildScryfallQuery(base({ typeFilter: new Set(['Creature']) }))).toContain('t:creature')
    expect(buildScryfallQuery(base({ typeFilter: new Set(['Creature', 'Artifact']) }))).toContain('(t:creature OR t:artifact)')
  })
})

describe('oracle text', () => {
  it('DCK-24: each word is its own rules-text term, and quotes keep a phrase together', () => {
    expect(oracleTerms('draw a card')).toEqual(['draw', 'a', 'card'])
    expect(oracleTerms('"enters tapped"  sacrifice')).toEqual(['enters tapped', 'sacrifice'])
    expect(oracleTerms('  "" ')).toEqual([])
  })

  it('DCK-24: rules text becomes Scryfall o: terms and counts as something to search for', () => {
    const q = buildScryfallQuery(base({ oracleText: '"enters tapped" draw' }))
    expect(q).toContain('o:"enters tapped"')
    expect(q).toContain('o:"draw"')
    expect(hasSearchCriteria(base({ oracleText: '  ' }))).toBe(false)
    expect(hasSearchCriteria(base({ oracleText: 'draw' }))).toBe(true)
  })
})
