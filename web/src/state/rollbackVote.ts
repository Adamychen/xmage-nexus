import type { GameView } from '../net/types'
import { getState, setState } from './state'

export type RollbackVoterStatus = 'requested' | 'pending' | 'accepted' | 'denied'
export type RollbackVoteOutcome = 'voting' | 'applied' | 'denied' | 'failed'

export interface RollbackVoter {
  name: string
  status: RollbackVoterStatus
  me: boolean
}

export interface RollbackVote {
  gameId: string
  requester: string
  requesterUserId?: string
  requestedByMe: boolean
  turns: number
  requestedAtTurn: number
  voters: RollbackVoter[]
  myVote: 'pending' | 'accepted' | 'denied' | null
  outcome: RollbackVoteOutcome
  deniedBy?: string
  failReason?: string
  appliedTurn?: number
  hidden: boolean
  startedAt: number
}

export const ROLLBACK_ACCEPT_ACTION = 'ADD_PERMISSION_TO_ROLLBACK_TURN'
export const ROLLBACK_DENY_ACTION = 'DENY_PERMISSION_TO_ROLLBACK_TURN'
export const ROLLBACK_ACCEPT_CHAT = 'accepted the rollback request'
export const ROLLBACK_PENDING_TTL_MS = 120_000

const ANNOUNCE_RE = /rolling back to start of turn\s+(\d+)/i
const DENIED_RE = /rollback request denied by\s+(.+)$/i
const FAILED_RE = /not possible to rollback|only request a rollback|not available for rollback/i

export function stripTags(text: string): string {
  return text.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim()
}

const sameName = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase()

export function parseRollbackTurns(message: string): number {
  const text = stripTags(message)
  if (/current turn/i.test(text)) return 0
  if (/previous turn/i.test(text)) return 1
  const m = /rollback\s+(\d+)\s+turns?/i.exec(text)
  return m ? Number(m[1]) : 0
}

export function isRollbackRequest(buttons: { action: string }[]): boolean {
  return buttons.some((b) => b.action === ROLLBACK_ACCEPT_ACTION)
}

function buildVoters(game: GameView | null, requester: string): RollbackVoter[] {
  const players = (game?.players ?? []).filter((p) => p.isHuman !== false && !p.hasLeft)
  const voters: RollbackVoter[] = [{ name: requester, status: 'requested', me: players.some((p) => p.controlled && sameName(p.name, requester)) }]
  for (const p of players) {
    if (sameName(p.name, requester)) continue
    voters.push({ name: p.name, status: 'pending', me: !!p.controlled })
  }
  return voters
}

export function startOwnRollbackVote(gameId: string, turns: number): void {
  const game = getState().game
  const me = game?.players?.find((p) => p.controlled)
  const requester = me?.name ?? ''
  const voters = buildVoters(game, requester)
  setState({
    rollbackVote: {
      gameId,
      requester,
      requestedByMe: true,
      turns,
      requestedAtTurn: game?.turn ?? 0,
      voters,
      myVote: null,
      outcome: 'voting',
      hidden: false,
      startedAt: Date.now(),
    },
  })
}

export function startIncomingRollbackVote(gameId: string, requester: string, message: string, requesterUserId?: string): void {
  const game = getState().game
  setState({
    rollbackVote: {
      gameId,
      requester,
      requesterUserId,
      requestedByMe: false,
      turns: parseRollbackTurns(message),
      requestedAtTurn: game?.turn ?? 0,
      voters: buildVoters(game, requester),
      myVote: 'pending',
      outcome: 'voting',
      hidden: false,
      startedAt: Date.now(),
    },
  })
}

function update(gameId: string | null | undefined, fn: (v: RollbackVote) => RollbackVote | null): void {
  const v = getState().rollbackVote
  if (!v || !gameId || v.gameId !== gameId) return
  const next = fn(v)
  if (next !== v) setState({ rollbackVote: next })
}

function setVoter(v: RollbackVote, name: string, status: RollbackVoterStatus): RollbackVote {
  let found = false
  const voters = v.voters.map((x) => {
    if (!sameName(x.name, name) || x.status === 'requested') return x
    found = true
    return x.status === status ? x : { ...x, status }
  })
  return found ? { ...v, voters } : v
}

export function markMyVote(gameId: string, vote: 'accepted' | 'denied'): void {
  update(gameId, (v) => ({
    ...v,
    myVote: vote,
    voters: v.voters.map((x) => (x.me && x.status !== 'requested' ? { ...x, status: vote } : x)),
    ...(vote === 'denied' ? { outcome: 'denied' as const, deniedBy: v.voters.find((x) => x.me)?.name } : null),
  }))
}

export function applyRollbackOutcome(gameId: string | null | undefined, turn: number): void {
  update(gameId, (v) => {
    if (v.outcome === 'applied' && v.appliedTurn === turn) return v
    if (v.outcome !== 'voting' && v.outcome !== 'applied') return v
    return {
      ...v,
      outcome: 'applied',
      appliedTurn: turn,
      hidden: false,
      voters: v.voters.map((x) => (x.status === 'pending' ? { ...x, status: 'accepted' } : x)),
    }
  })
}

export function ingestRollbackServerMessage(message: string, gameId: string | null | undefined): void {
  const text = stripTags(message)
  const announce = ANNOUNCE_RE.exec(text)
  if (announce) {
    applyRollbackOutcome(gameId, Number(announce[1]))
    return
  }
  const denied = DENIED_RE.exec(text)
  if (denied) {
    const name = denied[1].trim()
    update(gameId, (v) => (v.outcome !== 'voting' ? v : { ...setVoter(v, name, 'denied'), outcome: 'denied', deniedBy: name, hidden: false }))
    return
  }
  if (FAILED_RE.test(text)) {
    update(gameId, (v) => (v.outcome !== 'voting' ? v : { ...v, outcome: 'failed', failReason: text, hidden: false }))
  }
}

export function rollbackAcceptChatText(turn: number, now = new Date()): string {
  const hh = String(now.getHours()).padStart(2, '0')
  const mm = String(now.getMinutes()).padStart(2, '0')
  const ss = String(now.getSeconds()).padStart(2, '0')
  return `${ROLLBACK_ACCEPT_CHAT} (turn ${turn}, ${hh}:${mm}:${ss})`
}

export function isRollbackAcceptChat(message: string): boolean {
  const text = stripTags(message).toLowerCase()
  return text === ROLLBACK_ACCEPT_CHAT || text.startsWith(`${ROLLBACK_ACCEPT_CHAT} (`)
}

export function ingestRollbackChat(username: string | undefined, message: string, gameId: string | null | undefined): void {
  if (!username || !isRollbackAcceptChat(message)) return
  update(gameId, (v) => (v.outcome !== 'voting' ? v : setVoter(v, username, 'accepted')))
}

export function hideRollbackVote(): void {
  const v = getState().rollbackVote
  if (v && !v.hidden) setState({ rollbackVote: { ...v, hidden: true } })
}

export function dismissRollbackVote(): void {
  if (getState().rollbackVote) setState({ rollbackVote: null })
}

export function isRollbackVoteBlocking(v: RollbackVote | null): boolean {
  return !!v && !v.hidden
}

export function isRollbackVoting(v: RollbackVote | null, gameId: string | null | undefined): boolean {
  return !!v && v.outcome === 'voting' && v.gameId === gameId
}
