export type GamePhase = 'dueling' | 'finished' | 'other'

export type ResultMark = 'Q' | 'T' | 'I'

export type RoundOutcome = 'win' | 'loss' | 'draw' | 'bye'

export interface RoundResult {
  round: number
  bye: boolean
  opponent: string | null
  wins: number
  losses: number
  draws: number
  selfMark: ResultMark | null
  opponentMark: ResultMark | null
  outcome: RoundOutcome
}

export type PlayerStateKind =
  | 'joined'
  | 'drafting'
  | 'constructing'
  | 'dueling'
  | 'sideboarding'
  | 'waiting'
  | 'eliminated'
  | 'canceled'
  | 'finished'
  | 'other'

export interface PlayerState {
  kind: PlayerStateKind
  info: string | null
  raw: string
}

export type TournamentPhase = 'waiting' | 'drafting' | 'constructing' | 'dueling' | 'sideboarding' | 'finished' | 'other'

export interface ProfileHistory {
  matches: string
  matchQuitPct: string
  tourneys: string
  tourneyQuitPct: string
  constructedRating: string
  limitedRating: string
}

export interface TournamentTypeText {
  type: string
  deckType: string | null
  totalRounds: number | null
}

/** Players of a tournament game, `alice - bob`. Splits on the first ` - ` so names may contain spaces. */
export function parseGamePlayers(players: string): [string, string] | null {
  const at = players.indexOf(' - ')
  if (at < 0) return null
  return [players.slice(0, at), players.slice(at + 3)]
}

/** `Dueling (8:14)`, `Finished (1:02:03)` or `Finished`; anything else is phase `other`. */
export function parseGameState(state: string): { phase: GamePhase; duration: string | null; raw: string } {
  const match = /^([A-Za-z]+)(?:\s*\(([^()]*)\))?$/.exec(state.trim())
  const word = match?.[1].toLowerCase()
  const phase: GamePhase = word === 'dueling' ? 'dueling' : word === 'finished' ? 'finished' : 'other'
  const inner = match?.[2]?.trim()
  const duration = phase === 'other' || !inner ? null : inner
  return { phase, duration, raw: state }
}

/** `Player <name> is the winner` gives the index of that name; `Game is a draw` gives 'draw'. */
export function parseGameWinner(result: string | undefined, players: [string, string]): 0 | 1 | 'draw' | null {
  const text = (result ?? '').trim()
  if (text === '') return null
  if (text === 'Game is a draw') return 'draw'
  const match = /^Player (.+) is the winner$/.exec(text)
  if (!match) return null
  if (match[1] === players[0]) return 0
  if (match[1] === players[1]) return 1
  return null
}

const SCORE_ENTRY = /^(.+) \[(\d+)(Q|T|I)?-(\d+)(Q|T|I)?(?:-(\d+))?\]$/

function toMark(value: string | undefined): ResultMark | null {
  return value === 'Q' || value === 'T' || value === 'I' ? value : null
}

function outcomeOf(wins: number, losses: number, selfMark: ResultMark | null, opponentMark: ResultMark | null): RoundOutcome {
  if (opponentMark) return 'win'
  if (selfMark) return 'loss'
  if (wins > losses) return 'win'
  if (wins < losses) return 'loss'
  return 'draw'
}

function parseEntryBody(round: number, body: string): RoundResult | null {
  if (body === 'Bye') {
    return { round, bye: true, opponent: null, wins: 0, losses: 0, draws: 0, selfMark: null, opponentMark: null, outcome: 'bye' }
  }
  const match = SCORE_ENTRY.exec(body)
  if (!match) return null
  const wins = Number(match[2])
  const losses = Number(match[4])
  const draws = match[6] === undefined ? 0 : Number(match[6])
  const selfMark = toMark(match[3])
  const opponentMark = toMark(match[5])
  return {
    round,
    bye: false,
    opponent: match[1],
    wins,
    losses,
    draws,
    selfMark,
    opponentMark,
    outcome: outcomeOf(wins, losses, selfMark, opponentMark),
  }
}

function takeEntry(round: number, body: string): { result: RoundResult; rest: string } | null {
  const cuts: number[] = []
  for (const match of body.matchAll(/(?= R\d+ )/g)) {
    if (match.index !== undefined) cuts.push(match.index)
  }
  cuts.push(body.length)
  for (const cut of cuts) {
    const result = parseEntryBody(round, body.slice(0, cut).trim())
    if (result) return { result, rest: body.slice(cut).trimStart() }
  }
  return null
}

/**
 * `R1 chen [2-0] R2 dara [1-2Q] R3 Bye ` (own wins first, then the opponent's; Q/T/I mark a quit).
 * Returns [] when empty and null when any part does not parse, so the caller can show the raw text.
 */
export function parsePlayerResults(results: string | undefined): RoundResult[] | null {
  const text = (results ?? '').trim()
  if (text === '') return []
  const out: RoundResult[] = []
  let rest = text
  while (rest !== '') {
    const head = /^R(\d+) /.exec(rest)
    if (!head) return null
    const entry = takeEntry(Number(head[1]), rest.slice(head[0].length))
    if (!entry) return null
    out.push(entry.result)
    rest = entry.rest
  }
  return out
}

const PLAYER_STATES: { text: string; kind: PlayerStateKind }[] = [
  { text: 'Joined', kind: 'joined' },
  { text: 'Drafting', kind: 'drafting' },
  { text: 'Constructing', kind: 'constructing' },
  { text: 'Dueling', kind: 'dueling' },
  { text: 'Sideboarding', kind: 'sideboarding' },
  { text: 'Waiting for next round', kind: 'waiting' },
  { text: 'Eliminated', kind: 'eliminated' },
  { text: 'Canceled', kind: 'canceled' },
  { text: 'Finished', kind: 'finished' },
]

function infoOf(after: string): string | null {
  const rest = after.trim()
  if (rest === '') return null
  const group = /^\(([^()]*)\)$/.exec(rest)
  return (group ? group[1] : rest).trim() || null
}

/** Base text, then an optional ` (<info>)` and a disconnect suffix kept in `info`. */
export function parsePlayerState(state: string): PlayerState {
  const text = state.trim()
  const lower = text.toLowerCase()
  for (const { text: base, kind } of PLAYER_STATES) {
    if (lower.startsWith(base.toLowerCase())) {
      return { kind, info: infoOf(text.slice(base.length)), raw: state }
    }
  }
  return { kind: 'other', info: null, raw: state }
}

const PROFILE_HISTORY = /^Matches: (\d+) \(([\d.]+)%\), Tourneys: (\d+) \(([\d.]+)%\), Constructed Rating: (-?\d+), Limited Rating: (-?\d+)$/

export function parseProfileHistory(history: string | undefined): ProfileHistory | null {
  const match = PROFILE_HISTORY.exec((history ?? '').trim())
  if (!match) return null
  return {
    matches: match[1],
    matchQuitPct: match[2],
    tourneys: match[3],
    tourneyQuitPct: match[4],
    constructedRating: match[5],
    limitedRating: match[6],
  }
}

/**
 * `Constructed Swiss / Constructed - Modern 3 rounds` gives type, deck type and total rounds;
 * a text without those parts is its own type.
 */
export function parseTournamentTypeText(text: string): TournamentTypeText {
  let rest = text.trim()
  let totalRounds: number | null = null
  const rounds = /^(.*?)\s+(\d+) rounds?$/.exec(rest)
  if (rounds) {
    totalRounds = Number(rounds[2])
    rest = rounds[1]
  }
  let deckType: string | null = null
  const deck = rest.indexOf(' / ')
  if (deck >= 0) {
    deckType = rest.slice(deck + 3).trim() || null
    rest = rest.slice(0, deck)
  }
  return { type: rest.trim() || text, deckType, totalRounds }
}

export function tournamentPhase(tournamentState: string): TournamentPhase {
  const state = tournamentState.toLowerCase()
  if (/waiting|starting|ready/.test(state)) return 'waiting'
  if (state.includes('draft')) return 'drafting'
  if (state.includes('construct')) return 'constructing'
  if (state.includes('duel')) return 'dueling'
  if (state.includes('sideboard')) return 'sideboarding'
  if (state.includes('finish') || state.includes('end')) return 'finished'
  return 'other'
}
