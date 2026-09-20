import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { resetScryfallClient, scryfallFetch, scryfallJson, setScryfallPacing } from './scryfallClient'
import { fetchCardJson } from './scryfallCards'

function ok(body: unknown): Response {
  return { ok: true, status: 200, json: async () => body, headers: { get: () => null } } as unknown as Response
}

function status(code: number, headers: Record<string, string> = {}): Response {
  return { ok: false, status: code, json: async () => ({}), headers: { get: (k: string) => headers[k] ?? null } } as unknown as Response
}

describe('scryfallFetch', () => {
  beforeEach(() => {
    resetScryfallClient()
  })
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.useRealTimers()
  })

  it('spaces requests by the configured minimum and caps concurrency', async () => {
    setScryfallPacing({ spacingMs: 50, maxConcurrent: 2 })
    const starts: number[] = []
    let inFlight = 0
    let peak = 0
    vi.stubGlobal('fetch', vi.fn(async () => {
      starts.push(Date.now())
      inFlight++
      peak = Math.max(peak, inFlight)
      await new Promise((r) => setTimeout(r, 120))
      inFlight--
      return ok({})
    }))

    await Promise.all(Array.from({ length: 5 }, (_, i) => scryfallFetch(`https://api.scryfall.com/cards/x/${i}`)))

    expect(peak).toBeLessThanOrEqual(2)
    for (let i = 1; i < starts.length; i++) {
      expect(starts[i] - starts[i - 1]).toBeGreaterThanOrEqual(45)
    }
  })

  it('always sends the Accept header', async () => {
    const fetchMock = vi.fn(async () => ok({}))
    vi.stubGlobal('fetch', fetchMock)
    await scryfallFetch('https://api.scryfall.com/cards/a/1')
    const init = (fetchMock.mock.calls[0] as unknown as [string, RequestInit])[1]
    expect(init.headers).toMatchObject({ Accept: 'application/json' })
  })

  it('pauses every queued request after a 429 and honours Retry-After', async () => {
    setScryfallPacing({ spacingMs: 0, maxConcurrent: 1 })
    const times: number[] = []
    const responses = [status(429, { 'Retry-After': '1' }), ok({ n: 1 }), ok({ n: 2 })]
    vi.stubGlobal('fetch', vi.fn(async () => {
      times.push(Date.now())
      return responses.shift()!
    }))

    const t0 = Date.now()
    const [a, b] = await Promise.all([
      scryfallFetch('https://api.scryfall.com/cards/a/1'),
      scryfallFetch('https://api.scryfall.com/cards/a/2'),
    ])

    expect(a.status).toBe(200)
    expect(b.status).toBe(200)
    expect(times).toHaveLength(3)
    expect(times[1] - t0).toBeGreaterThanOrEqual(950)
    expect(times[2] - times[1]).toBeLessThan(500)
  })

  it('gives up after maxAttempts and returns the 429 to the caller', async () => {
    setScryfallPacing({ spacingMs: 0, maxAttempts: 2 })
    const fetchMock = vi.fn(async () => status(429, { 'Retry-After': '0' }))
    vi.stubGlobal('fetch', fetchMock)
    const res = await scryfallFetch('https://api.scryfall.com/cards/a/1')
    expect(res.status).toBe(429)
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('lets urgent requests jump ahead of queued background ones', async () => {
    setScryfallPacing({ spacingMs: 0, maxConcurrent: 1 })
    const order: string[] = []
    vi.stubGlobal('fetch', vi.fn(async (url: string) => {
      order.push(url.split('/').pop()!)
      await new Promise((r) => setTimeout(r, 10))
      return ok({})
    }))

    const first = scryfallFetch('https://api.scryfall.com/cards/a/first')
    const bg = scryfallFetch('https://api.scryfall.com/cards/a/background')
    const urgent = scryfallFetch('https://api.scryfall.com/cards/a/urgent', { urgent: true })
    await Promise.all([first, bg, urgent])

    expect(order).toEqual(['first', 'urgent', 'background'])
  })

  it('rejects with AbortError and never fetches when the signal is already aborted', async () => {
    const fetchMock = vi.fn(async () => ok({}))
    vi.stubGlobal('fetch', fetchMock)
    const ctrl = new AbortController()
    ctrl.abort()
    await expect(scryfallFetch('https://api.scryfall.com/cards/a/1', { signal: ctrl.signal })).rejects.toMatchObject({ name: 'AbortError' })
    expect(fetchMock).not.toHaveBeenCalled()
  })
})

describe('scryfallJson', () => {
  beforeEach(() => {
    resetScryfallClient()
    setScryfallPacing({ spacingMs: 0 })
  })
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('deduplicates in-flight requests and serves repeats from memory', async () => {
    const fetchMock = vi.fn(async () => ok({ name: 'Bolt' }))
    vi.stubGlobal('fetch', fetchMock)
    const url = 'https://api.scryfall.com/cards/m10/146?format=json'

    const [a, b] = await Promise.all([scryfallJson(url), scryfallJson(url)])
    const c = await scryfallJson(url)

    expect(a).toEqual({ name: 'Bolt' })
    expect(b).toEqual({ name: 'Bolt' })
    expect(c).toEqual({ name: 'Bolt' })
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('remembers a 404 so the same missing printing is not asked twice', async () => {
    const fetchMock = vi.fn(async () => status(404))
    vi.stubGlobal('fetch', fetchMock)
    const url = 'https://api.scryfall.com/cards/zzz/1/es?format=json'
    expect(await scryfallJson(url)).toBeNull()
    expect(await scryfallJson(url)).toBeNull()
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('does not cache transient failures', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(status(500))
      .mockResolvedValueOnce(ok({ name: 'Bolt' }))
    vi.stubGlobal('fetch', fetchMock)
    const url = 'https://api.scryfall.com/cards/m10/146?format=json'
    expect(await scryfallJson(url)).toBeNull()
    expect(await scryfallJson(url)).toEqual({ name: 'Bolt' })
  })

  it('never throws on network errors', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => { throw new TypeError('Failed to fetch') }))
    expect(await scryfallJson('https://api.scryfall.com/cards/a/1')).toBeNull()
  })

  it('keeps only the fields the web uses from a full card object', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ok({
      object: 'card',
      name: 'Bolt',
      prices: { usd: '1.00' },
      related_uris: { gatherer: 'x' },
      image_uris: { small: 's', normal: 'n', large: 'l', png: 'p', art_crop: 'a', border_crop: 'b' },
      card_faces: [{ name: 'Front', flavor_text: 'f', image_uris: { normal: 'fn', png: 'fp' } }],
      legalities: { modern: 'legal' },
    })))
    const data = await scryfallJson<Record<string, unknown>>('https://api.scryfall.com/cards/m10/146?format=json')
    expect(data).toEqual({
      object: 'card',
      name: 'Bolt',
      image_uris: { small: 's', normal: 'n', art_crop: 'a' },
      card_faces: [{ name: 'Front', image_uris: { normal: 'fn' } }],
      legalities: { modern: 'legal' },
    })
  })
})

describe('fetchCardJson', () => {
  beforeEach(() => {
    resetScryfallClient()
    setScryfallPacing({ spacingMs: 0 })
  })
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('tries the localized printing first and falls back to English', async () => {
    const urls: string[] = []
    vi.stubGlobal('fetch', vi.fn(async (url: string) => {
      urls.push(url)
      return url.includes('/es?') ? status(404) : ok({ name: 'Bolt' })
    }))
    const data = await fetchCardJson({ cardName: 'Lightning Bolt', setCode: 'M10', cardNumber: '146' }, { lang: 'es' })
    expect(data).toEqual({ name: 'Bolt' })
    expect(urls).toEqual([
      'https://api.scryfall.com/cards/m10/146/es?format=json',
      'https://api.scryfall.com/cards/m10/146?format=json',
    ])
  })

  it('uses the exact-name endpoint when the entry has no printing', async () => {
    const fetchMock = vi.fn(async () => ok({ name: 'Sol Ring' }))
    vi.stubGlobal('fetch', fetchMock)
    await fetchCardJson({ cardName: 'Sol Ring', setCode: '', cardNumber: '' })
    expect((fetchMock.mock.calls[0] as unknown as [string])[0]).toBe('https://api.scryfall.com/cards/named?exact=Sol%20Ring')
  })

  it('falls back to the name only when asked to', async () => {
    const urls: string[] = []
    vi.stubGlobal('fetch', vi.fn(async (url: string) => {
      urls.push(url)
      return url.includes('/named') ? ok({ name: 'Sol Ring' }) : status(404)
    }))
    const card = { cardName: 'Sol Ring', setCode: 'ZZZ', cardNumber: '9' }
    expect(await fetchCardJson(card)).toBeNull()
    expect(await fetchCardJson(card, { fallbackToName: true })).toEqual({ name: 'Sol Ring' })
  })
})
