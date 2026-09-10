import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import TournamentPanel from './TournamentPanel'
import { setState } from '../state/store'

vi.mock('../net/commands', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../net/commands')>()),
  getTournamentChatId: vi.fn(async () => null),
  quitTournament: vi.fn(async () => ({ ok: true })),
}))
vi.mock('../lobby/ChatBox', () => ({
  default: () => <div data-testid="chat-box-stub">Chat Stub</div>,
}))
vi.mock('../lobby/TournamentBracket', () => ({
  default: () => <div data-testid="bracket-stub">Bracket Stub</div>,
}))

const view = {
  tournamentName: "player1's table",
  tournamentType: 'Booster Draft Elimination',
  tournamentState: 'Drafting',
  constructionTime: 600,
  watchingAllowed: true,
  rounds: [],
  players: [],
} as never

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
  setState({ tournament: null, construct: null, draftOverAt: null, tournamentChatId: null } as never)
})

const mockStorage: Record<string, string> = {}

beforeEach(() => {
  for (const k of Object.keys(mockStorage)) delete mockStorage[k]
  vi.stubGlobal('localStorage', {
    getItem: (key: string) => mockStorage[key] ?? null,
    setItem: (key: string, value: string) => {
      mockStorage[key] = String(value)
    },
    removeItem: (key: string) => {
      delete mockStorage[key]
    },
  })
})

function pointerEvent(type: string, init: { clientX: number; clientY: number }) {
  return new window.MouseEvent(type, { bubbles: true, cancelable: true, button: 0, ...init })
}

function showMini() {
  setState({ tournament: { tournamentId: 't1', view }, construct: null, draftOverAt: null } as never)
  const { container } = render(<TournamentPanel />)
  fireEvent.click(container.querySelector('.tournament-panel-collapse') as HTMLElement)
  return container
}

describe('TournamentPanel — watchdog de cuña draft→construcción', () => {
  it('muestra aviso si el DRAFT_OVER envejece sin CONSTRUCT', () => {
    setState({ tournament: { tournamentId: 't1', view }, construct: null, draftOverAt: Date.now() - 60000 } as never)
    render(<TournamentPanel />)
    expect(screen.getByTestId('tournament-stalled-banner')).toBeDefined()
  })

  it('no avisa con over reciente ni con construct ya llegado', () => {
    setState({ tournament: { tournamentId: 't1', view }, construct: null, draftOverAt: Date.now() } as never)
    render(<TournamentPanel />)
    expect(screen.queryByTestId('tournament-stalled-banner')).toBeNull()
    cleanup()
    setState({
      tournament: { tournamentId: 't1', view },
      construct: { deckName: 'Pool', pool: {}, tableId: 't1', parentTableId: null, timeLeft: 600 },
      draftOverAt: Date.now() - 60000,
    } as never)
    render(<TournamentPanel />)
    expect(screen.queryByTestId('tournament-stalled-banner')).toBeNull()
  })
})

describe('TournamentPanel — pill arrastrable', () => {
  it('aparece centrado por defecto y un click abre el bracket', () => {
    showMini()
    const mini = screen.getByTestId('tournament-panel-mini') as HTMLElement
    expect(mini.style.left).toBe('')
    fireEvent.click(mini)
    expect(screen.getByTestId('bracket-stub')).toBeDefined()
  })

  it('el drag mueve el pill, persiste y no abre el bracket', () => {
    showMini()
    const mini = screen.getByTestId('tournament-panel-mini') as HTMLElement
    fireEvent(mini, pointerEvent('pointerdown', { clientX: 100, clientY: 100 }))
    fireEvent(mini, pointerEvent('pointermove', { clientX: 200, clientY: 150 }))
    fireEvent(mini, pointerEvent('pointerup', { clientX: 200, clientY: 150 }))
    expect(mini.style.left).toBe('100px')
    expect(mini.style.top).toBe('50px')
    expect(JSON.parse(localStorage.getItem('tournament_mini_pos') as string)).toEqual({ left: 100, top: 50 })
    fireEvent.click(mini)
    expect(screen.queryByTestId('bracket-stub')).toBeNull()
    fireEvent.click(mini)
    expect(screen.getByTestId('bracket-stub')).toBeDefined()
  })

  it('una posición guardada fuera de la ventana se reclama a la vista', () => {
    localStorage.setItem('tournament_mini_pos', JSON.stringify({ left: 5000, top: 5000 }))
    showMini()
    const mini = screen.getByTestId('tournament-panel-mini') as HTMLElement
    expect(mini.style.left).toBe('696px')
    expect(mini.style.top).toBe('724px')
  })
})
