// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { render, fireEvent, cleanup } from '@testing-library/react'
import BoardZone from './BoardZone'
import { setState } from '../state/store'
import { makeCard, makeGameView, makePlayer } from '../__fixtures__/gameViews'

const alice = () =>
  makePlayer({ playerId: 'p1', name: 'Alice', controlled: true, handCount: 1 })
const bob = () => makePlayer({ playerId: 'p2', name: 'Bob', handCount: 1 })

function setGame(opponentHands: Record<string, Record<string, unknown>>) {
  setState({
    game: makeGameView({ players: [alice(), bob()], opponentHands: opponentHands as never }) as never,
    gameId: 'g1',
  })
}

const ownHand = { 'h-1': makeCard({ name: 'Counterspell', parentId: 'h-1' }) }
const bobsHand = { Bob: { 'oh-1': makeCard({ name: 'Mindslaver Prize', parentId: 'oh-1' }) } }

describe('BoardZone Switch Hands', () => {
  beforeEach(() => {
    setState({ game: null, gameId: null, playerMenu: null })
  })
  afterEach(() => {
    setState({ game: null, gameId: null, playerMenu: null })
    cleanup()
  })

  it('sin opponentHands no muestra el toggle', () => {
    setGame({})
    const { queryByTestId } = render(<BoardZone player={alice()} hand={ownHand} />)
    expect(queryByTestId('hand-switch-btn')).toBeNull()
  })

  it('con mano controlada muestra el toggle y alterna la mano visible', () => {
    setGame(bobsHand as never)
    const { getByTestId, queryByText } = render(<BoardZone player={alice()} hand={ownHand} />)
    const btn = getByTestId('hand-switch-btn')
    expect(queryByText('Counterspell')).not.toBeNull()

    fireEvent.click(btn)
    expect(btn.getAttribute('data-switched')).toBe('Bob')
    expect(queryByText('Mindslaver Prize')).not.toBeNull()
    expect(queryByText('Counterspell')).toBeNull()

    fireEvent.click(getByTestId('hand-switch-btn'))
    expect(queryByText('Counterspell')).not.toBeNull()
    expect(queryByText('Mindslaver Prize')).toBeNull()
  })

  it('en zona rival no muestra el toggle aunque haya opponentHands', () => {
    setGame(bobsHand as never)
    const { queryByTestId } = render(<BoardZone player={bob()} />)
    expect(queryByTestId('hand-switch-btn')).toBeNull()
  })
})
