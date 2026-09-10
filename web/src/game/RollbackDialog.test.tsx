import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import RollbackDialog from './RollbackDialog'
import { setState, getState } from '../state/state'
import { reset } from '../state/store'
import { makeGameView, makePlayer } from '../__fixtures__/gameViews'
import * as cmds from '../net/commands'

vi.mock('../net/commands', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../net/commands')>()
  return {
    ...actual,
    sendPlayerAction: vi.fn().mockResolvedValue({ ok: true }),
  }
})

describe('RollbackDialog', () => {
  beforeEach(() => {
    reset()
    vi.clearAllMocks()
  })

  afterEach(() => {
    cleanup()
  })

  it('renders nothing when rollbackDialogOpen is false', () => {
    setState({ rollbackDialogOpen: false })
    const { container } = render(<RollbackDialog />)
    expect(container.firstChild).toBeNull()
  })

  it('renders turn choices when open with active game', () => {
    setState({
      rollbackDialogOpen: true,
      gameId: 'g-1',
      game: makeGameView({
        turn: 4,
        rollbackTurnsAllowed: true,
        players: [makePlayer({ playerId: 'p-hero', name: 'Hero', controlled: true, hasPriority: true })],
      }),
    })

    render(<RollbackDialog />)
    expect(screen.getByRole('dialog')).toBeDefined()
    expect(screen.getAllByText(/REBOBINAR PARTIDA|ROLLBACK GAME/i).length).toBeGreaterThan(0)
    expect(screen.getAllByRole('radio').length).toBe(4)
  })

  it('sends ROLLBACK_TURNS on confirm', async () => {
    setState({
      rollbackDialogOpen: true,
      gameId: 'g-1',
      game: makeGameView({
        turn: 3,
        rollbackTurnsAllowed: true,
        players: [makePlayer({ playerId: 'p-hero', name: 'Hero', controlled: true, hasPriority: true })],
      }),
    })

    render(<RollbackDialog />)
    const radios = screen.getAllByRole('radio')
    fireEvent.click(radios[1])

    const confirmBtn = screen.getByRole('button', { name: /Solicitar Rebobinado|Request Rollback/i })
    fireEvent.click(confirmBtn)

    expect(cmds.sendPlayerAction).toHaveBeenCalledWith('ROLLBACK_TURNS', 'g-1', 1)
  })

  it('sends UNDO when Undo button is clicked', async () => {
    setState({
      rollbackDialogOpen: true,
      gameId: 'g-1',
      game: makeGameView({
        turn: 2,
        rollbackTurnsAllowed: true,
        players: [makePlayer({ playerId: 'p-hero', name: 'Hero', controlled: true, hasPriority: true })],
      }),
    })

    render(<RollbackDialog />)
    const undoBtn = screen.getByRole('button', { name: /Undo/i })
    fireEvent.click(undoBtn)

    expect(cmds.sendPlayerAction).toHaveBeenCalledWith('UNDO', 'g-1')
  })

  it('deshabilita solicitar sin prioridad (el servidor lo rechazaría)', () => {
    setState({
      rollbackDialogOpen: true,
      gameId: 'g-1',
      game: makeGameView({
        turn: 3,
        rollbackTurnsAllowed: true,
        players: [makePlayer({ playerId: 'p-hero', name: 'Hero', controlled: true, hasPriority: false })],
      }),
    })

    render(<RollbackDialog />)
    const confirmBtn = screen.getByRole('button', { name: /Solicitar Rebobinado|Request Rollback/i })
    expect((confirmBtn as HTMLButtonElement).disabled).toBe(true)
  })

  it('closes when cancel is clicked', () => {
    setState({
      rollbackDialogOpen: true,
      gameId: 'g-1',
      game: makeGameView({
        turn: 2,
        rollbackTurnsAllowed: true,
        players: [makePlayer({ playerId: 'p-hero', name: 'Hero', controlled: true, hasPriority: true })],
      }),
    })

    render(<RollbackDialog />)
    const cancelBtn = screen.getByRole('button', { name: /Cancelar|Cancel/i })
    fireEvent.click(cancelBtn)

    expect(getState().rollbackDialogOpen).toBe(false)
  })
})