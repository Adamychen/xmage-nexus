import type { RoundView, TournamentGameView, TournamentPlayerView, TournamentView } from '../../net/types'
import { parseGamePlayers, parseGameState, parseGameWinner, parsePlayerResults, parsePlayerState, parseTournamentTypeText, tournamentPhase, type RoundResult } from './parse'
import { eliminationRoundCount } from './tournamentType'

export interface MatchGameSummary {
  winner: 0 | 1 | 'draw' | null
  live: boolean
  duration: string | null
}

export interface MatchSummary {
  key: string
  roundNum: number
  players: [string, string] | null
  rawPlayers: string
  wins: [number, number]
  draws: number
  games: MatchGameSummary[]
  live: boolean
  finished: boolean
  winner: 0 | 1 | null
  tableId: string | null
  liveGameId: string | null
  liveDuration: string | null
}

export interface MyMatch {
  match: MatchSummary
  roundIndex: number
  side: 0 | 1
}

export interface Standing {
  rank: number
  points: number
  tiedWith: number
}

export interface EliminationColumn {
  roundNum: number
  matches: (MatchSummary | null)[]
}

export interface PodiumEntry {
  name: string
  points: number
}

interface ParsedGame {
  game: TournamentGameView
  players: [string, string] | null
  duration: string | null
  live: boolean
}

function matchKeyOf(game: TournamentGameView, roundNum: number): string {
  if (game.matchId) return `match:${game.matchId}`
  if (game.tableId) return `table:${game.tableId}`
  return `round:${roundNum}:${game.players}`
}

function sideOf(winner: 0 | 1 | 'draw' | null, gamePlayers: [string, string] | null, matchPlayers: [string, string] | null): 0 | 1 | 'draw' | null {
  if (winner === null || winner === 'draw') return winner
  if (!gamePlayers || !matchPlayers) return null
  const name = gamePlayers[winner]
  if (name === matchPlayers[0]) return 0
  if (name === matchPlayers[1]) return 1
  return null
}

function roundEntry(name: string, roundNum: number, players: TournamentPlayerView[]): RoundResult | null | undefined {
  const player = players.find((p) => p.name === name)
  if (!player || player.results === undefined) return undefined
  const results = parsePlayerResults(player.results)
  if (results === null) return undefined
  return results.find((r) => r.round === roundNum) ?? null
}

function playerHasRound(name: string, roundNum: number, players: TournamentPlayerView[]): boolean | null {
  const player = players.find((p) => p.name === name)
  if (!player || player.results === undefined) return null
  const results = parsePlayerResults(player.results)
  if (results === null) return null
  return results.some((r) => r.round === roundNum)
}

function summarize(key: string, roundNum: number, games: TournamentGameView[], players: TournamentPlayerView[]): MatchSummary {
  const parsed: ParsedGame[] = games.map((game) => {
    const state = parseGameState(game.state)
    const gamePlayers = parseGamePlayers(game.players)
    const live = state.phase === 'dueling'
    return { game, players: gamePlayers, duration: state.duration, live }
  })
  const matchPlayers = parsed.find((p) => p.players !== null)?.players ?? null
  const liveGame = parsed.find((p) => p.live)
  const live = liveGame !== undefined

  const summaries: MatchGameSummary[] = parsed.map((p) => {
    const winner = p.players ? parseGameWinner(p.game.result, p.players) : null
    return { winner: sideOf(winner, p.players, matchPlayers), live: p.live, duration: p.duration }
  })
  const wins: [number, number] = [0, 0]
  let draws = 0
  for (const game of summaries) {
    if (game.winner === 0) wins[0]++
    else if (game.winner === 1) wins[1]++
    else if (game.winner === 'draw') draws++
  }

  const seen = matchPlayers
    ? [playerHasRound(matchPlayers[0], roundNum, players), playerHasRound(matchPlayers[1], roundNum, players)]
    : [null, null]
  const finished = !live && parsed.length > 0 && seen.every((s) => s !== false)

  let winner: 0 | 1 | null = null
  if (finished && matchPlayers) {
    const entry = roundEntry(matchPlayers[0], roundNum, players)
    if (entry) {
      if (entry.outcome === 'win') winner = 0
      else if (entry.outcome === 'loss') winner = 1
    } else if (entry === undefined) {
      if (wins[0] > wins[1]) winner = 0
      else if (wins[1] > wins[0]) winner = 1
    }
  }

  return {
    key,
    roundNum,
    players: matchPlayers,
    rawPlayers: games[0].players,
    wins,
    draws,
    games: summaries,
    live,
    finished,
    winner,
    tableId: games.find((g) => g.tableId)?.tableId || null,
    liveGameId: liveGame?.game.gameId || null,
    liveDuration: liveGame?.duration ?? null,
  }
}

/** Games of one round grouped into matches by matchId, else tableId, else round and players. */
export function groupRoundMatches(round: RoundView, roundNum: number, players: TournamentPlayerView[]): MatchSummary[] {
  const groups = new Map<string, TournamentGameView[]>()
  for (const game of round.games) {
    const key = matchKeyOf(game, roundNum)
    const list = groups.get(key)
    if (list) list.push(game)
    else groups.set(key, [game])
  }
  return [...groups].map(([key, games]) => summarize(key, roundNum, games, players))
}

export function sortStandings(players: readonly TournamentPlayerView[]): TournamentPlayerView[] {
  return [...players].sort((a, b) => b.points - a.points)
}

export function currentRoundIndex(view: TournamentView): number {
  for (let i = view.rounds.length - 1; i >= 0; i--) {
    if (view.rounds[i].games.length > 0) return i
  }
  return -1
}

export function findMyMatch(view: TournamentView, username: string): MyMatch | null {
  for (let i = view.rounds.length - 1; i >= 0; i--) {
    const matches = groupRoundMatches(view.rounds[i], i + 1, view.players)
    for (let j = matches.length - 1; j >= 0; j--) {
      const match = matches[j]
      if (!match.players) continue
      const side = match.players[0] === username ? 0 : match.players[1] === username ? 1 : null
      if (side !== null) return { match, roundIndex: i, side }
    }
  }
  return null
}

export function isParticipant(view: TournamentView, username: string): boolean {
  return view.players.some((p) => p.name === username)
}

export function myStanding(view: TournamentView, username: string): Standing | null {
  const me = view.players.find((p) => p.name === username)
  if (!me) return null
  const rank = sortStandings(view.players).indexOf(me) + 1
  const tiedWith = view.players.filter((p) => p !== me && p.points === me.points).length
  return { rank, points: me.points, tiedWith }
}

function feederSlot(match: MatchSummary, previous: (MatchSummary | null)[]): number | null {
  if (!match.players) return null
  for (const name of match.players) {
    const position = previous.findIndex((m) => m?.players?.includes(name) ?? false)
    if (position >= 0) return Math.floor(position / 2)
  }
  return null
}

/**
 * Rounds as columns of a bracket: each column has half the matches of the one before, and a match
 * sits in the slot its players came from (slots 2j and 2j+1 of the previous column feed slot j).
 */
export function eliminationTree(view: TournamentView): { columns: EliminationColumn[] } {
  const totalRounds =
    parseTournamentTypeText(view.tournamentType).totalRounds ??
    (view.players.length > 1 ? eliminationRoundCount(view.players.length) : 0)
  const roundCount = Math.max(view.rounds.length, totalRounds)
  const columns: EliminationColumn[] = []
  let previous: (MatchSummary | null)[] = []
  for (let i = 0; i < roundCount; i++) {
    const roundNum = i + 1
    const matches = i < view.rounds.length ? groupRoundMatches(view.rounds[i], roundNum, view.players) : []
    const expected = totalRounds > 0 ? Math.max(1, 2 ** (totalRounds - 1 - i)) : 0
    const size = Math.max(expected, matches.length)
    const slots: (MatchSummary | null)[] = Array.from({ length: size }, () => null)
    const unplaced: MatchSummary[] = []
    matches.forEach((match, k) => {
      const slot = i === 0 ? k : feederSlot(match, previous)
      if (slot !== null && slot < size && slots[slot] === null) slots[slot] = match
      else unplaced.push(match)
    })
    let next = 0
    for (const match of unplaced) {
      while (next < size && slots[next] !== null) next++
      if (next < size) slots[next] = match
    }
    columns.push({ roundNum, matches: slots })
    previous = slots
  }
  return { columns }
}

export function winnerOf(match: MatchSummary | null): string | null {
  if (!match || !match.finished || match.winner === null || !match.players) return null
  return match.players[match.winner]
}

export function podium(view: TournamentView): PodiumEntry[] {
  if (tournamentPhase(view.tournamentState) !== 'finished') return []
  const toEntry = (name: string): PodiumEntry => ({ name, points: view.players.find((p) => p.name === name)?.points ?? 0 })
  if (view.tournamentType.includes('Swiss')) {
    return sortStandings(view.players).slice(0, 3).map((p) => toEntry(p.name))
  }
  if (view.tournamentType.includes('Elimination')) {
    const last = view.rounds[view.rounds.length - 1]
    if (!last) return []
    const matches = groupRoundMatches(last, view.rounds.length, view.players)
    if (matches.length !== 1) return []
    const final = matches[0]
    if (!final.finished || final.winner === null || !final.players) return []
    return [toEntry(final.players[final.winner])]
  }
  return []
}

/**
 * Seconds of construction left. `nowMs` is the ms elapsed since the snapshot (added to serverTime).
 * Null when the tournament is not constructing, has no construction clock or lacks timestamps.
 */
export function constructionRemainingSeconds(view: TournamentView, nowMs = 0): number | null {
  if (tournamentPhase(view.tournamentState) !== 'constructing') return null
  if (!(view.constructionTime > 0) || view.stepStartTime == null || view.serverTime === undefined) return null
  const elapsedSeconds = (view.serverTime + nowMs - view.stepStartTime) / 1000
  return Math.max(0, Math.ceil(view.constructionTime - elapsedSeconds))
}

export function readiness(view: TournamentView): { ready: string[]; building: string[] } {
  const ready: string[] = []
  const building: string[] = []
  if (tournamentPhase(view.tournamentState) !== 'constructing') return { ready, building }
  for (const player of view.players) {
    const kind = parsePlayerState(player.state).kind
    if (kind === 'waiting') ready.push(player.name)
    else if (kind === 'constructing') building.push(player.name)
  }
  return { ready, building }
}
