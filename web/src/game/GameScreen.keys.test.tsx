import { act, cleanup, render } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import * as cmds from '../net/commands'
import GameScreen from './GameScreen'
import { initialState, setState } from '../state/state'
import { playerGameView } from '../__fixtures__/gameViews'

vi.mock('../net/commands', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../net/commands')>()),
  sendPlayerBoolean: vi.fn(async () => ({ ok: true })),
  sendPlayerAction: vi.fn(async () => ({ ok: true })),
}))

function memoryStorage(): Storage {
  const m = new Map<string, string>()
  return {
    get length() { return m.size },
    clear: () => m.clear(),
    getItem: (k) => (m.has(k) ? m.get(k)! : null),
    key: (i) => Array.from(m.keys())[i] ?? null,
    removeItem: (k) => { m.delete(k) },
    setItem: (k, v) => { m.set(k, String(v)) },
  }
}

function press(key: string, code: string, repeat: boolean) {
  document.body.dispatchEvent(new KeyboardEvent('keydown', { key, code, repeat, bubbles: true, cancelable: true }))
}

beforeEach(() => {
  vi.stubGlobal('localStorage', memoryStorage())
  vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false, status: 404, json: async () => ({}), text: async () => '' })))
  vi.mocked(cmds.sendPlayerBoolean).mockClear()
  vi.mocked(cmds.sendPlayerAction).mockClear()
  setState({
    ...initialState,
    settings: { ...initialState.settings, gameUi: 'v1' },
    conn: { serverHost: 'localhost', port: 17171, username: 'tester', wsHost: 'localhost', proxyPort: 8787 },
    gameId: 'game-1',
    game: playerGameView,
    myPlayerId: playerGameView.myPlayerId,
  } as never)
})

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
  setState({ ...initialState } as never)
})

describe('GameScreen held keys', () => {
  it('KEY-1, KEY-5: a held Space sends one pass, not one per auto-repeat keydown', async () => {
    render(<GameScreen />)
    await act(async () => { press(' ', 'Space', false) })
    expect(cmds.sendPlayerBoolean).toHaveBeenCalledTimes(1)
    await act(async () => { press(' ', 'Space', true) })
    await act(async () => { press(' ', 'Space', true) })
    expect(cmds.sendPlayerBoolean).toHaveBeenCalledTimes(1)
  })

  it('KEY-5, KEY-6: a held skip key (F4) sends one skip, not one per auto-repeat keydown', async () => {
    render(<GameScreen />)
    await act(async () => { press('F4', 'F4', true) })
    expect(cmds.sendPlayerAction).not.toHaveBeenCalled()
    await act(async () => { press('F4', 'F4', false) })
    expect(cmds.sendPlayerAction).toHaveBeenCalledTimes(1)
    expect(cmds.sendPlayerAction).toHaveBeenCalledWith('PASS_PRIORITY_UNTIL_NEXT_TURN', 'game-1')
    await act(async () => { press('F4', 'F4', true) })
    expect(cmds.sendPlayerAction).toHaveBeenCalledTimes(1)
  })
})
