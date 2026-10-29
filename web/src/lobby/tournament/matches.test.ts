import { describe, expect, it } from 'vitest'
import type { RoundView, TournamentGameView, TournamentPlayerView, TournamentView } from '../../net/types'
import {
  constructionRemainingSeconds,
  currentRoundIndex,
  eliminationTree,
  findMyMatch,
  groupRoundMatches,
  isParticipant,
  myStanding,
  podium,
  readiness,
  sortStandings,
  winnerOf,
} from './matches'

function player(name: string, over: Partial<TournamentPlayerView> = {}): TournamentPlayerView {
  return { name, state: 'Waiting for next round', points: 0, results: '', ...over }
}

function game(players: string, over: Partial<TournamentGameView> = {}): TournamentGameView {
  return { roundNum: 1, state: 'Finished', result: '', players, ...over }
}

function round(...games: TournamentGameView[]): RoundView {
  return { games }
}

function view(over: Partial<TournamentView> = {}): TournamentView {
  return {
    tournamentName: 'Cup',
    tournamentType: 'Booster Draft Swiss',
    tournamentState: 'Dueling',
    constructionTime: 600,
    watchingAllowed: true,
    rounds: [],
    players: [],
    ...over,
  }
}

describe('TRN-10: games of a round become one match card each', () => {
  const players = [player('alice', { results: 'R1 bob [2-1] ' }), player('bob', { results: 'R1 alice [1-2] ' })]

  it('TRN-10: groups the three games of a best-of-three into ONE match with its score', () => {
    const matches = groupRoundMatches(
      round(
        game('alice - bob', { matchId: 'm1', gameId: 'g1', state: 'Finished (5:00)', result: 'Player alice is the winner', tableId: 't1' }),
        game('alice - bob', { matchId: 'm1', gameId: 'g2', state: 'Finished (6:00)', result: 'Player bob is the winner', tableId: 't1' }),
        game('alice - bob', { matchId: 'm1', gameId: 'g3', state: 'Finished (7:00)', result: 'Player alice is the winner', tableId: 't1' }),
      ),
      1,
      players,
    )
    expect(matches).toHaveLength(1)
    expect(matches[0]).toMatchObject({
      key: 'match:m1',
      roundNum: 1,
      players: ['alice', 'bob'],
      rawPlayers: 'alice - bob',
      wins: [2, 1],
      draws: 0,
      live: false,
      finished: true,
      winner: 0,
      tableId: 't1',
      liveGameId: null,
      liveDuration: null,
    })
    expect(matches[0].games.map((g) => g.winner)).toEqual([0, 1, 0])
  })

  it('TRN-10: a match between two games is not finished while the round is not yet written to the results', () => {
    const [match] = groupRoundMatches(
      round(game('alice - bob', { matchId: 'm1', state: 'Finished (5:00)', result: 'Player alice is the winner' })),
      1,
      [player('alice'), player('bob')],
    )
    expect(match).toMatchObject({ wins: [1, 0], live: false, finished: false, winner: null })
  })

  it('TRN-10: a live game marks the match live with the game id and its duration', () => {
    const [match] = groupRoundMatches(
      round(
        game('alice - bob', { matchId: 'm1', result: 'Player alice is the winner' }),
        game('alice - bob', { matchId: 'm1', gameId: 'g2', state: 'Dueling (8:14)', result: '' }),
      ),
      1,
      players,
    )
    expect(match).toMatchObject({ live: true, finished: false, winner: null, liveGameId: 'g2', liveDuration: '8:14' })
    expect(match.games.map((g) => g.live)).toEqual([false, true])
  })

  it('TRN-10: a finished game without a duration has a null duration and the winner from the results', () => {
    const [match] = groupRoundMatches(
      round(game('alice - bob', { matchId: 'm1', state: 'Finished', result: 'Player bob is the winner' })),
      1,
      [player('alice', { results: 'R1 bob [0-1] ' }), player('bob', { results: 'R1 alice [1-0] ' })],
    )
    expect(match).toMatchObject({ finished: true, winner: 1, wins: [0, 1] })
    expect(match.games[0].duration).toBeNull()
  })

  it('TRN-10: a draw is no winner and counts as a drawn game', () => {
    const [match] = groupRoundMatches(
      round(game('alice - bob', { matchId: 'm1', state: 'Finished (9:00)', result: 'Game is a draw' })),
      1,
      [player('alice', { results: 'R1 bob [1-1-1] ' }), player('bob', { results: 'R1 alice [1-1-1] ' })],
    )
    expect(match).toMatchObject({ wins: [0, 0], draws: 1, finished: true, winner: null })
    expect(match.games[0].winner).toBe('draw')
  })

  it('TRN-10: the winner of a match with a quit is the one the round result names', () => {
    const [match] = groupRoundMatches(
      round(game('alice - bob', { matchId: 'm1', state: 'Finished', result: '' })),
      1,
      [player('alice', { results: 'R1 bob [1Q-0] ' }), player('bob', { results: 'R1 alice [0-1Q] ' })],
    )
    expect(match).toMatchObject({ finished: true, winner: 1, wins: [0, 0] })
  })

  it('TRN-10: a game listed with its players reversed still counts for the same side of the match', () => {
    const [match] = groupRoundMatches(
      round(
        game('alice - bob', { matchId: 'm1', result: 'Player alice is the winner' }),
        game('bob - alice', { matchId: 'm1', result: 'Player bob is the winner' }),
        game('alice - bob', { matchId: 'm1', result: 'Player alice is the winner' }),
      ),
      1,
      players,
    )
    expect(match.wins).toEqual([2, 1])
    expect(match.games.map((g) => g.winner)).toEqual([0, 1, 0])
  })

  it('TRN-10: games without a matchId group by their table, else by round and players', () => {
    const byTable = groupRoundMatches(
      round(game('alice - bob', { tableId: 't7' }), game('alice - bob', { tableId: 't7' }), game('alice - bob', { tableId: 't8' })),
      1,
      [],
    )
    expect(byTable.map((m) => m.games.length)).toEqual([2, 1])
    expect(byTable[0].tableId).toBe('t7')

    const byPlayers = groupRoundMatches(round(game('alice - bob'), game('alice - bob'), game('carol - dan')), 2, [])
    expect(byPlayers.map((m) => m.games.length)).toEqual([2, 1])
    expect(byPlayers.map((m) => m.roundNum)).toEqual([2, 2])
    expect(byPlayers[0].tableId).toBeNull()
  })

  it('TRN-10: a match whose players do not parse keeps its raw players, no winner, and is finished once no game runs', () => {
    const [match] = groupRoundMatches(
      round(game('no separator here', { matchId: 'm9', result: 'Player x is the winner' })),
      1,
      [],
    )
    expect(match).toMatchObject({ players: null, rawPlayers: 'no separator here', winner: null, finished: true })
  })
})

describe('TRN-12: the viewer finds their own match and standing', () => {
  const rounds = [
    round(
      game('alice - bob', { matchId: 'm1', result: 'Player alice is the winner' }),
    ),
    round(
      game('carol - alice', { matchId: 'm2', gameId: 'g9', state: 'Dueling (2:00)', result: '' }),
    ),
  ]
  const players = [
    player('alice', { points: 3, results: 'R1 bob [1-0] ' }),
    player('bob', { results: 'R1 alice [0-1] ' }),
    player('carol'),
  ]

  it('TRN-12: returns the latest match the viewer plays, with the round index and the viewer side', () => {
    const mine = findMyMatch(view({ rounds, players }), 'alice')
    expect(mine).not.toBeNull()
    expect(mine!.roundIndex).toBe(1)
    expect(mine!.side).toBe(1)
    expect(mine!.match).toMatchObject({ key: 'match:m2', players: ['carol', 'alice'], live: true, liveGameId: 'g9' })
  })

  it('TRN-12: finds the viewer in an earlier round when they played no later one', () => {
    expect(findMyMatch(view({ rounds, players }), 'bob')).toMatchObject({ roundIndex: 0, side: 1 })
  })

  it('TRN-12: a spectator or an unknown name has no match and is not a participant', () => {
    const v = view({ rounds, players })
    expect(findMyMatch(v, 'zed')).toBeNull()
    expect(isParticipant(v, 'alice')).toBe(true)
    expect(isParticipant(v, 'zed')).toBe(false)
  })

  it('TRN-12: reports the viewer rank, points and how many others share the points', () => {
    const standing = [
      player('alice', { points: 6 }),
      player('bob', { points: 3 }),
      player('carol', { points: 3 }),
      player('dan', { points: 0 }),
    ]
    expect(myStanding(view({ players: standing }), 'alice')).toEqual({ rank: 1, points: 6, tiedWith: 0 })
    expect(myStanding(view({ players: standing }), 'carol')).toEqual({ rank: 3, points: 3, tiedWith: 1 })
    expect(myStanding(view({ players: standing }), 'zed')).toBeNull()
  })

  it('TRN-12: the current round is the last one with a game', () => {
    expect(currentRoundIndex(view({ rounds }))).toBe(1)
    expect(currentRoundIndex(view({ rounds: [round(), round()] }))).toBe(-1)
    expect(currentRoundIndex(view({ rounds: [round(game('a - b')), round()] }))).toBe(0)
  })
})

describe('TRN-14: standings are ordered by points and keep the server order on ties', () => {
  it('TRN-14: sorts by points, keeping the server order on ties, without changing the input', () => {
    const input = [player('bob', { points: 3 }), player('alice', { points: 6 }), player('carol', { points: 3 }), player('dan')]
    const sorted = sortStandings(input)
    expect(sorted.map((p) => p.name)).toEqual(['alice', 'bob', 'carol', 'dan'])
    expect(input[0].name).toBe('bob')
    expect(sorted).not.toBe(input)
  })

  it('TRN-14: a standing rank is the position in that order, so tied players get different ranks', () => {
    const standing = [player('bob', { points: 3 }), player('alice', { points: 6 }), player('carol', { points: 3 })]
    expect(myStanding(view({ players: standing }), 'bob')).toEqual({ rank: 2, points: 3, tiedWith: 1 })
    expect(myStanding(view({ players: standing }), 'carol')).toEqual({ rank: 3, points: 3, tiedWith: 1 })
  })
})

describe('TRN-13: an elimination tournament is drawn as a bracket', () => {
  const r1 = round(
    game('p1 - p2', { matchId: 'a', result: 'Player p1 is the winner' }),
    game('p3 - p4', { matchId: 'b', result: 'Player p4 is the winner' }),
    game('p5 - p6', { matchId: 'c', result: 'Player p5 is the winner' }),
    game('p7 - p8', { matchId: 'd', result: 'Player p8 is the winner' }),
  )
  const eight = ['p1', 'p2', 'p3', 'p4', 'p5', 'p6', 'p7', 'p8'].map((name) => player(name))
  const names = (m: { players: [string, string] | null } | null) => (m?.players ? m.players.join(' vs ') : null)

  it('TRN-13: places round two matches where their players came from, whatever the server order', () => {
    const tree = eliminationTree(
      view({
        tournamentType: 'Booster Draft Elimination',
        players: eight,
        rounds: [
          r1,
          round(
            game('p5 - p8', { matchId: 'y', roundNum: 2 }),
            game('p1 - p4', { matchId: 'x', roundNum: 2 }),
          ),
        ],
      }),
    )
    expect(tree.columns.map((c) => c.roundNum)).toEqual([1, 2, 3])
    expect(tree.columns.map((c) => c.matches.length)).toEqual([4, 2, 1])
    expect(tree.columns[0].matches.map(names)).toEqual(['p1 vs p2', 'p3 vs p4', 'p5 vs p6', 'p7 vs p8'])
    expect(tree.columns[1].matches.map(names)).toEqual(['p1 vs p4', 'p5 vs p8'])
  })

  it('TRN-13: future rounds are empty placeholders sized by the number of seats', () => {
    const tree = eliminationTree(view({ tournamentType: 'Booster Draft Elimination', players: eight, rounds: [r1] }))
    expect(tree.columns.map((c) => c.matches.length)).toEqual([4, 2, 1])
    expect(tree.columns.slice(1).flatMap((c) => c.matches)).toEqual([null, null, null])
  })

  it('TRN-13: a match whose players are not found keeps its server order in the first free slot', () => {
    const tree = eliminationTree(
      view({
        tournamentType: 'Booster Draft Elimination',
        players: eight,
        rounds: [
          r1,
          round(game('p5 - p8', { matchId: 'y' }), game('x1 - x2', { matchId: 'z' })),
        ],
      }),
    )
    expect(tree.columns[1].matches.map(names)).toEqual(['x1 vs x2', 'p5 vs p8'])
  })

  it('TRN-13: a total of rounds in the type text sizes the columns', () => {
    const tree = eliminationTree(view({ tournamentType: 'Booster Draft Elimination 2 rounds', players: eight.slice(0, 4), rounds: [] }))
    expect(tree.columns.map((c) => c.matches.length)).toEqual([2, 1])
  })
})

describe('TRN-18: construction shows the time left and who is ready, and a finished tournament its podium', () => {
  it('TRN-18: a finished Swiss tournament has its top three by points', () => {
    const players = [
      player('carol', { points: 4 }),
      player('alice', { points: 9 }),
      player('bob', { points: 6 }),
      player('dan', { points: 6 }),
      player('eve', { points: 1 }),
    ]
    expect(podium(view({ tournamentType: 'Booster Draft Swiss', tournamentState: 'Finished', players }))).toEqual([
      { name: 'alice', points: 9 },
      { name: 'bob', points: 6 },
      { name: 'dan', points: 6 },
    ])
  })

  it('TRN-18: a finished elimination tournament has its champion, the winner of the final', () => {
    const rounds = [
      round(
        game('p1 - p2', { matchId: 'a', result: 'Player p1 is the winner' }),
        game('p3 - p4', { matchId: 'b', result: 'Player p4 is the winner' }),
      ),
      round(game('p1 - p4', { matchId: 'f', result: 'Player p4 is the winner' })),
    ]
    const finals = [
      player('p1', { points: 3, results: 'R1 p2 [1-0] R2 p4 [0-1] ' }),
      player('p2', { results: 'R1 p1 [0-1] ' }),
      player('p3', { results: 'R1 p4 [0-1] ' }),
      player('p4', { points: 6, results: 'R1 p3 [1-0] R2 p1 [1-0] ' }),
    ]
    expect(
      podium(view({ tournamentType: 'Booster Draft Elimination', tournamentState: 'Finished', rounds, players: finals })),
    ).toEqual([{ name: 'p4', points: 6 }])
  })

  it('TRN-18: a tournament that is still running has no podium', () => {
    const players = [player('alice', { points: 9 }), player('bob', { points: 6 })]
    expect(podium(view({ tournamentType: 'Booster Draft Swiss', tournamentState: 'Dueling', players }))).toEqual([])
    expect(podium(view({ tournamentType: 'Booster Draft Elimination', tournamentState: 'Dueling', players }))).toEqual([])
  })

  it('TRN-18: the construction time left counts down from the step start and rounds up', () => {
    const base = view({ tournamentState: 'Constructing', constructionTime: 600, stepStartTime: 1_000_000, serverTime: 1_060_000 })
    expect(constructionRemainingSeconds(base)).toBe(540)
    expect(constructionRemainingSeconds(base, 30_000)).toBe(510)
    expect(constructionRemainingSeconds({ ...base, serverTime: 1_060_500 })).toBe(540)
    expect(constructionRemainingSeconds({ ...base, serverTime: 1_700_000 })).toBe(0)
  })

  it('TRN-18: no construction countdown outside construction or without its data', () => {
    const constructing = view({ tournamentState: 'Constructing', constructionTime: 600, stepStartTime: 1_000_000, serverTime: 1_060_000 })
    expect(constructionRemainingSeconds({ ...constructing, tournamentState: 'Dueling' })).toBeNull()
    expect(constructionRemainingSeconds({ ...constructing, stepStartTime: null })).toBeNull()
    expect(constructionRemainingSeconds({ ...constructing, serverTime: undefined })).toBeNull()
    expect(constructionRemainingSeconds({ ...constructing, constructionTime: 0 })).toBeNull()
  })

  it('TRN-18: lists the players building and the ones ready while constructing', () => {
    const players = [
      player('alice', { state: 'Waiting for next round' }),
      player('bob', { state: 'Constructing' }),
      player('carol', { state: 'Constructing (Round Bye)' }),
      player('dan', { state: 'Joined' }),
    ]
    expect(readiness(view({ tournamentState: 'Constructing', players }))).toEqual({
      ready: ['alice'],
      building: ['bob', 'carol'],
    })
    expect(readiness(view({ tournamentState: 'Dueling', players }))).toEqual({ ready: [], building: [] })
  })
})

describe('TRN-10: only a game that is dueling is live', () => {
  it('TRN-10: a game in the Ready state with no result is not live and gets no watch', () => {
    const [match] = groupRoundMatches(
      round(game('alice - bob', { matchId: 'm1', state: 'Ready', result: '', tableId: 't1', gameId: 'g1' })),
      1,
      [player('alice'), player('bob')],
    )
    expect(match).toMatchObject({ live: false, liveGameId: null, liveDuration: null })
    expect(match.games[0].live).toBe(false)
  })

  it('TRN-10: a dueling game is live with its duration, whatever its result text', () => {
    const [match] = groupRoundMatches(
      round(game('alice - bob', { matchId: 'm1', state: 'Dueling (2:00)', result: 'Player alice is the winner', gameId: 'g1' })),
      1,
      [player('alice'), player('bob')],
    )
    expect(match).toMatchObject({ live: true, liveGameId: 'g1', liveDuration: '2:00' })
  })
})

describe('TRN-13: the winner of a finished match', () => {
  it('TRN-13: winnerOf names the winner of a finished match and nothing while it is open', () => {
    const [done] = groupRoundMatches(
      round(game('alice - bob', { matchId: 'm1', result: 'Player bob is the winner' })),
      1,
      [player('alice', { results: 'R1 bob [0-1] ' }), player('bob', { results: 'R1 alice [1-0] ' })],
    )
    expect(winnerOf(done)).toBe('bob')
    const [open] = groupRoundMatches(round(game('alice - bob', { matchId: 'm2', state: 'Dueling (1:00)' })), 1, [])
    expect(winnerOf(open)).toBeNull()
    expect(winnerOf(null)).toBeNull()
  })
})
