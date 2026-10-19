// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { setLanguage } from '../i18n'
import { setState } from '../state/state'
import { playerGameView } from '../__fixtures__/gameViews'
import MobileSpectator from './MobileSpectator'

vi.mock('./GameMenu', () => ({ default: () => <div data-testid="game-menu-stub" /> }))
vi.mock('./ActionFeed', () => ({ default: () => <div data-testid="feed-stub" /> }))
vi.mock('./GameChat', () => ({ default: () => <div data-testid="chat-stub" /> }))

beforeEach(() => {
  setLanguage('en')
  setState({ phase: 'game', game: playerGameView })
})

afterEach(() => {
  cleanup()
  setState({ game: null })
})

describe('MobileSpectator', () => {
  it('lists every player with life and the turn header', () => {
    render(<MobileSpectator onFullBoard={() => {}} />)
    const rows = screen.getAllByTestId('mspec-player')
    expect(rows).toHaveLength(playerGameView.players?.length ?? 0)
    expect(screen.getByTestId('mspec-turn').textContent).toContain(String(playerGameView.turn))
    for (const p of playerGameView.players ?? []) {
      expect(screen.getByText(p.name)).toBeTruthy()
    }
  })

  it('switches between the feed, the stack and the chat', () => {
    render(<MobileSpectator onFullBoard={() => {}} />)
    expect(screen.getByTestId('feed-stub')).toBeTruthy()
    fireEvent.click(screen.getByTestId('mspec-tab-chat'))
    expect(screen.getByTestId('chat-stub')).toBeTruthy()
    fireEvent.click(screen.getByTestId('mspec-tab-stack'))
    expect(screen.getByTestId('mspec-pane-stack')).toBeTruthy()
  })

  it('hands over to the full board on request', () => {
    const onFullBoard = vi.fn()
    render(<MobileSpectator onFullBoard={onFullBoard} />)
    fireEvent.click(screen.getByTestId('mspec-full'))
    expect(onFullBoard).toHaveBeenCalledOnce()
  })
})
