import { render, fireEvent } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import GameMenu from './GameMenu'
import { reset } from '../state/store'
import { getState, setState } from '../state/state'
import { setLanguage } from '../i18n'
import { makeGameView, makePlayer } from '../__fixtures__/gameViews'

vi.mock('../ui/confirmDialog', () => ({ confirmDialog: vi.fn().mockResolvedValue(true) }))

vi.mock('../net/commands', async (importOriginal) => {
  const mod = await importOriginal<typeof import('../net/commands')>()
  return {
    ...mod,
    sendPlayerAction: vi.fn().mockResolvedValue({ ok: true }),
    quitMatch: vi.fn().mockResolvedValue({ ok: true }),
    stopWatching: vi.fn().mockResolvedValue({ ok: true }),
    leaveChat: vi.fn().mockResolvedValue({ ok: true }),
    leaveTable: vi.fn().mockResolvedValue({ ok: true }),
  }
})

function openMenu(container: HTMLElement) {
  const btn = container.querySelector('[data-testid="game-menu-btn"]')
  expect(btn).not.toBeNull()
  fireEvent.click(btn!)
  return container.querySelector('[data-testid="game-menu"]')
}

describe('GameMenu', () => {
  beforeEach(() => {
    reset()
    setLanguage('es')
  })

  it('renders closed with only the ⋯ button', () => {
    const { container } = render(<GameMenu />)
    expect(container.querySelector('[data-testid="game-menu-btn"]')).not.toBeNull()
    expect(container.querySelector('[data-testid="game-menu"]')).toBeNull()
  })

  it('opens a menu with leave, settings, help and fullscreen (no stops/views/appearance/about)', () => {
    const { container } = render(<GameMenu />)
    const menu = openMenu(container)
    expect(menu).not.toBeNull()
    expect(menu!.querySelector('.leave-match-btn')).not.toBeNull()
    expect(menu!.querySelector('[data-testid="game-menu-settings"]')).not.toBeNull()
    expect(menu!.querySelector('[data-testid="game-menu-help"]')).not.toBeNull()
    expect(menu!.querySelector('[data-testid="game-menu-fullscreen"]')).not.toBeNull()
    expect(menu!.querySelector('[data-testid="game-menu-phase-stops"]')).toBeNull()
    expect(menu!.querySelector('[data-testid="game-menu-layout-standard"]')).toBeNull()
    expect(menu!.querySelector('[data-testid="game-menu-appearance"]')).toBeNull()
    expect(menu!.querySelector('[data-testid="game-menu-about"]')).toBeNull()
  })

  it('shows no concede or rollback without a controlled player', () => {
    const { container } = render(<GameMenu />)
    const menu = openMenu(container)
    expect(menu!.querySelector('.leave-game-btn')).toBeNull()
    expect(menu!.querySelector('.rollback-game-btn')).toBeNull()
  })

  it('shows concede and rollback for a player when rollbacks are allowed', () => {
    setState({
      game: makeGameView({
        rollbackTurnsAllowed: true,
        players: [
          makePlayer({ playerId: 'p1', name: 'Alice', controlled: true }),
          makePlayer({ playerId: 'p2', name: 'Bob' }),
        ],
      }),
    })
    const { container } = render(<GameMenu />)
    const menu = openMenu(container)
    expect(menu!.querySelector('.leave-game-btn')).not.toBeNull()
    expect(menu!.querySelector('.rollback-game-btn')).not.toBeNull()
  })

  it('DLG-11: the menu asks for a window and closes, and draws none of them itself', () => {
    const { container } = render(<GameMenu />)
    for (const [item, modal] of [['settings', 'settings'], ['help', 'help'], ['report', 'report']] as const) {
      setState({ gameModal: null })
      const menu = openMenu(container)
      fireEvent.click(menu!.querySelector(`[data-testid="game-menu-${item}"]`)!)
      expect(getState().gameModal, item).toBe(modal)
      expect(container.querySelector('[data-testid="game-menu"]'), 'the menu closes behind it').toBeNull()
      // The window hangs from the screen, never from the menu: the board swaps under it when the
      // side panel is switched, and it used to take the open window with it.
      expect(document.body.querySelector('[data-testid="settings-modal"]')).toBeNull()
    }
  })

  it('CTL-5: the arrows open the menu on its first item, a click leaves the focus where it was, and Escape closes it', () => {
    const { container } = render(<GameMenu />)
    const btn = container.querySelector<HTMLButtonElement>('[data-testid="game-menu-btn"]')!
    fireEvent.click(btn)
    const menu = container.querySelector('[data-testid="game-menu"]')!
    expect(menu.classList.contains('ui-popover')).toBe(true)
    expect(menu.contains(document.activeElement)).toBe(false)
    fireEvent.click(btn)
    btn.focus()
    fireEvent.keyDown(btn, { key: 'ArrowDown' })
    expect(container.querySelector('[data-testid="game-menu"]')?.contains(document.activeElement)).toBe(true)
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(container.querySelector('[data-testid="game-menu"]')).toBeNull()
    expect(document.activeElement).toBe(btn)
  })

  it('GME-1: leaving a game where every opponent has left does not concede', async () => {
    const { sendPlayerAction, quitMatch } = await import('../net/commands')
    setState({
      phase: 'game',
      gameId: 'g-alone',
      game: makeGameView({
        players: [
          makePlayer({ playerId: 'p1', name: 'Alice', controlled: true }),
          makePlayer({ playerId: 'p2', name: 'Bob', hasLeft: true }),
        ],
      }),
    })

    const { container } = render(<GameMenu />)
    const menu = openMenu(container)
    fireEvent.click(menu!.querySelector('.leave-match-btn')!)

    await vi.waitFor(() => expect(getState().phase).toBe('lobby'))
    expect(quitMatch).toHaveBeenCalledWith('g-alone')
    expect(sendPlayerAction).not.toHaveBeenCalledWith('CONCEDE', 'g-alone')
  })
})
