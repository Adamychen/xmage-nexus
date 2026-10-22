import { describe, expect, it } from 'vitest'
import type { PermanentView } from '../net/types'
import { bandFill, bandShares, permanentKind, BAND_FR_EMPTY, BAND_FR_FULL } from './bandWeights'

function perm(types: string[], over: Partial<PermanentView> = {}): PermanentView {
  return { name: 'X', manaValue: 0, cardTypes: types, ...over } as PermanentView
}

describe('bandFill', () => {
  it('marks lands and other permanents as the permanents band and creatures as the creatures band', () => {
    expect(bandFill({ a: perm(['LAND']) }, false)).toEqual({ creatures: false, permanents: true })
    expect(bandFill({ a: perm(['CREATURE']) }, false)).toEqual({ creatures: true, permanents: false })
    expect(bandFill({ a: perm(['ARTIFACT']) }, false)).toEqual({ creatures: false, permanents: true })
    expect(bandFill({ a: perm(['LAND']), b: perm(['CREATURE']) }, false)).toEqual({ creatures: true, permanents: true })
  })

  it('counts a commander as a card of the creatures band, ignores phased-out permanents and attachments', () => {
    expect(bandFill({}, true)).toEqual({ creatures: true, permanents: false })
    expect(bandFill({ a: perm(['CREATURE'], { phasedIn: false }) }, false)).toEqual({ creatures: false, permanents: false })
    const host = perm(['CREATURE'], { attachments: ['aura'] })
    const aura = perm(['ENCHANTMENT'])
    expect(bandFill({ host, aura }, false)).toEqual({ creatures: true, permanents: false })
  })

  it('draws a land that is a creature (Dryad Arbor, an animated Mutavault) with the creatures', () => {
    expect(bandFill({ a: perm(['LAND', 'CREATURE']) }, false)).toEqual({ creatures: true, permanents: false })
    expect(permanentKind(perm(['ARTIFACT', 'CREATURE']))).toBe('creatures')
  })

  it('docks sagas and planeswalkers into the creatures band', () => {
    expect(bandFill({ a: perm(['PLANESWALKER']) }, false)).toEqual({ creatures: true, permanents: false })
  })

  it('BRD-2: a marquee column does not fill the creatures band', () => {
    expect(bandFill({ a: perm(['PLANESWALKER']) }, false, true)).toEqual({ creatures: false, permanents: false })
    expect(bandFill({ a: perm(['SAGA']) }, false, true)).toEqual({ creatures: false, permanents: false })
    expect(bandFill({ a: perm(['PLANESWALKER']), b: perm(['CREATURE']) }, false, true)).toEqual({ creatures: true, permanents: false })
  })
})

describe('bandShares', () => {
  it('keeps the equal split when both bands are filled or both are empty', () => {
    expect(bandShares({ creatures: true, permanents: true })).toMatchObject({ tallest: 0.5, uneven: false })
    expect(bandShares({ creatures: false, permanents: false })).toMatchObject({ tallest: 0.5, uneven: false })
  })

  it('gives the height of an empty band to the filled one', () => {
    const s = bandShares({ creatures: false, permanents: true })
    expect(s).toEqual({ creaturesFr: BAND_FR_EMPTY, permanentsFr: BAND_FR_FULL, tallest: 0.8, uneven: true })
    expect(bandShares({ creatures: true, permanents: false }).creaturesFr).toBe(BAND_FR_FULL)
  })
})
