import { describe, expect, it } from 'vitest'
import {
  FALLBACK_CHOICE,
  choiceOf,
  choiceWithModality,
  fillSlots,
  isCubeBased,
  isSetBased,
  slotCodes,
  summariseSetCodes,
  tourneySummaries,
  withSlot,
} from './tourneyFormat'

const stubT = (_category: string, key: string, params?: Record<string, string | number>) =>
  params ? `${key}${JSON.stringify(params)}` : key

describe('TRN-2: the format step maps the choice to and from the server name', () => {
  it('TRN-2: a modality keeps the pack variant it offers, else takes its first variant', () => {
    const cube = { modality: 'draft', pairing: 'swiss', variant: 'cube' } as const
    expect(choiceWithModality(cube, 'sealed')).toEqual({ modality: 'sealed', pairing: 'swiss', variant: 'cube' })
    expect(choiceWithModality(cube, 'jumpstart')).toEqual({ modality: 'jumpstart', pairing: 'swiss', variant: 'standard' })
    expect(choiceWithModality(cube, 'constructed')).toEqual({ modality: 'constructed', pairing: 'swiss', variant: 'standard' })
  })

  it('TRN-2: a server name of an unknown shape reads as the draft elimination', () => {
    expect(choiceOf('Booster Draft')).toEqual(FALLBACK_CHOICE)
    expect(choiceOf('Limited Swiss')).toEqual(FALLBACK_CHOICE)
    expect(choiceOf('Sealed Swiss (Cube)')).toEqual({ modality: 'sealed', pairing: 'swiss', variant: 'cube' })
  })
})

describe('TRN-7: the set slots keep one code per booster', () => {
  it('TRN-7: an uncoded booster has an empty slot', () => {
    expect(slotCodes('M21, BLB', 3)).toEqual(['M21', 'BLB', ''])
    expect(slotCodes('M21, BLB, MH3, DSK', 3)).toEqual(['M21', 'BLB', 'MH3'])
  })

  it('TRN-7: changing one slot keeps the others', () => {
    expect(withSlot('M21, M21, M21', 3, 1, 'BLB')).toBe('M21, BLB, M21')
    expect(withSlot('', 3, 0, 'MH3')).toBe('MH3, MH3, MH3')
  })

  it('TRN-7: a popular set fills every booster', () => {
    expect(fillSlots(6, 'FDN').split(', ')).toHaveLength(6)
    expect(new Set(fillSlots(6, 'FDN').split(', '))).toEqual(new Set(['FDN']))
  })

  it('TRN-7: repeated sets read as a count, never as a list', () => {
    expect(summariseSetCodes(['M21', 'M21', 'M21'])).toBe('M21 ×3')
    expect(summariseSetCodes(['M21', 'BLB', 'M21'])).toBe('M21 ×2, BLB')
    expect(summariseSetCodes(['MH3'])).toBe('MH3')
  })

  it('TRN-7: set boosters are the draft standard, reshuffled and rich man pools and the sealed standard pool', () => {
    expect(isSetBased({ modality: 'draft', pairing: 'swiss', variant: 'standard' })).toBe(true)
    expect(isSetBased({ modality: 'draft', pairing: 'swiss', variant: 'richman' })).toBe(true)
    expect(isSetBased({ modality: 'sealed', pairing: 'swiss', variant: 'standard' })).toBe(true)
    expect(isSetBased({ modality: 'sealed', pairing: 'swiss', variant: 'cube' })).toBe(false)
    expect(isSetBased({ modality: 'jumpstart', pairing: 'swiss', variant: 'standard' })).toBe(false)
    expect(isCubeBased({ modality: 'draft', pairing: 'swiss', variant: 'richmancube' })).toBe(true)
    expect(isCubeBased({ modality: 'draft', pairing: 'swiss', variant: 'random' })).toBe(false)
  })
})

describe('TRN-1: each step tab has a one-line summary of its choices', () => {
  it('TRN-1: the format line names the modality with its packs, the pairing and the seats', () => {
    const { format } = tourneySummaries({ tournamentType: 'Booster Draft Swiss (Cube)', numPlayers: 8, wins: 2, timeLimit: 'MIN__25' }, stubT as never)
    expect(format).toContain('staging_seats_count')
    expect(format).toContain('trn_modality_draft')
    expect(format).toContain('trn_pack_cube')
    expect(format).toContain('trn_pairing_swiss')
  })

  it('TRN-1: the rules line shows the best-of and the clock, or no clock', () => {
    expect(tourneySummaries({ tournamentType: 'Constructed Swiss', numPlayers: 8, wins: 2, timeLimit: 'MIN__25' }, stubT as never).rules)
      .toContain('"bo":"Bo3"')
    expect(tourneySummaries({ tournamentType: 'Constructed Swiss', numPlayers: 8, wins: 2, timeLimit: 'MIN__25' }, stubT as never).rules)
      .toContain('trn_sum_clock')
    expect(tourneySummaries({ tournamentType: 'Constructed Swiss', numPlayers: 8, wins: 2, timeLimit: 'MIN__25' }, stubT as never).rules)
      .toContain('25')
    expect(tourneySummaries({ tournamentType: 'Constructed Swiss', numPlayers: 8, wins: 1, timeLimit: 'NONE' }, stubT as never).rules)
      .toBe('trn_sum_rules{"bo":"Bo1","clock":"trn_sum_no_clock"}')
  })
})
