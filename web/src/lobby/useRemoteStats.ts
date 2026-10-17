import { useCallback, useEffect, useRef, useState } from 'react'
import { fetchMatches, fetchRanking, StatsApiError, type MatchesResponse, type RankingFormat, type RankingResponse } from './statsApi'

export const STATS_CACHE_TTL_MS = 30_000

export type RemoteStatus = 'loading' | 'ready' | 'not_ready' | 'error'

export interface RemoteState<T> {
  data: T | null
  status: RemoteStatus
  refresh: () => void
}

const cache = new Map<string, { at: number; data: unknown }>()

export function clearRemoteStatsCache(): void {
  cache.clear()
}

function readFresh<T>(key: string): T | null {
  const hit = cache.get(key)
  if (!hit || Date.now() - hit.at > STATS_CACHE_TTL_MS) return null
  return hit.data as T
}

function statusOf(err: unknown): RemoteStatus {
  return err instanceof StatsApiError && err.code === 'not_ready' ? 'not_ready' : 'error'
}

function useCachedResource<T>(key: string, load: () => Promise<T>): RemoteState<T> {
  const [state, setState] = useState<{ data: T | null; status: RemoteStatus }>(() => {
    const hit = readFresh<T>(key)
    return hit ? { data: hit, status: 'ready' } : { data: null, status: 'loading' }
  })
  const [nonce, setNonce] = useState(0)
  const forceRef = useRef(false)

  useEffect(() => {
    const hit = forceRef.current ? null : readFresh<T>(key)
    forceRef.current = false
    if (hit) {
      setState({ data: hit, status: 'ready' })
      return
    }
    let alive = true
    setState((prev) => ({ data: prev.data, status: 'loading' }))
    load().then(
      (data) => {
        cache.set(key, { at: Date.now(), data })
        if (alive) setState({ data, status: 'ready' })
      },
      (err: unknown) => {
        if (alive) setState((prev) => ({ data: prev.data, status: statusOf(err) }))
      },
    )
    return () => {
      alive = false
    }
  }, [key, load, nonce])

  const refresh = useCallback(() => {
    forceRef.current = true
    setNonce((n) => n + 1)
  }, [])

  return { data: state.data, status: state.status, refresh }
}

export function useRemoteRanking(format: RankingFormat): RemoteState<RankingResponse> {
  const load = useCallback(() => fetchRanking(format), [format])
  return useCachedResource(`ranking:${format}`, load)
}

export function useRemoteMatches(limit: number): RemoteState<MatchesResponse> {
  const load = useCallback(() => fetchMatches(limit), [limit])
  return useCachedResource(`matches:${limit}`, load)
}
