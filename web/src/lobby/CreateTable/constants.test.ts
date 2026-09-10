import { describe, expect, it } from 'vitest'
import {
  aiSeatTypes,
  DEFAULT_DRAFT_TOURNAMENT_TYPE,
  defaultTournamentType,
  getEffectiveMaxPlayers,
  isHumanSeatType,
  isNativeAiSeatType,
  isSimSeatType,
  normalizeSeatType,
  normalizeTournamentType,
  seatTypeLabel,
  tournamentTypeNameOf,
} from './constants'

describe('seat types (U3 plazas HUMAN)', () => {
  it('normalizes enum names, descriptions and legacy aliases', () => {
    expect(normalizeSeatType('HUMAN')).toBe('HUMAN')
    expect(normalizeSeatType('Human')).toBe('HUMAN')
    expect(normalizeSeatType('SIM')).toBe('SIM')
    expect(normalizeSeatType('sim')).toBe('SIM')
    expect(normalizeSeatType('COMPUTER_MAD')).toBe('COMPUTER_MAD')
    expect(normalizeSeatType('Computer - mad')).toBe('COMPUTER_MAD')
    expect(normalizeSeatType('COMPUTER_MONTE_CARLO')).toBe('COMPUTER_MONTE_CARLO')
    expect(normalizeSeatType('Computer - monte carlo')).toBe('COMPUTER_MONTE_CARLO')
    expect(normalizeSeatType('COMPUTER_DRAFT')).toBe('COMPUTER_DRAFT_BOT')
    expect(normalizeSeatType('Computer - draftbot')).toBe('COMPUTER_DRAFT_BOT')
  })

  it('classifies HUMAN, SIM and native AI seats', () => {
    expect(isHumanSeatType('HUMAN')).toBe(true)
    expect(isHumanSeatType('Human')).toBe(true)
    expect(isHumanSeatType('SIM')).toBe(false)
    expect(isSimSeatType('SIM')).toBe(true)
    expect(isSimSeatType('HUMAN')).toBe(false)
    expect(isSimSeatType('COMPUTER_MAD')).toBe(false)
    expect(isNativeAiSeatType('COMPUTER_MAD')).toBe(true)
    expect(isNativeAiSeatType('Computer - mad')).toBe(true)
    expect(isNativeAiSeatType('COMPUTER_MONTE_CARLO')).toBe(true)
    expect(isNativeAiSeatType('HUMAN')).toBe(false)
    expect(isNativeAiSeatType('SIM')).toBe(false)
  })

  it('aiSeatTypes excludes HUMAN and SIM without duplicates', () => {
    expect(aiSeatTypes(['HUMAN', 'SIM', 'COMPUTER_MAD', 'Human', 'COMPUTER_DRAFT'])).toEqual([
      'COMPUTER_MAD',
      'COMPUTER_DRAFT_BOT',
    ])
  })

  it('labels seats for the dropdown', () => {
    expect(seatTypeLabel('HUMAN')).toMatch(/espera/i)
    expect(seatTypeLabel('SIM')).toBe('SIM')
    expect(seatTypeLabel('COMPUTER_DRAFT_BOT')).toMatch(/draftbot/i)
  })
})

describe('tournament types (draft NPE)', () => {
  const serverNames = [
    'Constructed Elimination',
    'Constructed Swiss',
    'Booster Draft Elimination',
    'Booster Draft Swiss',
    'Sealed Elimination',
  ]

  it('default draft type is a real server type', () => {
    expect(serverNames).toContain(DEFAULT_DRAFT_TOURNAMENT_TYPE)
    expect(DEFAULT_DRAFT_TOURNAMENT_TYPE).not.toBe('Booster Draft')
  })

  it('tournamentTypeNameOf unwraps TournamentTypeView objects', () => {
    expect(tournamentTypeNameOf('Booster Draft Elimination')).toBe('Booster Draft Elimination')
    expect(tournamentTypeNameOf({ name: 'Sealed Swiss' })).toBe('Sealed Swiss')
    expect(tournamentTypeNameOf(null)).toBe('')
  })

  it('normalizeTournamentType maps the legacy bare Booster Draft to a valid name', () => {
    expect(normalizeTournamentType('Booster Draft Elimination', serverNames)).toBe('Booster Draft Elimination')
    expect(normalizeTournamentType('Booster Draft', serverNames)).toBe('Booster Draft Elimination')
    expect(normalizeTournamentType('Constructed Swiss', serverNames)).toBe('Constructed Swiss')
    expect(normalizeTournamentType('No Existe', serverNames)).toBe('No Existe')
  })

  it('defaultTournamentType prefers a draft type over names[0]', () => {
    expect(defaultTournamentType(serverNames)).toBe('Booster Draft Elimination')
    expect(defaultTournamentType(['Constructed Elimination', 'Constructed Swiss'])).toBe('Constructed Elimination')
    expect(defaultTournamentType([])).toBe(DEFAULT_DRAFT_TOURNAMENT_TYPE)
  })

  it('getEffectiveMaxPlayers caps drafts at 8 regardless of gameType', () => {
    const gameTypes = [{ name: 'Two Player Duel', minPlayers: 2, maxPlayers: 2 }]
    expect(getEffectiveMaxPlayers('Two Player Duel', gameTypes, true)).toBe(8)
    expect(getEffectiveMaxPlayers('Two Player Duel', gameTypes, false)).toBe(2)
  })
})
