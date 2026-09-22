import { beforeEach, describe, expect, it, vi } from 'vitest'
import { awaitImageUrl, resetCardImageCache, cardKey, hasVigilance, hiddenFaceDownName } from './cardImages'
import type { CardView } from '../net/types'
import { setScryfallPacing } from './scryfallClient'

const card = {
  name: 'Forest',
  expansionSetCode: 'LEA',
  cardNumber: '299',
} as CardView

describe('card image cache', () => {
  beforeEach(() => {
    resetCardImageCache()
    vi.restoreAllMocks()
  })

  it('deduplicates concurrent requests and caches the result', async () => {
    let resolveFetch: ((value: unknown) => void) | undefined
    const response = new Promise((resolve) => {
      resolveFetch = resolve
    })
    const fetchMock = vi.fn(() => response)
    vi.stubGlobal('fetch', fetchMock)

    const first = awaitImageUrl(card)
    const second = awaitImageUrl(card)
    await new Promise((r) => setTimeout(r, 10))
    expect(fetchMock).toHaveBeenCalledTimes(1)
    resolveFetch?.({ ok: true, status: 200, json: async () => ({ image_uris: { normal: 'https://img.test/forest.jpg' } }) })

    await expect(first).resolves.toBe('https://img.test/forest.jpg')
    await expect(second).resolves.toBe('https://img.test/forest.jpg')
    await expect(awaitImageUrl(card)).resolves.toBe('https://img.test/forest.jpg')
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('retries an HTTP failure and clears the in-flight entry', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({ ok: false, status: 503 })
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ image_uris: { normal: 'https://img.test/retry.jpg' } }) })
    vi.stubGlobal('fetch', fetchMock)

    await expect(awaitImageUrl(card)).resolves.toBe('https://img.test/retry.jpg')
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('does not leave a rejected request cached forever', async () => {
    const fetchMock = vi.fn().mockRejectedValue(new Error('offline'))
    vi.stubGlobal('fetch', fetchMock)

    await expect(awaitImageUrl(card)).resolves.toBeNull()
    const callsAfterFirst = fetchMock.mock.calls.length
    await expect(awaitImageUrl(card)).resolves.toBeNull()
    expect(fetchMock.mock.calls.length).toBeGreaterThan(callsAfterFirst)
  })

  it('falls back to searching by card name if set/number lookup returns 404', async () => {
    const bloodCrypt = {
      name: 'Blood Crypt',
      expansionSetCode: 'UNKNOWN_SET',
      cardNumber: '999',
    } as CardView

    const fetchMock = vi.fn()
      .mockResolvedValueOnce({ ok: false, status: 404 }) // UNKNOWN_SET/999 -> 404
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ image_uris: { normal: 'https://img.test/blood_crypt.jpg' }, name: 'Blood Crypt' }),
      })
    vi.stubGlobal('fetch', fetchMock)

    await expect(awaitImageUrl(bloodCrypt)).resolves.toBe('https://img.test/blood_crypt.jpg')
    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(fetchMock).toHaveBeenNthCalledWith(1, 'https://api.scryfall.com/cards/UNKNOWN_SET/999?format=json', expect.anything())
    expect(fetchMock).toHaveBeenNthCalledWith(2, 'https://api.scryfall.com/cards/named?exact=Blood%20Crypt', expect.anything())
  })
})

describe('face-down and engine-owned images', () => {
  beforeEach(() => {
    resetCardImageCache()
  })

  const faceDown = (over: Record<string, unknown> = {}) =>
    ({ name: 'Morph: Den Protector', faceDown: true, expansionSetCode: 'XMAGE', cardNumber: '0', imageFileName: 'Morph', imageNumber: 2, controllerId: 'p1', ...over }) as unknown as CardView

  it('resolves a face-down permanent to the engine face-down image instead of nothing', () => {
    expect(cardKey(faceDown())).toBe('ta25/15')
    expect(cardKey(faceDown({ imageFileName: 'Manifest', imageNumber: 3 }))).toBe('tdsk/18')
    expect(cardKey(faceDown({ imageFileName: 'Cloak', imageNumber: 1 }))).toBe('tmkm/21')
  })

  it('keeps hidden hand cards without art', () => {
    expect(cardKey({ name: '?', faceDown: true, expansionSetCode: '', cardNumber: '0' } as unknown as CardView)).toBeNull()
  })

  it('resolves the engine Copy and Night images', () => {
    expect(cardKey({ name: 'Copy', expansionSetCode: 'XMAGE', imageFileName: 'Copy', imageNumber: 6, isToken: true } as unknown as CardView)).toBe('tlci/1')
    expect(cardKey({ name: 'Night', expansionSetCode: 'XMAGE', imageFileName: 'Night', imageNumber: 1, isToken: true } as unknown as CardView)).toBe('tvow/21#back')
  })

  it('exposes the real name the engine reveals to the controller', () => {
    expect(hiddenFaceDownName(faceDown())).toBe('Den Protector')
    expect(hiddenFaceDownName(faceDown({ name: 'Disguise: Unyielding Gatekeeper' }))).toBe('Unyielding Gatekeeper')
    expect(hiddenFaceDownName(faceDown({ name: '' }))).toBeNull()
    expect(hiddenFaceDownName(faceDown({ faceDown: false }))).toBeNull()
  })
})

describe('token image resolution', () => {
  beforeEach(() => {
    resetCardImageCache()
    vi.restoreAllMocks()
  })

  it('resolves a token to the exact Scryfall card from the engine table (set + name)', () => {
    const token = { name: 'Goblin Token', expansionSetCode: 'GRN', cardNumber: '0', isToken: true } as CardView
    expect(cardKey(token)).toBe('tgrn/4')
  })

  it('prefers imageFileName over the display name when the engine sends it', () => {
    const token = { name: 'Treasure Token', imageFileName: 'Treasure', expansionSetCode: 'LCI', cardNumber: '', isToken: true } as CardView
    expect(cardKey(token)).toBe('tlci/18')
  })

  it('uses imageNumber to pick the variant inside a set', () => {
    const base = { name: 'Treasure Token', imageFileName: 'Treasure', expansionSetCode: 'XLN', cardNumber: '', isToken: true }
    expect(cardKey({ ...base, imageNumber: 1 } as CardView)).toBe('txln/7')
    expect(cardKey({ ...base, imageNumber: 3 } as CardView)).toBe('txln/9')
    expect(cardKey({ ...base } as CardView)).toBe('txln/7')
  })

  it('never confuses a Treasure with the Dinosaur token of the same set', () => {
    const treasure = { name: 'Treasure Token', imageFileName: 'Treasure', expansionSetCode: 'LCI', isToken: true } as CardView
    const dino = { name: 'Dinosaur Token', imageFileName: 'Dinosaur', imageNumber: 1, expansionSetCode: 'LCI', isToken: true } as CardView
    expect(cardKey(treasure)).not.toBe(cardKey(dino))
    expect(cardKey(dino)).toBe('tlci/10')
  })

  it('pins the first variant seen per controller so all copies share one art', () => {
    const treasure = (id: string, imageNumber: number, controllerId: string) =>
      ({ id, name: 'Treasure Token', imageFileName: 'Treasure', imageNumber, expansionSetCode: 'XLN', isToken: true, controllerId }) as CardView
    expect(cardKey(treasure('a', 2, 'p1'))).toBe('txln/8')
    expect(cardKey(treasure('b', 4, 'p1'))).toBe('txln/8')
    expect(cardKey(treasure('c', 3, 'p1'))).toBe('txln/8')
    expect(cardKey(treasure('d', 4, 'p2'))).toBe('txln/10')
  })

  it('keeps tokens of different sets of the same controller apart (deck printings are respected)', () => {
    const treasure = (set: string) =>
      ({ name: 'Treasure Token', imageFileName: 'Treasure', expansionSetCode: set, isToken: true, controllerId: 'p1' }) as CardView
    expect(cardKey(treasure('LCI'))).toBe('tlci/18')
    expect(cardKey(treasure('RNA'))).toBe('trna/12')
  })

  it('resolves the back face of a double-faced token', () => {
    const token = { name: 'Goblin Token', imageFileName: 'Goblin', expansionSetCode: 'GK1', isToken: true, isSecondCardFace: true } as unknown as CardView
    expect(cardKey(token)).toBe('tgk1/3#back')
  })

  it('falls back to the name slug when the set is not in the engine table', () => {
    const token = { name: 'Goblin Token', expansionSetCode: 'ZZZ', cardNumber: '0', isToken: true } as CardView
    expect(cardKey(token)).toBe('tzzz/goblin')
  })

  it('returns null for XMAGE set tokens (special/helper)', () => {
    const token = { name: 'Face Down', expansionSetCode: 'XMAGE', cardNumber: '0', isToken: true } as CardView
    expect(cardKey(token)).toBeNull()
  })

  it('copy token uses original card number for standard lookup', () => {
    // Copy token inherits the original's set + number (not "0")
    const copy = { name: 'Lightning Bolt', expansionSetCode: 'M10', cardNumber: '147', isToken: true } as unknown as CardView
    expect(cardKey(copy)).toBe('M10/147')
  })

  it('returns null for token without setCode', () => {
    const token = { name: 'Goblin Token', cardNumber: '0', isToken: true } as CardView
    expect(cardKey(token)).toBeNull()
  })

  it('returns null for token without name', () => {
    const token = { expansionSetCode: 'GRN', cardNumber: '0', isToken: true } as CardView
    expect(cardKey(token)).toBeNull()
  })

  it('returns null for face-down token with no identifiable name', () => {
    const token = { expansionSetCode: 'XMAGE', cardNumber: '0', isToken: true } as CardView
    expect(cardKey(token)).toBeNull()
  })

  it('fetches token image from Scryfall', async () => {
    const token = { name: 'Goblin Token', expansionSetCode: 'GRN', cardNumber: '0', isToken: true } as CardView
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true, status: 200,
      json: async () => ({ image_uris: { normal: 'https://img.test/goblin.jpg' }, name: 'Goblin' }),
    })
    vi.stubGlobal('fetch', fetchMock)

    await expect(awaitImageUrl(token)).resolves.toBe('https://img.test/goblin.jpg')
    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.scryfall.com/cards/tgrn/4?format=json',
      expect.anything(),
    )
  })

  it('falls back to name without "Token" suffix on 404', async () => {
    const token = { name: 'Goblin Token', expansionSetCode: 'GRN', cardNumber: '0', isToken: true } as CardView
    // el token se resuelve por la tabla del motor (tgrn/4) — sin fallback por nombre
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true, status: 200,
      json: async () => ({ image_uris: { normal: 'https://img.test/goblin.jpg' }, name: 'Goblin' }),
    })
    vi.stubGlobal('fetch', fetchMock)

    await expect(awaitImageUrl(token)).resolves.toBe('https://img.test/goblin.jpg')
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.scryfall.com/cards/tgrn/4?format=json',
      expect.anything(),
    )
  })
})

describe('ability image and metadata resolution', () => {
  beforeEach(() => {
    resetCardImageCache()
    vi.restoreAllMocks()
  })

  it('builds named Scryfall key for triggered ability card', () => {
    const ability = {
      name: 'Goblin Guide',
      mageObjectType: 'TRIGGERED_ABILITY',
      rules: ['Whenever Goblin Guide attacks, defending player reveals the top card of library.'],
    } as CardView
    expect(cardKey(ability)).toBe('named:Goblin Guide')
  })

  it('extracts source card name from rules when card name is "Ability"', () => {
    const ability = {
      name: 'Ability',
      mageObjectType: 'TRIGGERED_ABILITY',
      rules: ['When Cloud, Midgar Mercenary enters, search your library for an Equipment card, reveal it, put it into your hand, then shuffle.'],
    } as CardView
    expect(cardKey(ability)).toBe('named:Cloud, Midgar Mercenary')
  })

  it('uses sourceCard object when present on StackAbilityView', () => {
    const ability = {
      name: 'Ability',
      mageObjectType: 'TRIGGERED_ABILITY',
      sourceCard: {
        name: 'Dark Confidant',
        expansionSetCode: 'RAV',
        cardNumber: '81',
      },
      rules: ['At the beginning of your upkeep, reveal the top card of your library...'],
    } as unknown as CardView
    expect(cardKey(ability)).toBe('RAV/81')
  })

  it('builds named Scryfall key for cards with only a name (e.g. from action feed)', () => {
    const feedCard = { name: 'Lightning Bolt' } as CardView
    expect(cardKey(feedCard)).toBe('named:Lightning Bolt')
  })
})

describe('Scryfall compliance', () => {
  beforeEach(() => {
    resetCardImageCache()
    vi.restoreAllMocks()
  })

  it('sends Accept header and spaces Scryfall requests by the shared client pacing', async () => {
    setScryfallPacing({ spacingMs: 100 })
    const a = { name: 'Lightning Bolt', expansionSetCode: 'M10', cardNumber: '146' } as CardView
    const b = { name: 'Counterspell', expansionSetCode: 'MMQ', cardNumber: '67' } as CardView
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true, status: 200,
      json: async () => ({ image_uris: { normal: 'https://img.test/x.jpg' }, name: 'x' }),
      headers: { get: () => null },
    } as unknown as Response)
    vi.stubGlobal('fetch', fetchMock)

    const t0 = Date.now()
    await awaitImageUrl(a)
    await awaitImageUrl(b)
    const elapsed = Date.now() - t0
    expect(elapsed).toBeGreaterThanOrEqual(90)
    expect(fetchMock).toHaveBeenCalledTimes(2)
    for (const [, opts] of fetchMock.mock.calls) {
      expect((opts as RequestInit).headers).toMatchObject({ Accept: 'application/json' })
    }
  })

  it('retries after 429 using Retry-After header', async () => {
    const card429 = { name: 'Forest', expansionSetCode: 'LEA', cardNumber: '299' } as CardView
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({ ok: false, status: 429, headers: { get: (k: string) => k === 'Retry-After' ? '0' : null } } as unknown as Response)
      .mockResolvedValueOnce({
        ok: true, status: 200,
        json: async () => ({ image_uris: { normal: 'https://img.test/forest429.jpg' }, name: 'Forest' }),
        headers: { get: () => null },
      } as unknown as Response)
    vi.stubGlobal('fetch', fetchMock)

    await expect(awaitImageUrl(card429)).resolves.toBe('https://img.test/forest429.jpg')
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })
})

describe('double-faced and transform card resolution', () => {
  beforeEach(() => {
    resetCardImageCache()
    vi.restoreAllMocks()
  })

  it('builds distinct cardKeys for front face and second/back face', () => {
    const front = {
      name: 'Delver of Secrets',
      expansionSetCode: 'ISD',
      cardNumber: '51',
    } as unknown as CardView

    const back = {
      name: 'Insectile Aberration',
      expansionSetCode: 'ISD',
      cardNumber: '51',
      isSecondCardFace: true,
    } as unknown as CardView

    expect(cardKey(front)).toBe('ISD/51')
    expect(cardKey(back)).toBe('ISD/51#back')
  })

  it('resolves front face and back face image URLs from Scryfall card_faces', async () => {
    const front = {
      name: 'Delver of Secrets',
      expansionSetCode: 'ISD',
      cardNumber: '51',
    } as unknown as CardView

    const back = {
      name: 'Insectile Aberration',
      expansionSetCode: 'ISD',
      cardNumber: '51',
      isSecondCardFace: true,
    } as unknown as CardView

    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        name: 'Delver of Secrets // Insectile Aberration',
        card_faces: [
          {
            name: 'Delver of Secrets',
            image_uris: { normal: 'https://img.test/delver_front.jpg' },
          },
          {
            name: 'Insectile Aberration',
            image_uris: { normal: 'https://img.test/delver_back.jpg' },
          },
        ],
      }),
    })
    vi.stubGlobal('fetch', fetchMock)

    // Request front
    const frontUrl = await awaitImageUrl(front)
    expect(frontUrl).toBe('https://img.test/delver_front.jpg')

    // Request back - should use back face image and avoid duplicate network calls
    const backUrl = await awaitImageUrl(back)
    expect(backUrl).toBe('https://img.test/delver_back.jpg')
  })
})

describe('hasVigilance', () => {
  it('detects vigilance in rules text with word boundaries', () => {
    expect(hasVigilance({ name: 'Oakheaven Sentinel', rules: ['Vigilance'] } as unknown as CardView)).toBe(true)
    expect(hasVigilance({ name: 'Centaur Courser', rules: ['Vigilance, trample'] } as unknown as CardView)).toBe(true)
  })

  it('detects vigilance in ability objects', () => {
    expect(
      hasVigilance({ name: 'Yosei', abilities: [{ rule: 'Vigilance' }] } as unknown as CardView)
    ).toBe(true)
  })

  it('does not match partial words or unrelated text', () => {
    expect(hasVigilance({ name: 'Vigilant Sentry', rules: ["Attacking doesn't cause this to tap"] } as unknown as CardView)).toBe(false)
    expect(hasVigilance({ name: 'Goblin Piledriver', rules: ['Provoke'] } as unknown as CardView)).toBe(false)
  })

  it('returns false for null/undefined or cards without text', () => {
    expect(hasVigilance(null)).toBe(false)
    expect(hasVigilance(undefined)).toBe(false)
    expect(hasVigilance({} as CardView)).toBe(false)
  })
})


