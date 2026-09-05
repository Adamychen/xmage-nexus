import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import GameEndDialog from './GameEndDialog'
import { setState } from '../state/state'
import { reset } from '../state/store'
import { makeGameView, makePlayer } from '../__fixtures__/gameViews'

describe('GameEndDialog', () => {
  beforeEach(() => {
    reset()
  })

  afterEach(() => {
    cleanup()
  })

  it('renders nothing when gameEnd is null', () => {
    const { container } = render(<GameEndDialog />)
    expect(container.firstChild).toBeNull()
  })

  it('renders victory dialog for human player who won', () => {
    setState({
      game: makeGameView({
        players: [makePlayer({ playerId: 'p-hero', name: 'Hero', controlled: true })],
      }),
      gameEnd: {
        won: true,
        gameInfo: 'Hero has won the game',
        matchInfo: 'Hero won the match!',
        matchView: { endTime: '2026-08-29T23:50:00Z' },
      },
    })

    render(<GameEndDialog />)
    expect(screen.getByText('¡Victoria!')).toBeDefined()
    expect(screen.getAllByText(/Hero/).length).toBeGreaterThan(0)
    expect(screen.getByRole('button', { name: /Volver al lobby/i })).toBeDefined()
  })

  it('renders defeat dialog for human player who lost', () => {
    setState({
      game: makeGameView({
        players: [makePlayer({ playerId: 'p-hero', name: 'Hero', controlled: true })],
      }),
      gameEnd: {
        won: false,
        gameInfo: 'Opponent has won the game',
        matchInfo: 'Opponent won the match!',
        wins: 0,
        loses: 2,
        winsNeeded: 2,
        matchView: { endTime: '2026-08-29T23:50:00Z' },
      },
    })

    render(<GameEndDialog />)
    expect(screen.getByText('Derrota')).toBeDefined()
    expect(screen.getByText(/Marcador: 0–2/i)).toBeDefined()
  })

  it('renders spectator notification with winner badge and return to lobby button', () => {
    setState({
      game: makeGameView({
        players: [
          makePlayer({ playerId: 'p-alice', name: 'Alice', controlled: false }),
          makePlayer({ playerId: 'p-bob', name: 'Bob', controlled: false }),
        ],
      }),
      gameEnd: {
        gameInfo: 'Alice has won the game',
        matchInfo: 'Alice won the match!',
        won: false,
        matchView: { endTime: '2026-08-29T23:50:00Z' },
      },
    })

    render(<GameEndDialog />)
    expect(screen.getByText('Partida finalizada')).toBeDefined()
    expect(screen.getByText('Alice')).toBeDefined()
    expect(screen.queryByText(/Marcador:/i)).toBeNull()

    const btn = screen.getByRole('button', { name: /Volver al lobby/i })
    expect(btn).toBeDefined()
    fireEvent.click(btn)
  })

  it('renders nothing when sideboardScreen is active (does not block sideboard)', () => {
    setState({
      game: makeGameView({
        players: [makePlayer({ playerId: 'p-hero', name: 'Hero', controlled: true })],
      }),
      gameEnd: {
        won: false,
        gameInfo: 'Hero lost the game',
        matchInfo: 'Match continues',
      },
      sideboardScreen: {
        deckName: 'Hero Deck',
        maindeck: [],
        sideboard: [],
        tableId: 't-1',
        parentTableId: null,
        timeLeft: 180,
        limited: false,
      },
    })

    const { container } = render(<GameEndDialog />)
    expect(container.firstChild).toBeNull()
  })

  it('renders close button when match continues and clicking it clears gameEnd', () => {
    setState({
      game: makeGameView({
        players: [makePlayer({ playerId: 'p-hero', name: 'Hero', controlled: true })],
      }),
      gameEnd: {
        won: false,
        gameInfo: 'Hero lost the game',
        matchInfo: 'Match continues',
      },
    })

    const { getByRole } = render(<GameEndDialog />)
    const closeBtn = getByRole('button', { name: /Cerrar|Close/i })
    expect(closeBtn).toBeDefined()
    fireEvent.click(closeBtn)
  })
})
