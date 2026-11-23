// @vitest-environment node
import { readdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { ABILITY_ART, abilityArtUrl } from './abilityArt'

const dir = fileURLToPath(new URL('../../../public/symbols/abilities', import.meta.url))
const files = readdirSync(dir).filter((f) => f.endsWith('.svg')).map((f) => f.slice(0, -4))

describe('the official symbol of a keyword', () => {
  it('BRD-47: every registered keyword has its file, and every file is registered', () => {
    const registered = [...ABILITY_ART].sort()
    expect(registered.filter((id) => !files.includes(id)), 'registered with no file').toEqual([])
    expect(files.filter((id) => !ABILITY_ART.has(id)).sort(), 'file nobody reads').toEqual([])
  })

  it('BRD-47: the two strikes are drawn with their own symbol, not with a glyph of ours', () => {
    expect(abilityArtUrl('first_strike')).toMatch(/symbols\/abilities\/first_strike\.svg$/)
    expect(abilityArtUrl('double_strike')).toMatch(/symbols\/abilities\/double_strike\.svg$/)
  })

  it('a keyword outside the set keeps the glyph drawn in the registry', () => {
    expect(abilityArtUrl('banding')).toBeNull()
  })
})
