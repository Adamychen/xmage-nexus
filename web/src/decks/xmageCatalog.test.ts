import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { setGateway } from '../net/commands'
import type { Gateway } from '../net/Gateway'
import { resetXmageCatalogCache, xmageImplemented, xmagePrintingsFor, xmagePrintingsOf } from './xmageCatalog'

// Fake gateway: queries go through the real net/commands, so these tests also
// pin the payload the proxy receives.
const send = vi.fn()

beforeEach(() => {
  send.mockReset()
  resetXmageCatalogCache()
  setGateway({ send } as unknown as Gateway)
})

afterEach(() => setGateway(null))

const ok = (data: unknown) => ({ ok: true, data })

describe('xmagePrintingsFor', () => {
  it('does not ask the proxy for an empty list', async () => {
    expect(await xmagePrintingsFor([])).toEqual(new Map())
    expect(send).not.toHaveBeenCalled()
  })

  it('keys by lowercase name and drops what XMage does not have', async () => {
    send.mockResolvedValue(ok({
      ready: true,
      results: [
        { name: 'Lightning Bolt', found: true, cardName: 'Lightning Bolt', setCode: 'M10', cardNumber: '146' },
        { name: ' Fire // Ice ', found: true, setCode: 'APC', cardNumber: '128' },
        { name: 'Not A Card', found: false },
        { name: 'Half Resolved', found: true, setCode: 'XXX' },
      ],
    }))

    const map = await xmagePrintingsFor(['Lightning Bolt', ' Fire // Ice ', 'Not A Card', 'Half Resolved'])

    expect(send).toHaveBeenCalledWith('resolvePrintings', {
      names: ['Lightning Bolt', ' Fire // Ice ', 'Not A Card', 'Half Resolved'],
      strategy: 'default',
      setCode: undefined,
    })
    expect([...map!.keys()]).toEqual(['lightning bolt', 'fire // ice'])
    expect(map!.get('lightning bolt')).toEqual({ cardName: 'Lightning Bolt', setCode: 'M10', cardNumber: '146' })
    // Without a canonical cardName it keeps the requested name.
    expect(map!.get('fire // ice')!.cardName).toBe(' Fire // Ice ')
  })

  it('forwards the strategy and the set', async () => {
    send.mockResolvedValue(ok({ ready: true, results: [] }))
    await xmagePrintingsFor(['Lightning Bolt'], 'set', 'LEA')
    expect(send).toHaveBeenCalledWith('resolvePrintings', { names: ['Lightning Bolt'], strategy: 'set', setCode: 'LEA' })
  })

  it.each([
    ['proxy card DB not ready', ok({ ready: false, results: [] })],
    ['response without results', ok({ ready: true })],
    ['command rejected', { ok: false, error: 'unknown action' }],
  ])('returns null (Scryfall fallback) when: %s', async (_label, response) => {
    send.mockResolvedValue(response)
    expect(await xmagePrintingsFor(['Lightning Bolt'])).toBeNull()
  })

  it('returns null without a proxy', async () => {
    setGateway(null)
    expect(await xmagePrintingsFor(['Lightning Bolt'])).toBeNull()
  })
})

describe('xmagePrintingsOf', () => {
  it('returns the printings of the requested card, unlimited', async () => {
    const printings = [{ setCode: 'M10', cardNumber: '146' }, { setCode: 'LEA', cardNumber: '161' }]
    send.mockResolvedValue(ok({ ready: true, results: [{ name: 'Lightning Bolt', printings }] }))

    expect(await xmagePrintingsOf('Lightning Bolt')).toEqual(printings)
    expect(send).toHaveBeenCalledWith('cardPrintings', { names: ['Lightning Bolt'], limit: 0 })
  })

  it('a card the proxy does not know is an empty list, not null', async () => {
    send.mockResolvedValue(ok({ ready: true, results: [] }))
    expect(await xmagePrintingsOf('Not A Card')).toEqual([])
  })

  it('returns null when the DB is not ready or the gateway fails', async () => {
    send.mockResolvedValueOnce(ok({ ready: false, results: [] }))
    expect(await xmagePrintingsOf('Lightning Bolt')).toBeNull()
    send.mockRejectedValueOnce(new Error('ws closed'))
    expect(await xmagePrintingsOf('Lightning Bolt')).toBeNull()
  })
})

describe('xmageImplemented', () => {
  const printings = (names: Record<string, boolean>) => ok({
    ready: true,
    results: Object.entries(names).map(([name, impl]) => ({
      name,
      printings: impl ? [{ setCode: 'M10', cardNumber: '1' }] : [],
    })),
  })

  it('asks for one printing per card, without duplicates or blanks', async () => {
    send.mockResolvedValue(printings({ 'Lightning Bolt': true, 'Unfinity Card': false }))

    const map = await xmageImplemented(['Lightning Bolt', ' Lightning Bolt ', '', '  ', 'Unfinity Card'])

    expect(send).toHaveBeenCalledTimes(1)
    expect(send).toHaveBeenCalledWith('cardPrintings', { names: ['Lightning Bolt', 'Unfinity Card'], limit: 1 })
    expect(map).toEqual(new Map([['lightning bolt', true], ['unfinity card', false]]))
  })

  it('caches per session: only asks for new names', async () => {
    send.mockResolvedValueOnce(printings({ 'Lightning Bolt': true }))
    await xmageImplemented(['Lightning Bolt'])

    send.mockResolvedValueOnce(printings({ Shock: false }))
    const map = await xmageImplemented(['lightning bolt', 'Shock'])

    expect(send).toHaveBeenCalledTimes(2)
    expect(send).toHaveBeenLastCalledWith('cardPrintings', { names: ['Shock'], limit: 1 })
    expect(map).toEqual(new Map([['lightning bolt', true], ['shock', false]]))

    // Everything cached: no further request.
    await xmageImplemented(['Shock', 'Lightning Bolt'])
    expect(send).toHaveBeenCalledTimes(2)
  })

  it('omits the names the proxy did not return', async () => {
    send.mockResolvedValue(printings({ 'Lightning Bolt': true }))
    const map = await xmageImplemented(['Lightning Bolt', 'Ghost'])
    expect(map).toEqual(new Map([['lightning bolt', true]]))
  })

  it('without a proxy returns null and does not poison the cache', async () => {
    send.mockResolvedValueOnce(ok({ ready: false, results: [] }))
    expect(await xmageImplemented(['Lightning Bolt'])).toBeNull()
    send.mockRejectedValueOnce(new Error('ws closed'))
    expect(await xmageImplemented(['Lightning Bolt'])).toBeNull()

    send.mockResolvedValueOnce(printings({ 'Lightning Bolt': true }))
    expect(await xmageImplemented(['Lightning Bolt'])).toEqual(new Map([['lightning bolt', true]]))
    expect(send).toHaveBeenCalledTimes(3)
  })
})
