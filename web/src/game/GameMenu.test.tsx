import { render, fireEvent } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import GameMenu from './GameMenu'
import { reset, setSetting, getState } from '../state/store'
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

  it('opens a menu with leave, appearance, settings, help and fullscreen', () => {
    const { container } = render(<GameMenu />)
    const menu = openMenu(container)
    expect(menu).not.toBeNull()
    expect(menu!.querySelector('.leave-match-btn')).not.toBeNull()
    expect(menu!.querySelector('[data-testid="game-menu-appearance"]')).not.toBeNull()
    expect(menu!.querySelector('[data-testid="game-menu-fx"]')).not.toBeNull()
    expect(menu!.querySelector('[data-testid="game-menu-help"]')).not.toBeNull()
    expect(menu!.querySelector('[data-testid="game-menu-fullscreen"]')).not.toBeNull()
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

  it('shows standard+pod views in 1v1 (no arena without multiplayer)', () => {
    setState({
      game: makeGameView({
        players: [
          makePlayer({ playerId: 'p1', name: 'Alice', controlled: true }),
          makePlayer({ playerId: 'p2', name: 'Bob' }),
        ],
      }),
    })
    const { container } = render(<GameMenu />)
    const menu = openMenu(container)
    expect(menu!.querySelector('[data-testid="game-menu-layout-standard"]')).not.toBeNull()
    expect(menu!.querySelector('[data-testid="game-menu-layout-pod"]')).not.toBeNull()
    expect(menu!.querySelector('[data-testid="game-menu-layout-arena"]')).toBeNull()
  })

  it('shows all three named views with multiplayer and marks the active one', () => {
    setState({
      game: makeGameView({
        players: [
          makePlayer({ playerId: 'p1', name: 'Alice', controlled: true }),
          makePlayer({ playerId: 'p2', name: 'Bob' }),
          makePlayer({ playerId: 'p3', name: 'Carol' }),
        ],
      }),
    })
    setSetting('boardLayout', 'pod')
    const { container } = render(<GameMenu />)
    const menu = openMenu(container)
    const standard = menu!.querySelector('[data-testid="game-menu-layout-standard"]')
    const pod = menu!.querySelector('[data-testid="game-menu-layout-pod"]')
    const arena = menu!.querySelector('[data-testid="game-menu-layout-arena"]')
    expect(standard?.textContent).toContain('Estándar')
    expect(pod?.textContent).toContain('Pod')
    expect(arena?.textContent).toContain('Arena')
    expect(pod?.classList.contains('is-active')).toBe(true)
    expect(pod?.querySelector('.game-menu-radio-check')).not.toBeNull()
    expect(standard?.classList.contains('is-active')).toBe(false)
  })

  it('switches board layout when clicking a view', () => {
    setState({
      game: makeGameView({
        players: [
          makePlayer({ playerId: 'p1', name: 'Alice', controlled: true }),
          makePlayer({ playerId: 'p2', name: 'Bob' }),
        ],
      }),
    })
    setSetting('boardLayout', 'standard')
    const { container } = render(<GameMenu />)
    const menu = openMenu(container)
    fireEvent.click(menu!.querySelector('[data-testid="game-menu-layout-pod"]')!)
    expect(getState().settings.boardLayout).toBe('pod')
  })

  it('expands the FX/sound section without closing the menu', () => {
    const { container } = render(<GameMenu />)
    const menu = openMenu(container)
    const fxBtn = menu!.querySelector('[data-testid="game-menu-fx"]')
    fireEvent.click(fxBtn!)
    expect(container.querySelector('[data-testid="game-menu"]')).not.toBeNull()
    expect(container.textContent).toContain('0.5')
  })
})
