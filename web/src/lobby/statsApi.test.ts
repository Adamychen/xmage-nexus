import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest'
import { fetchRanking, fetchMatches, StatsApiError, STATS_TIMEOUT_MS } from './statsApi'

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
}

describe('statsApi', () => {
  let fetchMock: ReturnType<typeof vi.fn>

  beforeEach(() => {
    fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.useRealTimers()
  })

  describe('fetchRanking', () => {
    it('accepts the ops generator shape that names the player user', async () => {
      fetchMock.mockResolvedValueOnce(jsonResponse(200, {
        generatedAt: '2026-10-17T10:00:00Z',
        players: [{ user: 'bob', constructed: 1200, limited: null, matches: 3, lastSeen: null }],
      }))

      const result = await fetchRanking('limited')

      expect(result.players).toEqual([{ username: 'bob', rating: 0, matches: 3, lastSeen: null }])
    })

    it('returns the parsed ranking and requests the relative ranking file', async () => {
      const file = {
        generatedAt: '2026-10-17T10:00:00Z',
        players: [
          { username: 'alice', constructed: 1650, limited: 800, general: 1600, matches: 30, tourneys: 0, lastSeen: '2026-10-16T09:00:00Z' },
        ],
      }
      fetchMock.mockResolvedValueOnce(jsonResponse(200, file))

      const result = await fetchRanking('constructed')

      expect(result).toEqual({
        format: 'constructed',
        updatedAt: '2026-10-17T10:00:00Z',
        players: [{ username: 'alice', rating: 1650, matches: 30, lastSeen: '2026-10-16T09:00:00Z' }],
      })
      const url = String(fetchMock.mock.calls[0][0])
      expect(url).toMatch(/^\/ranking\.json$/)
    })

    it('throws not_ready on 503 with the error code', async () => {
      fetchMock.mockResolvedValueOnce(jsonResponse(503, { error: 'not_ready' }))

      const err = await fetchRanking('limited').catch((e: unknown) => e)

      expect(err).toBeInstanceOf(StatsApiError)
      expect(err).toMatchObject({ code: 'not_ready', status: 503 })
    })

    it('throws bad_format on 400 with the error code', async () => {
      fetchMock.mockResolvedValueOnce(jsonResponse(400, { error: 'bad_format' }))

      const err = await fetchRanking('constructed').catch((e: unknown) => e)

      expect(err).toMatchObject({ code: 'bad_format', status: 400 })
    })

    it('falls back to http_error when a non-2xx body is not JSON', async () => {
      fetchMock.mockResolvedValueOnce(new Response('<html>', { status: 502 }))

      const err = await fetchRanking('constructed').catch((e: unknown) => e)

      expect(err).toMatchObject({ code: 'http_error', status: 502 })
    })

    it('rejects a 200 whose body has no players array', async () => {
      fetchMock.mockResolvedValueOnce(jsonResponse(200, { format: 'constructed' }))

      const err = await fetchRanking('constructed').catch((e: unknown) => e)

      expect(err).toMatchObject({ code: 'bad_response' })
    })

    it('throws timeout when the request does not answer within the limit', async () => {
      vi.useFakeTimers()
      fetchMock.mockImplementationOnce(
        (_url: string, init: RequestInit) =>
          new Promise((_resolve, reject) => {
            init.signal?.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')))
          }),
      )

      const pending = fetchRanking('constructed').catch((e: unknown) => e)
      await vi.advanceTimersByTimeAsync(STATS_TIMEOUT_MS)
      const err = await pending

      expect(err).toBeInstanceOf(StatsApiError)
      expect(err).toMatchObject({ code: 'timeout', status: null })
    })

    it('throws network when fetch itself fails', async () => {
      fetchMock.mockRejectedValueOnce(new TypeError('Failed to fetch'))

      const err = await fetchRanking('constructed').catch((e: unknown) => e)

      expect(err).toMatchObject({ code: 'network', status: null })
    })
  })

  describe('fetchMatches', () => {
    it('returns the matches and sends the limit', async () => {
      const body = { updatedAt: '2026-10-17T10:00:00Z', matches: [{ tableId: 't1', matchName: 'Friday', result: 'alice won' }] }
      fetchMock.mockResolvedValueOnce(jsonResponse(200, body))

      const result = await fetchMatches(20)

      expect(result.matches).toHaveLength(1)
      expect(String(fetchMock.mock.calls[0][0])).toBe('/api/matches?limit=20')
    })

    it('throws not_ready on 503', async () => {
      fetchMock.mockResolvedValueOnce(jsonResponse(503, { error: 'not_ready' }))

      const err = await fetchMatches(10).catch((e: unknown) => e)

      expect(err).toMatchObject({ code: 'not_ready', status: 503 })
    })

    it('carries the error code on 400', async () => {
      fetchMock.mockResolvedValueOnce(jsonResponse(400, { error: 'bad_format' }))

      const err = await fetchMatches(10).catch((e: unknown) => e)

      expect(err).toMatchObject({ code: 'bad_format', status: 400 })
    })
  })
})
