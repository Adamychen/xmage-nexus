import { afterEach, describe, expect, it, vi } from 'vitest'
import { FakeServerCore, type FakeSocket } from '../../fixtures/fakeCore'
import { DEFAULT_SCENARIO_ID, DEMO_SCENARIOS, scenarioIdFromSearch, withDemoLayer } from './scenarios'
import { DEMO_USERNAME } from './data'

function connect(core: FakeServerCore) {
  const frames: Array<Record<string, unknown>> = []
  const socket: FakeSocket = {
    isOpen: () => true,
    send: (data) => frames.push(JSON.parse(data)),
    close: () => {},
  }
  const handle = core.attach(socket)
  return { frames, handle }
}

afterEach(() => {
  vi.useRealTimers()
})

describe('demo scenario registry', () => {
  it('uses unique ids and a known default', () => {
    const ids = DEMO_SCENARIOS.map((s) => s.id)
    expect(new Set(ids).size).toBe(ids.length)
    expect(ids).toContain(DEFAULT_SCENARIO_ID)
  })

  it('falls back to the default for an unknown ?scenario=', () => {
    expect(scenarioIdFromSearch('?scenario=nope')).toBe(DEFAULT_SCENARIO_ID)
    expect(scenarioIdFromSearch('')).toBe(DEFAULT_SCENARIO_ID)
    expect(scenarioIdFromSearch('?scenario=attack')).toBe('attack')
  })
})

describe.each(DEMO_SCENARIOS.map((s) => [s.id, s] as const))('scenario %s', (_id, def) => {
  it('logs in and publishes the lobby with the ranked roster and the extra tables', () => {
    vi.useFakeTimers()
    const core = new FakeServerCore(() => withDemoLayer(def.build()))
    const { frames, handle } = connect(core)
    handle.message(JSON.stringify({ requestId: 1, action: 'connect', args: { username: DEMO_USERNAME } }))
    const lobby = frames.filter((f) => f.type === 'lobby').at(-1) as
      | { tables: Array<{ tableId: string }>; users: { usersView: Array<{ userName: string; generalRating: number }> } }
      | undefined
    expect(lobby, 'a lobby frame').toBeDefined()
    expect(lobby!.users.usersView.length).toBeGreaterThanOrEqual(10)
    expect(lobby!.users.usersView.every((u) => u.generalRating > 0)).toBe(true)
    const ids = lobby!.tables.map((t) => t.tableId)
    expect(ids).toContain('demo-table-pod')
    expect(ids).toContain('demo-table-live')
    handle.close()
    core.shutdown()
  })
})

describe('EDHREC through the demo layer', () => {
  it('answers fetchOnlineDeck for the starter commander and refuses others', () => {
    vi.useFakeTimers()
    const core = new FakeServerCore(() => withDemoLayer(DEMO_SCENARIOS[0].build()))
    const { frames, handle } = connect(core)
    handle.message(JSON.stringify({ requestId: 'a', action: 'fetchOnlineDeck', args: { source: 'edhrec', urlOrId: 'krenko-mob-boss' } }))
    handle.message(JSON.stringify({ requestId: 'b', action: 'fetchOnlineDeck', args: { source: 'edhrec', urlOrId: 'nobody' } }))
    const byId = (id: string) => frames.find((f) => f.type === 'result' && f.requestId === id && f.action === 'fetchOnlineDeck')
    expect(byId('a')).toMatchObject({ ok: true })
    expect(byId('b')).toMatchObject({ ok: false, errorCode: 'CARD_NOT_FOUND' })
    handle.close()
    core.shutdown()
  })
})
