import { describe, expect, it } from 'vitest'
import {
  parseGamePlayers,
  parseGameState,
  parseGameWinner,
  parsePlayerResults,
  parsePlayerState,
  parseProfileHistory,
  parseTournamentTypeText,
  tournamentPhase,
} from './parse'

describe('TRN-11: game players, state and winner use the server formats', () => {
  it('TRN-11: splits the players on the first " - " so names may contain spaces', () => {
    expect(parseGamePlayers('alice - bob')).toEqual(['alice', 'bob'])
    expect(parseGamePlayers('Ana María - Juan Carlos')).toEqual(['Ana María', 'Juan Carlos'])
    expect(parseGamePlayers('a - b - c')).toEqual(['a', 'b - c'])
    expect(parseGamePlayers('alice bob')).toBeNull()
    expect(parseGamePlayers('')).toBeNull()
  })

  it('TRN-11: reads the phase and the optional duration of a game state', () => {
    expect(parseGameState('Dueling (8:14)')).toEqual({ phase: 'dueling', duration: '8:14', raw: 'Dueling (8:14)' })
    expect(parseGameState('Finished (1:02:03)')).toEqual({ phase: 'finished', duration: '1:02:03', raw: 'Finished (1:02:03)' })
    expect(parseGameState('Finished')).toEqual({ phase: 'finished', duration: null, raw: 'Finished' })
    expect(parseGameState('finished (12:30)')).toEqual({ phase: 'finished', duration: '12:30', raw: 'finished (12:30)' })
    expect(parseGameState('Dueling')).toEqual({ phase: 'dueling', duration: null, raw: 'Dueling' })
  })

  it('TRN-11: keeps any other game state as phase other and shows it raw', () => {
    expect(parseGameState('Starting')).toEqual({ phase: 'other', duration: null, raw: 'Starting' })
    expect(parseGameState('Waiting (1:00)')).toEqual({ phase: 'other', duration: null, raw: 'Waiting (1:00)' })
  })

  it('TRN-11: names the winner by index, a draw by "draw", and nothing else', () => {
    const players: [string, string] = ['Ana María', 'Juan Carlos']
    expect(parseGameWinner('Player Ana María is the winner', players)).toBe(0)
    expect(parseGameWinner('Player Juan Carlos is the winner', players)).toBe(1)
    expect(parseGameWinner('Game is a draw', players)).toBe('draw')
    expect(parseGameWinner('', players)).toBeNull()
    expect(parseGameWinner(undefined, players)).toBeNull()
    expect(parseGameWinner('Player Nobody is the winner', players)).toBeNull()
    expect(parseGameWinner('something else', players)).toBeNull()
  })
})

describe('TRN-11: player results parse and decide the outcome like the engine', () => {
  it('TRN-11: reads wins, losses, opponents with spaces, byes and the empty string', () => {
    expect(parsePlayerResults('R1 Ana María [2-0] R2 dara [1-2] R3 Bye ')).toEqual([
      { round: 1, bye: false, opponent: 'Ana María', wins: 2, losses: 0, draws: 0, selfMark: null, opponentMark: null, outcome: 'win' },
      { round: 2, bye: false, opponent: 'dara', wins: 1, losses: 2, draws: 0, selfMark: null, opponentMark: null, outcome: 'loss' },
      { round: 3, bye: true, opponent: null, wins: 0, losses: 0, draws: 0, selfMark: null, opponentMark: null, outcome: 'bye' },
    ])
    expect(parsePlayerResults('')).toEqual([])
    expect(parsePlayerResults(undefined)).toEqual([])
  })

  it('TRN-11: an opponent named with brackets stays whole, only the trailing bracket is the score', () => {
    expect(parsePlayerResults('R1 Ana [x] [2-1] ')).toEqual([
      expect.objectContaining({ round: 1, opponent: 'Ana [x]', wins: 2, losses: 1 }),
    ])
  })

  it('TRN-11: a draw is a third number and an equal score, Game-level draws included', () => {
    expect(parsePlayerResults('R1 bob [1-1-1] ')).toEqual([
      expect.objectContaining({ opponent: 'bob', wins: 1, losses: 1, draws: 1, outcome: 'draw' }),
    ])
  })

  it('TRN-11: an opponent quit, timer or idle mark is a win for the player whatever the score', () => {
    expect(parsePlayerResults('R2 dara [1-2Q] ')).toEqual([
      expect.objectContaining({ wins: 1, losses: 2, selfMark: null, opponentMark: 'Q', outcome: 'win' }),
    ])
    expect(parsePlayerResults('R1 bob [0-2T] ')).toEqual([expect.objectContaining({ opponentMark: 'T', outcome: 'win' })])
    expect(parsePlayerResults('R1 bob [0-2I] ')).toEqual([expect.objectContaining({ opponentMark: 'I', outcome: 'win' })])
  })

  it('TRN-11: the player own quit, timer or idle mark is a loss whatever the score', () => {
    expect(parsePlayerResults('R1 bob [2Q-0] ')).toEqual([
      expect.objectContaining({ wins: 2, losses: 0, selfMark: 'Q', opponentMark: null, outcome: 'loss' }),
    ])
    expect(parsePlayerResults('R1 bob [2T-0] ')).toEqual([expect.objectContaining({ selfMark: 'T', outcome: 'loss' })])
    expect(parsePlayerResults('R1 bob [2I-0] ')).toEqual([expect.objectContaining({ selfMark: 'I', outcome: 'loss' })])
  })

  it('TRN-11: returns null, so the raw text is shown, for text that does not match the format', () => {
    expect(parsePlayerResults('Auto Eliminated')).toBeNull()
    expect(parsePlayerResults('garbage')).toBeNull()
    expect(parsePlayerResults('R1 bob [2-0')).toBeNull()
    expect(parsePlayerResults('R1 bob [2-0] garbage')).toBeNull()
  })
})

describe('TRN-11: player state keeps the base text and the info in brackets', () => {
  it('TRN-11: maps each base text of the server enum to its kind', () => {
    expect(parsePlayerState('Joined')).toEqual({ kind: 'joined', info: null, raw: 'Joined' })
    expect(parsePlayerState('Drafting')).toMatchObject({ kind: 'drafting' })
    expect(parsePlayerState('Constructing')).toMatchObject({ kind: 'constructing' })
    expect(parsePlayerState('Dueling')).toMatchObject({ kind: 'dueling' })
    expect(parsePlayerState('Sideboarding')).toMatchObject({ kind: 'sideboarding' })
    expect(parsePlayerState('Waiting for next round')).toMatchObject({ kind: 'waiting', info: null })
    expect(parsePlayerState('Eliminated')).toMatchObject({ kind: 'eliminated' })
    expect(parsePlayerState('Canceled')).toMatchObject({ kind: 'canceled' })
    expect(parsePlayerState('Finished')).toMatchObject({ kind: 'finished' })
  })

  it('TRN-11: an info group in brackets is returned without the brackets', () => {
    expect(parsePlayerState('Waiting for next round (Round Bye)')).toEqual({
      kind: 'waiting',
      info: 'Round Bye',
      raw: 'Waiting for next round (Round Bye)',
    })
    expect(parsePlayerState('Finished (Winner)')).toMatchObject({ kind: 'finished', info: 'Winner' })
  })

  it('TRN-11: a disconnect suffix after the info is kept in info', () => {
    expect(parsePlayerState('Dueling (Round 2) disconnected 0:30').info).toBe('(Round 2) disconnected 0:30')
    expect(parsePlayerState('Dueling disconnected 0:30')).toMatchObject({ kind: 'dueling', info: 'disconnected 0:30' })
  })

  it('TRN-11: an unknown state is kind other with its raw text', () => {
    expect(parsePlayerState('Mulligan')).toEqual({ kind: 'other', info: null, raw: 'Mulligan' })
  })
})

describe('TRN-11: the tournament type text gives type, deck type and total rounds', () => {
  it('TRN-11: parses the constructed form with a deck type and rounds', () => {
    expect(parseTournamentTypeText('Constructed Swiss / Constructed - Modern 3 rounds')).toEqual({
      type: 'Constructed Swiss',
      deckType: 'Constructed - Modern',
      totalRounds: 3,
    })
  })

  it('TRN-11: keeps the pack variant in brackets as part of the type', () => {
    expect(parseTournamentTypeText('Booster Draft Elimination (Cube)')).toEqual({
      type: 'Booster Draft Elimination (Cube)',
      deckType: null,
      totalRounds: null,
    })
  })

  it('TRN-11: reads rounds without a deck type, singular included', () => {
    expect(parseTournamentTypeText('Sealed Swiss 4 rounds')).toEqual({ type: 'Sealed Swiss', deckType: null, totalRounds: 4 })
    expect(parseTournamentTypeText('Sealed Swiss 1 round')).toEqual({ type: 'Sealed Swiss', deckType: null, totalRounds: 1 })
  })

  it('TRN-11: a text without those parts is its own type', () => {
    expect(parseTournamentTypeText('Swiss')).toEqual({ type: 'Swiss', deckType: null, totalRounds: null })
  })
})

describe('TRN-11: the tournament state maps to a phase', () => {
  it('TRN-11: maps each server state text to its phase, case-insensitively', () => {
    expect(tournamentPhase('Waiting for players')).toBe('waiting')
    expect(tournamentPhase('Starting')).toBe('waiting')
    expect(tournamentPhase('Ready to start')).toBe('waiting')
    expect(tournamentPhase('Drafting')).toBe('drafting')
    expect(tournamentPhase('Constructing')).toBe('constructing')
    expect(tournamentPhase('DUELING')).toBe('dueling')
    expect(tournamentPhase('Sideboarding')).toBe('sideboarding')
    expect(tournamentPhase('Finished')).toBe('finished')
    expect(tournamentPhase('ended')).toBe('finished')
    expect(tournamentPhase('Something new')).toBe('other')
  })
})

describe('TRN-14: the profile history is read only from the profile format', () => {
  it('TRN-14: reads the matches, tourneys and ratings of the profile history', () => {
    expect(
      parseProfileHistory('Matches: 41 (2%), Tourneys: 6 (0%), Constructed Rating: 1540, Limited Rating: 1490'),
    ).toEqual({
      matches: '41',
      matchQuitPct: '2',
      tourneys: '6',
      tourneyQuitPct: '0',
      constructedRating: '1540',
      limitedRating: '1490',
    })
  })

  it('TRN-14: returns null for the empty string bots send, undefined and other text', () => {
    expect(parseProfileHistory('')).toBeNull()
    expect(parseProfileHistory(undefined)).toBeNull()
    expect(parseProfileHistory('Matches: 3')).toBeNull()
  })
})
