import type { MatchView } from '../net/types'

export type RankingFormat = 'constructed' | 'limited'

export interface RankingPlayer {
  username: string
  rating: number
  ranked: boolean
}

interface RankingFileEntry {
  username: string
  constructed: number | null
  limited: number | null
  matches: number
}

const BASE_RATING = 800
const MIN_RANKED_MATCHES = 20

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
  return `${base}${path}?${query.toString()}`
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
      const rating = typeof value === 'number' ? value : 0
      return {
        username: entry.username,
        rating,
        ranked: rating > BASE_RATING && entry.matches >= MIN_RANKED_MATCHES,
      }
    })
    .sort((a, b) => {
      if (a.ranked !== b.ranked) return a.ranked ? -1 : 1
      if (a.ranked) return b.rating - a.rating || a.username.localeCompare(b.username, undefined, { sensitivity: 'base' })
      return a.username.localeCompare(b.username, undefined, { sensitivity: 'base' })
    })
  return { format, updatedAt: generatedAt, players }
}

export async function fetchMatches(limit: number): Promise<MatchesResponse> {
  const body = await getJson('/api/matches', new URLSearchParams({ limit: String(limit) }))
  if (!body || typeof body !== 'object' || !('matches' in body) || !Array.isArray(body.matches)) {
    throw new StatsApiError('bad_response', 200)
  }
  return body as MatchesResponse
}
