import { describe, expect, it } from 'vitest'
import { tableArtCard } from './tableArt'

describe('tableArtCard', () => {
  it('returns null when there is no deck type or no rule matches', () => {
    expect(tableArtCard(undefined)).toBeNull()
    expect(tableArtCard('')).toBeNull()
    expect(tableArtCard('Freeform')).toBeNull()
    expect(tableArtCard('Constructed Swiss')).toBeNull()
  })

  it('maps commander variants to the commander card before the generic formats', () => {
    expect(tableArtCard('Freeform Commander Free For All')).toEqual({ cardName: 'Command Tower' })
    expect(tableArtCard('Constructed - Commander')).toEqual({ cardName: 'Command Tower' })
    expect(tableArtCard('Variant Magic - Duel Commander')).toEqual({ cardName: 'Command Tower' })
  })

  it('maps constructed and limited formats to a representative card', () => {
    expect(tableArtCard('Constructed - Modern')).toEqual({ cardName: 'Snapcaster Mage' })
    expect(tableArtCard('Constructed - Pauper')).toEqual({ cardName: 'Lightning Bolt' })
    expect(tableArtCard('Constructed - Vintage')).toEqual({ cardName: 'Black Lotus' })
    expect(tableArtCard('Limited')).toEqual({ cardName: 'Serra Angel' })
  })
})
