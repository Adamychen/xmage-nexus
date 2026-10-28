import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { onScryfallThrottle, resetScryfallClient, scryfallFetch, scryfallJson, scryfallThrottleMs, setScryfallPacing } from './scryfallClient'
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

describe('DCK-11 request slots', () => {
  beforeEach(() => {
    resetScryfallClient()
  })
  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })

  it('DCK-11: a request that never answers gives its slot back after the default timeout', async () => {
    vi.useFakeTimers()
    setScryfallPacing({ spacingMs: 0, maxConcurrent: 1 })
    vi.stubGlobal('fetch', vi.fn((url: string, init: RequestInit) => url.endsWith('/hang')
      ? new Promise((_, reject) => init.signal?.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError'))))
      : Promise.resolve(ok({}))))

    const hung = scryfallFetch('https://api.scryfall.com/cards/a/hang')
    const next = scryfallFetch('https://api.scryfall.com/cards/a/next')
    hung.catch(() => {})
    let nextAnswered = false
    void next.then(() => { nextAnswered = true })

    await vi.advanceTimersByTimeAsync(30_000)

    expect(nextAnswered).toBe(true)
  })
})

describe('DCK-11 rate limit and urgent order', () => {
  beforeEach(() => {
    resetScryfallClient()
  })
  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })

  it('DCK-11: urgent requests are sent in the order they were asked for', async () => {
    setScryfallPacing({ spacingMs: 0, maxConcurrent: 1 })
    const order: string[] = []
    vi.stubGlobal('fetch', vi.fn(async (url: string) => {
      order.push(url.split('/').pop()!)
      return ok({})
    }))

    await Promise.all(['first', 'second', 'third'].map((name) =>
      scryfallFetch(`https://api.scryfall.com/cards/a/${name}`, { urgent: true })))

    expect(order).toEqual(['first', 'second', 'third'])
  })

  it('DCK-11: a 429 the browser reports as a network error pauses the shared queue', async () => {
    vi.useFakeTimers()
    setScryfallPacing({ spacingMs: 0, maxConcurrent: 1 })
    const starts: number[] = []
    vi.stubGlobal('fetch', vi.fn(async () => {
      starts.push(Date.now())
      if (starts.length === 1) throw new TypeError('Failed to fetch')
      return ok({})
    }))

    const first = scryfallFetch('https://api.scryfall.com/cards/a/1').catch((err: unknown) => err)
    const second = scryfallFetch('https://api.scryfall.com/cards/a/2')
    await vi.advanceTimersByTimeAsync(5000)

    expect(await first).toBeInstanceOf(TypeError)
    expect(await second).toMatchObject({ ok: true })
    expect(starts[1] - starts[0]).toBeGreaterThanOrEqual(1900)
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

describe('estado de limitación (429)', () => {
  beforeEach(() => {
    resetScryfallClient()
  })
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('expone la pausa pendiente y avisa a los suscriptores', async () => {
    setScryfallPacing({ spacingMs: 0, maxConcurrent: 1, maxAttempts: 1 })
    vi.stubGlobal('fetch', vi.fn(async () => status(429, { 'Retry-After': '2' })))
    const seen: number[] = []
    const off = onScryfallThrottle((ms) => seen.push(ms))

    const res = await scryfallFetch('https://api.scryfall.com/cards/a/1')

    expect(res.status).toBe(429)
    expect(seen.length).toBe(1)
    expect(seen[0]).toBeGreaterThan(1000)
    expect(scryfallThrottleMs()).toBeGreaterThan(1000)
    off()
  })

  it('no deja pausa pendiente cuando no hay 429', async () => {
    setScryfallPacing({ spacingMs: 0, maxConcurrent: 1 })
    vi.stubGlobal('fetch', vi.fn(async () => ok({})))
    await scryfallFetch('https://api.scryfall.com/cards/a/1')
    expect(scryfallThrottleMs()).toBe(0)
  })
})

describe('DCK-11 network errors pause only background requests', () => {
  beforeEach(() => {
    resetScryfallClient()
  })
  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })

  it('DCK-11: ten network errors in one burst open a single pause window, late failures do not extend it', async () => {
    vi.useFakeTimers()
    setScryfallPacing({ spacingMs: 0, maxConcurrent: 10 })
    const t0 = Date.now()
    const started: Record<string, number> = {}
    vi.stubGlobal('fetch', vi.fn((url: string) => {
      const name = url.split('/').pop()!
      started[name] = Date.now()
      if (name === 'after') return Promise.resolve(ok({}))
      const failAfter = Number(name.replace('fail', '')) * 100
      return new Promise<Response>((_, reject) => setTimeout(() => reject(new TypeError('Failed to fetch')), failAfter))
    }))

    const burst = Array.from({ length: 10 }, (_, i) => scryfallFetch(`https://api.scryfall.com/cards/a/fail${i}`).catch((e: unknown) => e))
    const after = scryfallFetch('https://api.scryfall.com/cards/a/after')
    await vi.advanceTimersByTimeAsync(5000)

    expect(await Promise.all(burst)).toHaveLength(10)
    expect(await after).toMatchObject({ ok: true })
    expect(started.after - t0).toBe(2000)
  })

  it('DCK-11: repeated network errors back the background queue off, 2 s doubling up to 30 s', async () => {
    vi.useFakeTimers()
    setScryfallPacing({ spacingMs: 0, maxConcurrent: 1 })
    const starts: number[] = []
    vi.stubGlobal('fetch', vi.fn(async () => {
      starts.push(Date.now())
      throw new TypeError('Failed to fetch')
    }))

    const requests = Array.from({ length: 6 }, (_, i) => scryfallFetch(`https://api.scryfall.com/cards/a/${i}`).catch((e: unknown) => e))
    await vi.advanceTimersByTimeAsync(60_000)

    expect(await Promise.all(requests)).toHaveLength(6)
    expect(starts.slice(1).map((at, i) => at - starts[i])).toEqual([2000, 4000, 8000, 16000, 30000])
  })

  it('DCK-11: a successful response ends the back-off, the next network error opens a 2 s window again', async () => {
    vi.useFakeTimers()
    setScryfallPacing({ spacingMs: 0, maxConcurrent: 1 })
    const starts: number[] = []
    let calls = 0
    vi.stubGlobal('fetch', vi.fn(async () => {
      starts.push(Date.now())
      calls++
      if (calls % 2 === 1) throw new TypeError('Failed to fetch')
      return ok({})
    }))

    const requests = Array.from({ length: 4 }, (_, i) => scryfallFetch(`https://api.scryfall.com/cards/a/${i}`).catch((e: unknown) => e))
    await vi.advanceTimersByTimeAsync(10_000)

    expect(await Promise.all(requests)).toHaveLength(4)
    expect(starts[2] - starts[1]).toBe(0)
    expect(starts[3] - starts[2]).toBe(2000)
  })

  it('DCK-11: an urgent request is sent during a network pause while a background one waits it out', async () => {
    vi.useFakeTimers()
    setScryfallPacing({ spacingMs: 0, maxConcurrent: 1 })
    const t0 = Date.now()
    const started: Record<string, number> = {}
    vi.stubGlobal('fetch', vi.fn(async (url: string) => {
      const name = url.split('/').pop()!
      started[name] = Date.now()
      if (name === 'first') throw new TypeError('Failed to fetch')
      return ok({})
    }))

    await scryfallFetch('https://api.scryfall.com/cards/a/first').catch(() => {})
    const second = scryfallFetch('https://api.scryfall.com/cards/a/second')
    const urgent = scryfallFetch('https://api.scryfall.com/cards/a/urgent', { urgent: true })
    await vi.advanceTimersByTimeAsync(3000)

    expect(await urgent).toMatchObject({ ok: true })
    expect(await second).toMatchObject({ ok: true })
    expect(started.urgent - t0).toBe(0)
    expect(started.second - t0).toBe(2000)
  })

  it('DCK-11: an urgent caller that joins a queued background lookup of the same card is not held by the pause', async () => {
    vi.useFakeTimers()
    setScryfallPacing({ spacingMs: 0, maxConcurrent: 1 })
    const t0 = Date.now()
    const url = 'https://api.scryfall.com/cards/a/shared?format=json'
    const starts: number[] = []
    vi.stubGlobal('fetch', vi.fn(async (u: string) => {
      if (u.endsWith('/first?format=json')) throw new TypeError('Failed to fetch')
      starts.push(Date.now())
      return ok({ name: 'Shared' })
    }))

    await scryfallFetch('https://api.scryfall.com/cards/a/first?format=json').catch(() => {})
    const background = scryfallJson(url)
    const urgent = scryfallJson(url, { urgent: true })
    await vi.advanceTimersByTimeAsync(3000)

    expect(await urgent).toEqual({ name: 'Shared' })
    expect(await background).toEqual({ name: 'Shared' })
    expect(starts).toEqual([t0])
  })
})
