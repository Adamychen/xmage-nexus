import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import LobbyScreen from './LobbyScreen'
import { initialState, setState } from '../state/state'

function show(extra: Record<string, unknown> = {}) {
  setState({
    ...initialState,
    conn: { serverHost: 'localhost', port: 17171, username: 'tester', wsHost: 'localhost', proxyPort: 8787 },
    ...extra,
  } as never)
  return render(<LobbyScreen />)
}

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

beforeEach(() => {
  vi.stubGlobal('localStorage', memoryStorage())
  vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false, status: 404, json: async () => ({}), text: async () => '' })))
})

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
  setState({ ...initialState } as never)
})

function tableOf(id: string, name: string, over: Record<string, unknown> = {}) {
  return {
    tableId: id, tableName: name, gameType: 'Two Player Duel', deckType: 'Freeform', controllerName: 'Alice',
    tableState: 'WAITING', tableStateText: 'Waiting', seatsInfo: '1/2', seats: [], games: [], isTournament: false,
    rated: false, passworded: false, spectatorsAllowed: true, createTime: Date.now(), skillLevel: 0, ...over,
  }
}

const withTables = (tables: unknown[]) => ({ lobby: { type: 'lobby', tables, users: [], serverMessages: [] } })

describe('LobbyScreen', () => {
  it('shows the server, the empty tables state and the main navigation', () => {
    show()
    expect(screen.getByText(/localhost:17171/)).toBeTruthy()
    expect(document.querySelector('nav.lobby-top-nav')).not.toBeNull()
    expect(document.querySelector('.tables-list, .empty-state')).not.toBeNull()
  })

  it('switches between the tables, decks and history tabs', async () => {
    show()
    const nav = document.querySelector<HTMLElement>('nav.lobby-top-nav')!
    const buttons = Array.from(nav.querySelectorAll<HTMLButtonElement>('button.top-nav-btn'))
    const byLabel = (re: RegExp) => buttons.find((b) => re.test(b.title))!
    const tables = byLabel(/mesas|tables/i)
    expect(tables.className).toContain('active')
    await act(async () => { fireEvent.click(byLabel(/mazos|decks/i)) })
    expect(byLabel(/mazos|decks/i).className).toContain('active')
    expect(tables.className).not.toContain('active')
    await act(async () => { fireEvent.click(byLabel(/historial|history/i)) })
    expect(byLabel(/historial|history/i).className).toContain('active')
  })

  it('opens the create-table dialog from the header', async () => {
    show()
    await act(async () => { fireEvent.click(document.querySelector('.top-nav-create')!) })
    expect(screen.getByRole('heading', { name: /Nueva mesa|Crear Mesa/i })).toBeTruthy()
  })

  it('LBY-4: restores saved table filters and survives corrupted ones', () => {
    localStorage.setItem('lobby_filters', '{not json')
    expect(() => show()).not.toThrow()
    cleanup()
    localStorage.setItem('lobby_filters', JSON.stringify({ format: 'nonsense', unknownKey: 1 }))
    expect(() => show()).not.toThrow()
  })

  it('remembers whether the mobile chat was open', () => {
    show()
    expect(localStorage.getItem('floating_chat_open')).toBe('0')
  })

  it('lists every table with its count in the heading', () => {
    show(withTables([tableOf('t1', 'Alpha night'), tableOf('t2', 'Beta night')]))
    expect(screen.getByText('Alpha night')).toBeTruthy()
    expect(screen.getByText('Beta night')).toBeTruthy()
    expect(document.querySelectorAll('.tables-list > *').length).toBeGreaterThanOrEqual(2)
    expect(screen.getByRole('heading', { level: 2, name: /\(2\)/ })).toBeTruthy()
  })

  it('does not show the empty state when there are tables', () => {
    show(withTables([tableOf('t1', 'Alpha night')]))
    expect(document.querySelector('.empty-state')).toBeNull()
  })

  it('toggles the compact density and remembers it', async () => {
    show(withTables([tableOf('t1', 'Alpha night')]))
    const toggle = screen.getByTestId('tables-density-toggle')
    expect(toggle.getAttribute('aria-pressed')).toBe('false')
    await act(async () => { fireEvent.click(toggle) })
    expect(toggle.getAttribute('aria-pressed')).toBe('true')
    expect(document.querySelector('.tables-list')?.className).toContain('is-compact')
    expect(localStorage.getItem('tables_density')).toBe('compact')
  })

  it('persists the filter panel state', async () => {
    show(withTables([tableOf('t1', 'Alpha night')]))
    const toggle = document.querySelector<HTMLButtonElement>('.tables-filter-toggle')!
    const before = toggle.getAttribute('aria-expanded')
    await act(async () => { fireEvent.click(toggle) })
    expect(toggle.getAttribute('aria-expanded')).not.toBe(before)
    expect(localStorage.getItem('tables_filters_open')).toBe(before === 'true' ? '0' : '1')
  })
})
