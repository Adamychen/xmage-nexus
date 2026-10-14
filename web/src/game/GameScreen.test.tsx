import { act, cleanup, render } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import GameScreen from './GameScreen'
import { initialState, setState } from '../state/state'
import { playerGameView, spectatorGameView } from '../__fixtures__/gameViews'

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

function show(extra: Record<string, unknown> = {}) {
  setState({
    ...initialState,
    conn: { serverHost: 'localhost', port: 17171, username: 'tester', wsHost: 'localhost', proxyPort: 8787 },
    gameId: 'game-1',
    game: playerGameView,
    myPlayerId: playerGameView.myPlayerId,
    ...extra,
  } as never)
  return render(<GameScreen />)
}

beforeEach(() => {
  vi.stubGlobal('localStorage', memoryStorage())
  vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false, status: 404, json: async () => ({}), text: async () => '' })))
})

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
  setState({ ...initialState } as never)
})

describe('GameScreen', () => {
  it('paints the board for a player view without throwing', () => {
    const errors = vi.spyOn(console, 'error').mockImplementation(() => {})
    const { container } = show()
    expect(container.querySelector('.game')).not.toBeNull()
    expect(container.querySelector('[data-testid="game-board"]')).not.toBeNull()
    expect(errors).not.toHaveBeenCalled()
    errors.mockRestore()
  })

  it('renders a spectator view', () => {
    const { container } = show({ game: spectatorGameView, myPlayerId: null })
    expect(container.querySelector('.game')).not.toBeNull()
  })

  it('renders nothing playable without a game and does not crash', () => {
    expect(() => show({ game: null })).not.toThrow()
  })

  it('applies the inverse of the UI scale so the board is not zoomed twice', () => {
    const { container } = show({ settings: { ...initialState.settings, uiScale: 1.3 } })
    const root = container.querySelector<HTMLElement>('.game')!
    expect(parseFloat(root.style.zoom)).toBeCloseTo(1 / 1.3, 2)
  })

  it('survives a stream of view updates', async () => {
    show()
    for (let i = 0; i < 5; i++) {
      await act(async () => {
        setState({ game: { ...playerGameView, turn: i + 1 } } as never)
      })
    }
    expect(document.querySelector('.game')).not.toBeNull()
  })
})
