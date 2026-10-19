import type { MatchView } from '../net/types'

export type RankingFormat = 'constructed' | 'limited'

export interface RankingPlayer {
  username: string
  rating: number
  matches: number
  lastSeen: string | null
}

// Entries of the published ranking.json. The deployed file names the player `username`;
// ops/status/ranking.mjs names it `user`, so both are accepted.
interface RankingFileEntry {
  username?: string
  user?: string
  constructed: number | null
  limited: number | null
  matches: number
  lastSeen: string | null
}

export interface RankingResponse {
  format: RankingFormat
  updatedAt: string
  players: RankingPlayer[]
}

export interface MatchesResponse {
  updatedAt: string
  matches: MatchView[]
}

export const STATS_TIMEOUT_MS = 8000

export class StatsApiError extends Error {
  readonly code: string
  readonly status: number | null

  constructor(code: string, status: number | null) {
    super(code)
    this.name = 'StatsApiError'
    this.code = code
    this.status = status
  }
}

function statsUrl(path: string, query: URLSearchParams): string {
  const base = ((import.meta.env.VITE_STATS_API_BASE as string | undefined) ?? '').replace(/\/+$/, '')
  const qs = query.toString()
  return qs ? `${base}${path}?${qs}` : `${base}${path}`
}

function errorCode(body: unknown): string | null {
  if (body && typeof body === 'object' && 'error' in body && typeof body.error === 'string') return body.error
  return null
}

async function getJson(path: string, query: URLSearchParams): Promise<unknown> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), STATS_TIMEOUT_MS)
  try {
    const res = await fetch(statsUrl(path, query), {
      headers: { Accept: 'application/json' },
      signal: controller.signal,
    })
    const text = await res.text()
    let body: unknown = null
    try {
      body = JSON.parse(text)
    } catch {
      body = null
    }
    if (!res.ok) throw new StatsApiError(errorCode(body) ?? 'http_error', res.status)
    return body
  } catch (err) {
    if (err instanceof StatsApiError) throw err
    throw new StatsApiError(controller.signal.aborted ? 'timeout' : 'network', null)
  } finally {
    clearTimeout(timer)
  }
}

export async function fetchRanking(format: RankingFormat): Promise<RankingResponse> {
  const body = await getJson('/ranking.json', new URLSearchParams())
  if (!body || typeof body !== 'object' || !('players' in body) || !Array.isArray(body.players)) {
    throw new StatsApiError('bad_response', 200)
  }
  const generatedAt = 'generatedAt' in body && typeof body.generatedAt === 'string' ? body.generatedAt : ''
  const players = (body.players as RankingFileEntry[])
    .map((entry): RankingPlayer => {
      const value = format === 'limited' ? entry.limited : entry.constructed
      return {
        username: entry.username ?? entry.user ?? '',
        rating: typeof value === 'number' ? value : 0,
        matches: typeof entry.matches === 'number' ? entry.matches : 0,
        lastSeen: entry.lastSeen ?? null,
      }
    })
    .filter((player) => player.username !== '')
    .sort((a, b) => b.rating - a.rating || a.username.localeCompare(b.username, undefined, { sensitivity: 'base' }))
  return { format, updatedAt: generatedAt, players }
}

export async function fetchMatches(limit: number): Promise<MatchesResponse> {
  const body = await getJson('/api/matches', new URLSearchParams({ limit: String(limit) }))
  if (!body || typeof body !== 'object' || !('matches' in body) || !Array.isArray(body.matches)) {
    throw new StatsApiError('bad_response', 200)
  }
  return body as MatchesResponse
}
