import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import EliminatedDialog from './EliminatedDialog'
import { setState, getState } from '../state/state'
import { reset } from '../state/store'
import { makeGameView, makePlayer } from '../__fixtures__/gameViews'
import * as cmds from '../net/commands'

vi.mock('../net/commands', async (importOriginal) => {
  const mod = await importOriginal<typeof import('../net/commands')>()
  return {
    ...mod,
    sendPlayerAction: vi.fn().mockResolvedValue({ ok: true }),
    quitMatch: vi.fn().mockResolvedValue({ ok: true }),
  }
})

function seated(hasLeft: boolean) {
  setState({
    phase: 'game',
    gameId: 'g-cmdr',
    game: makeGameView({
      players: [
        makePlayer({ playerId: 'p-me', name: 'Me', controlled: true, hasLeft }),
        makePlayer({ playerId: 'p-opp', name: 'Opp', controlled: false }),
      ],
    }),
  })
}

describe('EliminatedDialog', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    reset()
  })

  afterEach(() => {
    cleanup()
  })

  it('renders nothing while the controlled player is still in the game', () => {
    seated(false)
    const { container } = render(<EliminatedDialog />)
    expect(container.firstChild).toBeNull()
  })

  it('offers watching or leaving once the controlled player is out (Commander concede)', () => {
    seated(true)
    render(<EliminatedDialog />)
    expect(screen.getByText('Eliminado')).toBeDefined()
    expect(screen.getByTestId('eliminated-watch')).toBeDefined()
    expect(screen.getByTestId('eliminated-leave')).toBeDefined()
  })

  it('also opens from the sniffed loss message (no hasLeft in the view)', () => {
    seated(false)
    setState({ elimination: { gameId: 'g-cmdr', dismissed: false } })
    render(<EliminatedDialog />)
    expect(screen.getByTestId('eliminated-leave')).toBeDefined()
  })

  it('watching dismisses the dialog for the rest of the game', () => {
    seated(true)
    render(<EliminatedDialog />)
    fireEvent.click(screen.getByTestId('eliminated-watch'))
    expect(getState().elimination).toEqual({ gameId: 'g-cmdr', dismissed: true })
    cleanup()
    const { container } = render(<EliminatedDialog />)
    expect(container.firstChild).toBeNull()
  })

  it('leaving concedes out and returns to the lobby while the old game goes on', async () => {
    seated(true)
    render(<EliminatedDialog />)
    fireEvent.click(screen.getByTestId('eliminated-leave'))
    await vi.waitFor(() => expect(getState().phase).toBe('lobby'))
    expect(cmds.sendPlayerAction).toHaveBeenCalledWith('CONCEDE', 'g-cmdr')
    expect(cmds.quitMatch).toHaveBeenCalledWith('g-cmdr')
    expect(getState().gameId).toBeNull()
  })

  it('stays hidden when the game-end dialog owns the screen', () => {
    seated(true)
    setState({ gameEnd: { gameInfo: 'Opp has won the game', matchInfo: 'Opp won the match!', won: false } })
    const { container } = render(<EliminatedDialog />)
    expect(container.firstChild).toBeNull()
  })

  it('stays hidden for spectators', () => {
    setState({
      phase: 'game',
      gameId: 'g-cmdr',
      game: makeGameView({
        players: [makePlayer({ playerId: 'p-opp', name: 'Opp', controlled: false })],
      }),
    })
    const { container } = render(<EliminatedDialog />)
    expect(container.firstChild).toBeNull()
  })
})
