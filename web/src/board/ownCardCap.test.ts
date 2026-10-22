import { describe, expect, it } from 'vitest'
import { ownBoardCardW } from './ownCardCap'

function zone(cardW: string | null, bandW: string | null): HTMLElement {
  const el = document.createElement('div')
  if (cardW !== null) el.style.setProperty('--card-w', cardW)
  const band = document.createElement('div')
  band.className = 'bz-band'
  if (bandW !== null) band.style.setProperty('--card-w', bandW)
  el.appendChild(band)
  return el
}

describe('ownBoardCardW', () => {
  it('BRD-3: the own card width is the zone base width, not a band a crowded row shrank', () => {
    expect(ownBoardCardW(zone('120px', '60px'))).toBe(120)
  })

  it('BRD-3: without a zone width it reads nothing rather than guessing', () => {
    expect(ownBoardCardW(zone(null, null))).toBeUndefined()
  })
})
