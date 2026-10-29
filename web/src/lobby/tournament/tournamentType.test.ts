import { describe, expect, it } from 'vitest'
import { DEFAULT_TOURNAMENT_TYPES } from '../CreateTable/constants'
import {
  VARIANTS_BY_MODALITY,
  choiceDisabledReason,
  clampSwissRounds,
  composeTournamentType,
  decomposeTournamentType,
  eliminationRoundCount,
  eliminationRoundNames,
  isChoiceListed,
  recommendedSwissRounds,
  type TournamentChoice,
} from './tournamentType'

describe('TRN-2: a tournament type composes from modality, pairing and packs', () => {
  it('TRN-2: composes the server name for each modality, pairing and pack variant', () => {
    expect(composeTournamentType({ modality: 'draft', pairing: 'swiss', variant: 'cube' })).toBe('Booster Draft Swiss (Cube)')
    expect(composeTournamentType({ modality: 'draft', pairing: 'elimination', variant: 'richmancube' })).toBe(
      'Booster Draft Elimination (Rich Man Cube)',
    )
    expect(composeTournamentType({ modality: 'sealed', pairing: 'elimination', variant: 'standard' })).toBe('Sealed Elimination')
    expect(composeTournamentType({ modality: 'jumpstart', pairing: 'elimination', variant: 'custom' })).toBe(
      'Jumpstart Elimination (Custom)',
    )
  })

  it('TRN-2: a constructed type ignores the pack variant', () => {
    expect(composeTournamentType({ modality: 'constructed', pairing: 'swiss', variant: 'standard' })).toBe('Constructed Swiss')
    expect(composeTournamentType({ modality: 'constructed', pairing: 'elimination', variant: 'cube' })).toBe('Constructed Elimination')
  })

  it('TRN-2: every name in the server catalogue parses back to the choice it was composed from', () => {
    for (const name of DEFAULT_TOURNAMENT_TYPES) {
      const choice = decomposeTournamentType(name)
      expect(choice, name).not.toBeNull()
      expect(composeTournamentType(choice!), name).toBe(name)
    }
  })

  it('TRN-2: a name that is not a well-formed server name for a choice does not parse', () => {
    expect(decomposeTournamentType('Two Player Duel')).toBeNull()
    expect(decomposeTournamentType('Constructed Swiss (Cube)')).toBeNull()
    expect(decomposeTournamentType('Booster Draft Round Robin')).toBeNull()
    expect(decomposeTournamentType('')).toBeNull()
  })

  it('TRN-2: lists the packs each modality offers, and none for constructed', () => {
    expect(VARIANTS_BY_MODALITY.draft).toEqual(['standard', 'cube', 'random', 'reshuffled', 'richman', 'richmancube'])
    expect(VARIANTS_BY_MODALITY.sealed).toEqual(['standard', 'cube'])
    expect(VARIANTS_BY_MODALITY.jumpstart).toEqual(['standard', 'custom'])
    expect(VARIANTS_BY_MODALITY.constructed).toEqual([])
  })

  it('TRN-2: a combination the catalogue does not list is disabled with a reason, never sent', () => {
    const listed: TournamentChoice = { modality: 'draft', pairing: 'swiss', variant: 'cube' }
    const unlisted: TournamentChoice = { modality: 'sealed', pairing: 'swiss', variant: 'random' }
    expect(isChoiceListed(listed, DEFAULT_TOURNAMENT_TYPES)).toBe(true)
    expect(choiceDisabledReason(listed, DEFAULT_TOURNAMENT_TYPES)).toBeNull()
    expect(isChoiceListed(unlisted, DEFAULT_TOURNAMENT_TYPES)).toBe(false)
    expect(choiceDisabledReason(unlisted, DEFAULT_TOURNAMENT_TYPES)).toBe('not-listed')
  })

  it('TRN-2: the catalogue match is exact, so a near name is not listed', () => {
    const choice: TournamentChoice = { modality: 'constructed', pairing: 'swiss', variant: 'standard' }
    expect(isChoiceListed(choice, ['Constructed swiss'])).toBe(false)
    expect(isChoiceListed(choice, [])).toBe(false)
  })
})

describe('TRN-3: a Swiss tournament recommends 2 to 10 rounds and an elimination derives its rounds', () => {
  it('TRN-3: recommends ceil(log2(seats)) rounds for 2, 4, 8, 16 and 32 seats', () => {
    expect([2, 4, 8, 16, 32].map(recommendedSwissRounds)).toEqual([2, 2, 3, 4, 5])
  })

  it('TRN-3: keeps the recommendation between 2 and 10 rounds', () => {
    expect(recommendedSwissRounds(1)).toBe(2)
    expect(recommendedSwissRounds(1024)).toBe(10)
    expect(clampSwissRounds(0)).toBe(2)
    expect(clampSwissRounds(11)).toBe(10)
    expect(clampSwissRounds(NaN)).toBe(2)
    expect(clampSwissRounds(6)).toBe(6)
  })

  it('TRN-3: an elimination tournament has log2(seats) rounds, at least one', () => {
    expect(eliminationRoundCount(8)).toBe(3)
    expect(eliminationRoundCount(2)).toBe(1)
    expect(eliminationRoundCount(32)).toBe(5)
    expect(eliminationRoundCount(1)).toBe(1)
  })
})

describe('TRN-13: elimination rounds are named from the final backwards', () => {
  it('TRN-13: names the rounds from the first round to the final', () => {
    expect(eliminationRoundNames(3)).toEqual(['quarterfinal', 'semifinal', 'final'])
    expect(eliminationRoundNames(1)).toEqual(['final'])
    expect(eliminationRoundNames(5)).toEqual(['round_of_32', 'round_of_16', 'quarterfinal', 'semifinal', 'final'])
    expect(eliminationRoundNames(0)).toEqual([])
  })
})
