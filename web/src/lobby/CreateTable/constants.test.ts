import { describe, expect, it } from 'vitest'
import {
  aiSeatTypes,
  isHumanSeatType,
  isSimSeatType,
  normalizeSeatType,
  seatTypeLabel,
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

  it('classifies HUMAN and SIM seats', () => {
    expect(isHumanSeatType('HUMAN')).toBe(true)
    expect(isHumanSeatType('Human')).toBe(true)
    expect(isHumanSeatType('SIM')).toBe(false)
    expect(isSimSeatType('SIM')).toBe(true)
    expect(isSimSeatType('HUMAN')).toBe(false)
    expect(isSimSeatType('COMPUTER_MAD')).toBe(false)
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
