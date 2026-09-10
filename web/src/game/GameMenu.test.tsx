import { render, fireEvent } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import GameMenu from './GameMenu'
import { reset } from '../state/store'
import { setState } from '../state/state'
import { setLanguage } from '../i18n'
import { makeGameView, makePlayer } from '../__fixtures__/gameViews'

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

  it('opens the full settings modal on the gameplay section', () => {
    const { container } = render(<GameMenu />)
    const menu = openMenu(container)
    fireEvent.click(menu!.querySelector('[data-testid="game-menu-settings"]')!)
    expect(container.querySelector('[data-testid="game-menu"]')).toBeNull()
    expect(container.querySelector('[data-testid="settings-modal"]')).not.toBeNull()
    expect(container.querySelector('[data-testid="settings-phase-stops"]')).not.toBeNull()
  })
})
